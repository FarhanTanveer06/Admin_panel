const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const requirePermission = require('../middleware/requirePermission');

router.post(
  '/upload',
  requirePermission('media:upload'),
  mediaController.upload.array('files', 10),
  mediaController.uploadMedia,
  mediaController.handleUploadError,
);
router.get('/', requirePermission('media:read'), mediaController.getAllMedia);
router.put('/:id', requirePermission('media:write'), mediaController.updateMedia);
router.delete('/:id', requirePermission('media:delete'), mediaController.deleteMedia);

module.exports = router;
