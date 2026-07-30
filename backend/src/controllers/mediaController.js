const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fileType = require('file-type');
const { Op } = require('sequelize');
const Media = require('../models/Media');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
]);

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOADS_DIR),
  filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
});

exports.upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

async function removeFiles(paths) {
  await Promise.all(paths.filter(Boolean).map(async (filePath) => {
    try {
      await fsp.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function uploadedFilePaths(req) {
  return (req.files || []).map((file) => file.path);
}

function failure(res, status, message, error) {
  return res.status(status).json({ message, error });
}

exports.handleUploadError = async (error, req, res, next) => {
  if (!error) return next();

  try {
    await removeFiles(uploadedFilePaths(req));
  } catch (_cleanupError) {
    // The original upload error is more useful to the client than cleanup details.
  }

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return failure(res, 413, 'Each file must be 10MB or smaller', 'FILE_TOO_LARGE');
  }

  if (error instanceof multer.MulterError) {
    return failure(res, 400, 'Invalid upload request', 'INVALID_UPLOAD');
  }

  return failure(res, 400, 'Failed to upload files', 'UPLOAD_FAILED');
};

exports.uploadMedia = async (req, res) => {
  const files = req.files || [];
  const generatedPaths = [];

  try {
    if (files.length === 0) {
      return failure(res, 400, 'At least one file is required', 'NO_FILES');
    }

    const inspectedFiles = [];
    const receivedHashes = new Set();
    for (const file of files) {
      const detected = await fileType.fromFile(file.path);
      if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
        await removeFiles(uploadedFilePaths(req));
        return failure(res, 400, 'Only JPEG, PNG, WebP, GIF, and MP4 files are allowed', 'UNSUPPORTED_FILE_TYPE');
      }

      const contentHash = await hashFile(file.path);
      if (receivedHashes.has(contentHash)) {
        await removeFiles(uploadedFilePaths(req));
        return failure(res, 409, 'The same file was selected more than once', 'DUPLICATE_MEDIA');
      }
      const duplicate = await Media.findOne({ where: { contentHash } });
      if (duplicate) {
        await removeFiles(uploadedFilePaths(req));
        return failure(res, 409, 'This file has already been uploaded', 'DUPLICATE_MEDIA');
      }

      receivedHashes.add(contentHash);
      inspectedFiles.push({ file, mimeType: detected.mime, contentHash });
    }

    const records = [];
    for (const { file, mimeType, contentHash } of inspectedFiles) {
      const type = mimeType.startsWith('image/') ? 'image' : 'video';
      let width = null;
      let height = null;
      let thumbnailPath = null;

      if (type === 'image') {
        const metadata = await sharp(file.path, { animated: true }).metadata();
        width = metadata.width || null;
        height = metadata.height || null;
        thumbnailPath = `${file.path}-thumbnail.webp`;
        await sharp(file.path, { animated: false })
          .rotate()
          .resize({ width: 300, height: 300, fit: 'inside', withoutEnlargement: true })
          .webp()
          .toFile(thumbnailPath);
        generatedPaths.push(thumbnailPath);
      }

      records.push({
        fileName: file.originalname,
        storedPath: file.path,
        publicUrl: `/uploads/${path.basename(file.path)}`,
        mimeType,
        type,
        size: file.size,
        contentHash,
        width,
        height,
        thumbnailPath,
        altText: req.body.altText || null,
        title: req.body.title || null,
        uploadedBy: req.user.id,
      });
    }

    const media = await Media.bulkCreate(records, { returning: true });
    return res.status(201).json(media);
  } catch (error) {
    try {
      await removeFiles([...uploadedFilePaths(req), ...generatedPaths]);
    } catch (_cleanupError) {
      // Do not leak internal filesystem errors in the API response.
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return failure(res, 409, 'This file has already been uploaded', 'DUPLICATE_MEDIA');
    }
    return failure(res, 400, 'Failed to process uploaded files', 'UPLOAD_PROCESSING_FAILED');
  }
};

exports.getAllMedia = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const type = req.query.type ? String(req.query.type).trim() : '';
    const where = {};

    if (type) {
      if (!['image', 'video'].includes(type)) {
        return failure(res, 400, 'type must be image or video', 'INVALID_MEDIA_TYPE');
      }
      where.type = type;
    }

    if (search) {
      where[Op.or] = [
        { fileName: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { altText: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Media.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (error) {
    return failure(res, 500, 'Failed to fetch media', 'MEDIA_LIST_FAILED');
  }
};

exports.updateMedia = async (req, res) => {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return failure(res, 404, 'Media not found', 'MEDIA_NOT_FOUND');

    const updates = {};
    for (const field of ['altText', 'title']) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }

    await media.update(updates);
    return res.json(media);
  } catch (error) {
    return failure(res, 400, 'Failed to update media', 'MEDIA_UPDATE_FAILED');
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return failure(res, 404, 'Media not found', 'MEDIA_NOT_FOUND');

    // TODO: Before deletion, query MediaAttachment (and Product/Category attachments) for references to media.id.
    await removeFiles([media.storedPath, media.thumbnailPath]);
    await media.destroy();
    return res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    return failure(res, 500, 'Failed to delete media', 'MEDIA_DELETE_FAILED');
  }
};
