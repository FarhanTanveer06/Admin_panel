const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requirePermission = require('../middleware/requirePermission');

router.get('/', requirePermission('user:read'), userController.getAllUsers);
router.post('/', requirePermission('user:create'), userController.createUser);
router.get('/:id', requirePermission('user:read'), userController.getUserById);
router.put('/:id', requirePermission('user:update'), userController.updateUser);
router.delete('/:id', requirePermission('user:delete'), userController.deleteUser);

module.exports = router;
