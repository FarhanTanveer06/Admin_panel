const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Role = require('../models/Role');

exports.getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const role = req.query.role ? String(req.query.role).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : '';

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      where.roleId = role;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{ model: Role }],
    });

    res.json({
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { roleId, password, ...rest } = req.body;

    if (!roleId) {
      return res.status(400).json({ message: 'roleId is required' });
    }

    const payload = { ...rest, roleId };
    if (password) {
      payload.password = await bcrypt.hash(password, 10);
    }
    payload.active = payload.active ?? true;
    payload.status = payload.status || 'active';

    const user = await User.create(payload);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create user' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (String(req.user.id) === String(req.params.id) && Object.prototype.hasOwnProperty.call(req.body, 'roleId')) {
      return res.status(403).json({ message: 'You cannot change your own role' });
    }

    const allowedFields = ['name', 'email', 'phone', 'gender', 'avatar', 'roleId', 'active', 'status'];
    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'password') && req.body.password) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }

    await user.update(updates);
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
};
