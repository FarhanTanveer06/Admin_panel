const { Sequelize } = require('sequelize');
const { Client } = require('pg');
require('dotenv').config();

const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: false,
});

async function initializeDatabase() {
  const adminClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

    if (result.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } finally {
    await adminClient.end();
  }

  await sequelize.authenticate();

  const PermissionGroup = require('../models/PermissionGroup');
  const Permission = require('../models/Permission');
  const Role = require('../models/Role');
  const User = require('../models/User');
  require('../models/Media');
  require('../models/Category');

  await PermissionGroup.sync({ alter: true });
  await Permission.sync({ alter: true });
  await Role.sync({ alter: true });

  const [columnRows] = await sequelize.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'roleId'
  `);

  if (columnRows.length === 0) {
    await sequelize.query('ALTER TABLE "users" ADD COLUMN "roleId" INTEGER');
  }

  const [defaultRole] = await Role.findOrCreate({
    where: { name: 'User' },
    defaults: { description: 'Default user role' },
  });

  await User.update({ roleId: defaultRole.id }, { where: { roleId: null } });
  await sequelize.query(`ALTER TABLE "users" ALTER COLUMN "roleId" SET DEFAULT ${defaultRole.id}`);

  await sequelize.sync({ alter: true });
}

module.exports = { sequelize, initializeDatabase };
