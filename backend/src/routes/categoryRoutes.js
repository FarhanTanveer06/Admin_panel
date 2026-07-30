const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const requirePermission = require('../middleware/requirePermission');

router.post('/', requirePermission('category:create'), categoryController.createCategory);
router.get('/', requirePermission('category:read'), categoryController.getAllCategories);
router.get('/tree', requirePermission('category:read'), categoryController.getCategoryTree);
router.get('/:id', requirePermission('category:read'), categoryController.getCategoryById);
router.put('/:id', requirePermission('category:update'), categoryController.updateCategory);
router.delete('/:id', requirePermission('category:delete'), categoryController.deleteCategory);

module.exports = router;
