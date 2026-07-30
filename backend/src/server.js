const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const roleRoutes = require('./routes/roleRoutes');
const userRoutes = require('./routes/userRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const authMiddleware = require('./middleware/auth');
const seed = require('./seed');
const path = require('path');

dotenv.config();

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 5001);

app.use(cors({
  origin: ['http://localhost:3000', 'https://admin-panel-du3f.onrender.com'],
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/permissions', authMiddleware, permissionRoutes);
app.use('/api/roles', authMiddleware, roleRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/media', authMiddleware, mediaRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);

async function startServer(port = DEFAULT_PORT) {
  try {
    await initializeDatabase();
    await seed();
    console.log('Database connected successfully.');

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const nextPort = port + 1;
        console.warn(`Port ${port} is already in use. Trying ${nextPort}...`);
        server.close();
        startServer(nextPort);
      } else {
        console.error('Unable to start server:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

startServer();
