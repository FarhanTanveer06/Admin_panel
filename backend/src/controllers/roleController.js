const { sequelize } = require('../config/database');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const User = require('../models/User');

exports.listRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({ include: [Permission], order: [['name', 'ASC']] });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
};

exports.createRole = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const role = await Role.create(req.body, { transaction });

    if (req.body.permissionIds) {
      await role.setPermissions(req.body.permissionIds, { transaction });
    }

    await transaction.commit();
    res.status(201).json(role);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: 'Failed to create role' });
  }
};

exports.updateRole = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const role = await Role.findByPk(req.params.id, { transaction });
    if (!role) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Role not found' });
    }

    const permissionIds = req.body.permissionIds;

    if (Array.isArray(permissionIds)) {
      const hasRoleUpdatePermission = permissionIds.includes('role:update') || permissionIds.includes(1);
      const currentPermissions = await role.getPermissions({ transaction });
      const currentlyHasRoleUpdate = currentPermissions.some((permission) => permission.name === 'role:update');

      if (currentlyHasRoleUpdate && !hasRoleUpdatePermission) {
        const otherRolesWithRoleUpdate = await Role.findAll({
          include: [{ model: Permission, where: { name: 'role:update' } }],
          transaction,
        });

        const otherRoles = otherRolesWithRoleUpdate.filter((otherRole) => otherRole.id !== role.id);
        if (otherRoles.length === 0) {
          await transaction.rollback();
          return res.status(400).json({ message: 'Cannot remove role:update from the only role that holds it' });
        }
      }
    }

    await role.update(req.body, { transaction });

    if (permissionIds) {
      await role.setPermissions(permissionIds, { transaction });
    }

    await transaction.commit();
    res.json(role);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: 'Failed to update role' });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const assignedUserCount = await User.count({ where: { roleId: role.id } });
    if (assignedUserCount > 0) {
      return res.status(409).json({ message: 'Cannot delete a role that is still assigned to users' });
    }

    await role.destroy();
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Failed to delete role' });
  }
};
