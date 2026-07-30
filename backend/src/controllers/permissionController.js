const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const PermissionGroup = require('../models/PermissionGroup');
const Permission = require('../models/Permission');

function normalizeActionName(action) {
  if (typeof action !== 'string') {
    throw new Error('Permission action must be a string');
  }

  const trimmed = action.trim().toLowerCase();
  if (!trimmed) {
    throw new Error('Permission action is required');
  }

  if (/\s/.test(trimmed) || trimmed.includes(':')) {
    throw new Error('Permission action cannot contain spaces or colons');
  }

  return trimmed;
}

function buildPermissionName(groupName, actionName) {
  const normalizedGroupName = String(groupName).trim().toLowerCase();

  if (!normalizedGroupName) {
    throw new Error('Permission group name is required');
  }

  if (/\s/.test(normalizedGroupName)) {
    throw new Error('Permission group name cannot contain spaces');
  }

  return `${normalizedGroupName}:${normalizeActionName(actionName)}`;
}

async function detachPermissionFromRoles(permission) {
  const roles = await permission.getRoles();
  if (roles.length > 0) {
    await permission.removeRoles(roles);
  }
}

exports.listPermissions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = req.query.search ? String(req.query.search).trim() : '';
    const offset = (page - 1) * limit;

    const groups = await PermissionGroup.findAll({
      include: [{ model: Permission, order: [['name', 'ASC']] }],
      order: [['name', 'ASC']],
    });

    const filteredGroups = groups.filter((group) => {
      if (!search) return true;
      const term = search.toLowerCase();
      const groupText = `${group.name} ${group.description || ''}`.toLowerCase();
      const permissionText = (group.Permissions || []).map((permission) => permission.name).join(' ').toLowerCase();
      return groupText.includes(term) || permissionText.includes(term);
    });

    const paginatedGroups = filteredGroups.slice(offset, offset + limit);

    res.json({
      items: paginatedGroups,
      page,
      limit,
      total: filteredGroups.length,
      totalPages: Math.max(1, Math.ceil(filteredGroups.length / limit)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch permissions', error: error.message });
  }
};

exports.createGroup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, description, actions = [] } = req.body;
    const trimmedName = String(name || '').trim();

    if (!trimmedName) {
      throw new Error('Permission group name is required');
    }

    const group = await PermissionGroup.create({ name: trimmedName, description }, { transaction });
    const permissionNames = (Array.isArray(actions) ? actions : []).map((action) => buildPermissionName(group.name, action));

    if (permissionNames.length > 0) {
      await Permission.bulkCreate(permissionNames.map((permissionName) => ({
        name: permissionName,
        description: `${permissionName.split(':')[1]} access`,
        groupId: group.id,
      })), { transaction });
    }

    await transaction.commit();
    res.status(201).json(group);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: 'Failed to create permission group', error: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const group = await PermissionGroup.findByPk(req.params.groupId, {
      include: [{ model: Permission }],
      transaction,
    });

    if (!group) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Permission group not found' });
    }

    const { description, actions } = req.body;
    const updates = {};

    if (description !== undefined) {
      updates.description = description;
    }

    if (Object.keys(updates).length > 0) {
      await group.update(updates, { transaction });
    }

    if (Array.isArray(actions)) {
      const targetActions = actions.map((action) => normalizeActionName(action));
      const existingPermissions = group.Permissions || [];
      const currentActions = new Set(existingPermissions.map((permission) => permission.name.split(':')[1]));

      const actionsToAdd = targetActions.filter((action) => !currentActions.has(action));
      const actionsToRemove = [...currentActions].filter((action) => !targetActions.includes(action));

      if (actionsToAdd.length > 0) {
        const createdPermissions = actionsToAdd.map((action) => ({
          name: buildPermissionName(group.name, action),
          description: `${action} access`,
          groupId: group.id,
        }));
        await Permission.bulkCreate(createdPermissions, { transaction });
      }

      if (actionsToRemove.length > 0) {
        const permissionsToDelete = existingPermissions.filter((permission) => actionsToRemove.includes(permission.name.split(':')[1]));
        for (const permission of permissionsToDelete) {
          await detachPermissionFromRoles(permission);
          await permission.destroy({ transaction });
        }
      }
    }

    await transaction.commit();
    const refreshedGroup = await PermissionGroup.findByPk(req.params.groupId, {
      include: [{ model: Permission, order: [['name', 'ASC']] }],
      order: [['name', 'ASC']],
    });
    res.json(refreshedGroup);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: 'Failed to update permission group', error: error.message });
  }
};

exports.deletePermission = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const permission = await Permission.findByPk(req.params.id, { transaction });
    if (!permission) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Permission not found' });
    }

    await detachPermissionFromRoles(permission);
    await permission.destroy({ transaction });
    await transaction.commit();

    res.json({ message: 'Permission deleted successfully. Role permissions were removed as part of the delete.' });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: 'Failed to delete permission', error: error.message });
  }
};

exports.listGroups = exports.listPermissions;
