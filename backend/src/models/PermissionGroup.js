const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PermissionGroup = sequelize.define('PermissionGroup', {
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
}, {
  tableName: 'permission_groups',
  timestamps: true,
});

module.exports = PermissionGroup;
