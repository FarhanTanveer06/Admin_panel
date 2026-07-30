const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  storedPath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  publicUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('image', 'video'),
    allowNull: false,
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  contentHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  thumbnailPath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  altText: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  uploadedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: 'id' },
  },
}, {
  tableName: 'media',
  timestamps: true,
});

User.hasMany(Media, { foreignKey: 'uploadedBy' });
Media.belongsTo(User, { foreignKey: 'uploadedBy' });

module.exports = Media;
