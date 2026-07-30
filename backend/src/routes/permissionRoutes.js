const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const requirePermission = require('../middleware/requirePermission');

router.get('/', requirePermission('permission:read'), permissionController.listPermissions);
router.post('/', requirePermission('permission:create'), permissionController.createGroup);
router.put('/:groupId', requirePermission('permission:update'), permissionController.updateGroup);
router.delete('/:id', requirePermission('permission:delete'), permissionController.deletePermission);

module.exports = router;
