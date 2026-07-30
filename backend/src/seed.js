const bcrypt = require('bcryptjs');
const PermissionGroup = require('./models/PermissionGroup');
const Permission = require('./models/Permission');
const Role = require('./models/Role');
const User = require('./models/User');

async function seed() {
  const moduleActions = [
    { module: 'Dashboard', actions: ['watch'] },
    { module: 'Permission', actions: ['watch', 'create', 'read', 'update', 'delete'] },
    { module: 'Role', actions: ['watch', 'create', 'read', 'update', 'delete'] },
    { module: 'User', actions: ['watch', 'create', 'read', 'update', 'delete'] },
    { module: 'Media', actions: ['watch', 'read', 'upload', 'write', 'delete'] },
    { module: 'Category', actions: ['watch', 'create', 'read', 'update', 'delete'] },
    { module: 'Brand', actions: ['watch', 'create', 'read', 'update', 'delete'] },
    { module: 'Attribute', actions: ['watch', 'create', 'read', 'update', 'delete'] },
    { module: 'Product', actions: ['watch', 'create', 'read', 'update', 'delete'] },
  ];

  const createdPermissions = [];

  for (const entry of moduleActions) {
    const [group] = await PermissionGroup.findOrCreate({
      where: { name: entry.module },
      defaults: { description: `${entry.module} permissions` },
    });

    for (const action of entry.actions) {
      const permissionName = `${entry.module.toLowerCase()}:${action}`;
      const [permission] = await Permission.findOrCreate({
        where: { name: permissionName },
        defaults: { description: `${action} access`, groupId: group.id },
      });
      createdPermissions.push(permission);
    }
  }

  const [superAdminRole] = await Role.findOrCreate({
    where: { name: 'Super Admin' },
    defaults: { description: 'Full access' },
  });
  await superAdminRole.setPermissions(createdPermissions.map((permission) => permission.id));

  const catalogViewerPermissions = [
    'category:watch',
    'category:read',
    'brand:watch',
    'brand:read',
    'attribute:watch',
    'attribute:read',
    'product:watch',
    'product:read',
  ];

  const catalogViewerRolePermissions = await Permission.findAll({ where: { name: catalogViewerPermissions } });
  const [catalogViewerRole] = await Role.findOrCreate({
    where: { name: 'Catalog Viewer' },
    defaults: { description: 'Restricted catalog access' },
  });
  await catalogViewerRole.setPermissions(catalogViewerRolePermissions.map((permission) => permission.id));

  const superAdminPasswordHash = await bcrypt.hash('admin123', 10);
  const [superAdminUser] = await User.findOrCreate({
    where: { email: 'admin@example.com' },
    defaults: {
      name: 'Super Admin',
      email: 'admin@example.com',
      password: superAdminPasswordHash,
      roleId: superAdminRole.id,
      active: true,
      status: 'active',
    },
  });

  if (superAdminUser.password !== superAdminPasswordHash) {
    superAdminUser.password = superAdminPasswordHash;
    superAdminUser.roleId = superAdminRole.id;
    superAdminUser.active = true;
    superAdminUser.status = 'active';
    await superAdminUser.save();
  }

  const limitedPasswordHash = await bcrypt.hash('limited123', 10);
  const [limitedUser] = await User.findOrCreate({
    where: { email: 'limited@example.com' },
    defaults: {
      name: 'Limited User',
      email: 'limited@example.com',
      password: limitedPasswordHash,
      roleId: catalogViewerRole.id,
      active: true,
      status: 'active',
    },
  });

  if (limitedUser.password !== limitedPasswordHash) {
    limitedUser.password = limitedPasswordHash;
    limitedUser.roleId = catalogViewerRole.id;
    limitedUser.active = true;
    limitedUser.status = 'active';
    await limitedUser.save();
  }

  console.log('Seeded credentials:');
  console.log('Super Admin -> admin@example.com / admin123');
  console.log('Catalog Viewer -> limited@example.com / limited123');
}

module.exports = seed;
