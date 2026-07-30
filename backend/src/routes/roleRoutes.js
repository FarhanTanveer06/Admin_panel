const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const requirePermission = require('../middleware/requirePermission');

router.get('/', requirePermission('role:read'), roleController.listRoles);
router.post('/', requirePermission('role:create'), roleController.createRole);
router.put('/:id', requirePermission('role:update'), roleController.updateRole);
router.delete('/:id', requirePermission('role:delete'), roleController.deleteRole);

module.exports = router;
