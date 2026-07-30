const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const PermissionGroup = require('./PermissionGroup');

const normalizePermissionName = (value) => {
  if (typeof value !== 'string') {
    throw new Error('Permission name must be a string');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Permission name is required');
  }

  if (/\s/.test(trimmed)) {
    throw new Error('Permission name cannot contain spaces');
  }

  return trimmed.toLowerCase();
};

const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  groupId: { type: DataTypes.INTEGER, allowNull: false, references: { model: PermissionGroup, key: 'id' } },
}, {
  tableName: 'permissions',
  timestamps: true,
  hooks: {
    beforeValidate: (permission) => {
      if (permission.name !== undefined) {
        permission.name = normalizePermissionName(permission.name);
      }
    },
  },
});

PermissionGroup.hasMany(Permission, { foreignKey: 'groupId', onDelete: 'CASCADE' });
Permission.belongsTo(PermissionGroup, { foreignKey: 'groupId' });

module.exports = Permission;
