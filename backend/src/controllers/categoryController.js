const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const Category = require('../models/Category');
const Media = require('../models/Media');

function failure(res, status, message, error) {
  return res.status(status).json({ message, error });
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function optionalId(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error(`${fieldName} must be a valid id`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return id;
}

async function ensureParentExists(parentId, transaction) {
  if (parentId === null) return;
  const parent = await Category.findByPk(parentId, { transaction });
  if (!parent) {
    const error = new Error('Parent category not found');
    error.code = 'PARENT_NOT_FOUND';
    throw error;
  }
}

async function ensureImageExists(imageId, transaction) {
  if (imageId === undefined || imageId === null) return;
  const image = await Media.findByPk(imageId, { transaction });
  if (!image) {
    const error = new Error('Media image not found');
    error.code = 'IMAGE_NOT_FOUND';
    throw error;
  }
}

// Walk from the proposed parent to the root. If the edited category appears,
// making this assignment would make it an ancestor of itself.
async function wouldCreateCycle(categoryId, proposedParentId, transaction) {
  if (proposedParentId === null || proposedParentId === undefined) return false;

  const visited = new Set();
  let currentId = Number(proposedParentId);

  while (currentId) {
    if (currentId === Number(categoryId)) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const current = await Category.findByPk(currentId, {
      attributes: ['id', 'parentId'],
      transaction,
    });
    if (!current) return false;
    currentId = current.parentId;
  }

  return false;
}

function productModel() {
  try {
    // Product is intentionally optional until the Product module is added.
    return require('../models/Product');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('Product')) return null;
    throw error;
  }
}

exports.createCategory = async (req, res) => {
  try {
    const category = await sequelize.transaction(async (transaction) => {
      const name = String(req.body.name || '').trim();
      if (!name) {
        const error = new Error('name is required');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const parentId = optionalId(req.body.parentId, 'parentId') ?? null;
      const imageId = optionalId(req.body.imageId, 'imageId') ?? null;
      const slug = req.body.slug === undefined ? slugify(name) : slugify(req.body.slug);
      if (!slug) {
        const error = new Error('slug is required');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      await ensureParentExists(parentId, transaction);
      await ensureImageExists(imageId, transaction);
      return Category.create({
        name,
        slug,
        description: req.body.description ?? null,
        imageId,
        parentId,
        active: req.body.active ?? true,
        sortOrder: req.body.sortOrder ?? 0,
      }, { transaction });
    });

    return res.status(201).json(category);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return failure(res, 409, 'A category with this slug already exists', 'DUPLICATE_SLUG');
    }
    return failure(res, 400, error.message || 'Failed to create category', error.code || 'CATEGORY_CREATE_FAILED');
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Category.findAndCountAll({
      where,
      include: [{ model: Media }, { model: Category, as: 'parent' }],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
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
  } catch (_error) {
    return failure(res, 500, 'Failed to fetch categories', 'CATEGORY_LIST_FAILED');
  }
};

exports.getCategoryTree = async (_req, res) => {
  try {
    const categories = await Category.findAll({
      include: [{ model: Media }],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });
    const byId = new Map();
    const roots = [];

    categories.forEach((category) => {
      const node = { ...category.toJSON(), children: [] };
      byId.set(node.id, node);
    });

    byId.forEach((node) => {
      const parent = node.parentId ? byId.get(node.parentId) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });

    return res.json(roots);
  } catch (_error) {
    return failure(res, 500, 'Failed to fetch category tree', 'CATEGORY_TREE_FAILED');
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id, {
      include: [{ model: Media }, { model: Category, as: 'parent' }],
    });
    if (!category) return failure(res, 404, 'Category not found', 'CATEGORY_NOT_FOUND');
    return res.json(category);
  } catch (_error) {
    return failure(res, 500, 'Failed to fetch category', 'CATEGORY_FETCH_FAILED');
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await sequelize.transaction(async (transaction) => {
      const current = await Category.findByPk(req.params.id, { transaction });
      if (!current) {
        const error = new Error('Category not found');
        error.code = 'CATEGORY_NOT_FOUND';
        error.status = 404;
        throw error;
      }

      const updates = {};
      for (const field of ['name', 'description', 'active', 'sortOrder']) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
        updates.name = String(req.body.name || '').trim();
        if (!updates.name) {
          const error = new Error('name cannot be empty');
          error.code = 'VALIDATION_ERROR';
          throw error;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'slug')) {
        updates.slug = slugify(req.body.slug);
        if (!updates.slug) {
          const error = new Error('slug cannot be empty');
          error.code = 'VALIDATION_ERROR';
          throw error;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'imageId')) {
        updates.imageId = optionalId(req.body.imageId, 'imageId');
        await ensureImageExists(updates.imageId, transaction);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'parentId')) {
        updates.parentId = optionalId(req.body.parentId, 'parentId');
        await ensureParentExists(updates.parentId, transaction);
        if (await wouldCreateCycle(current.id, updates.parentId, transaction)) {
          const error = new Error('This would create a circular reference');
          error.code = 'CIRCULAR_REFERENCE';
          throw error;
        }
      }

      await current.update(updates, { transaction });
      return current;
    });

    return res.json(category);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return failure(res, 409, 'A category with this slug already exists', 'DUPLICATE_SLUG');
    }
    return failure(res, error.status || 400, error.message || 'Failed to update category', error.code || 'CATEGORY_UPDATE_FAILED');
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return failure(res, 404, 'Category not found', 'CATEGORY_NOT_FOUND');

    const childrenCount = await Category.count({ where: { parentId: category.id } });
    const Product = productModel();
    const productCount = Product ? await Product.count({ where: { categoryId: category.id } }) : 0;

    // Preserve referential integrity: categories with children or products are never reassigned or cascade-deleted.
    if (childrenCount || productCount) {
      const references = [];
      if (childrenCount) references.push(`${childrenCount} child ${childrenCount === 1 ? 'category' : 'categories'}`);
      if (productCount) references.push(`${productCount} ${productCount === 1 ? 'product' : 'products'}`);
      return failure(res, 409, `Cannot delete category because it has ${references.join(' and ')}`, 'CATEGORY_IN_USE');
    }

    await category.destroy();
    return res.json({ message: 'Category deleted successfully' });
  } catch (_error) {
    return failure(res, 500, 'Failed to delete category', 'CATEGORY_DELETE_FAILED');
  }
};

exports.wouldCreateCycle = wouldCreateCycle;
