const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Permission = require('./Permission');

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'roles',
  timestamps: true,
});

Role.belongsToMany(Permission, { through: 'role_permissions', timestamps: false });
Permission.belongsToMany(Role, { through: 'role_permissions', timestamps: false });

module.exports = Role;
