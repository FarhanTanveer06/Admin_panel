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

  // Load every model so Sequelize knows about all associations before syncing
  require('../models/PermissionGroup');
  require('../models/Permission');
  require('../models/Role');
  require('../models/User');
  require('../models/RefreshToken');
  require('../models/Media');
  require('../models/Category');

  // force: true drops and recreates all tables in correct dependency order.
  // Safe right now because the database is empty / being reset.
  // TODO: change back to { alter: true } once tables exist and you have real data to preserve.
  await sequelize.sync({ force: true });

  console.log('All tables synced successfully.');
}

module.exports = { sequelize, initializeDatabase };