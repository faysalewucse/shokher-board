require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Seeds the initial admin account from ADMIN_* env vars (see .env.example).
const ADMIN = {
  name:     process.env.ADMIN_NAME     || 'Admin',
  email:    (process.env.ADMIN_EMAIL   || 'admin@example.com').toLowerCase().trim(),
  password: process.env.ADMIN_PASSWORD || 'admin123456',
};

const seedUsers = async () => {
  try {
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    if (!adminRole) {
      console.error('No "admin" role found. Run "npm run seed:roles" first.');
      await prisma.$disconnect();
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(ADMIN.password, 10);
    const data = {
      name: ADMIN.name,
      password: passwordHash,
      roleId: adminRole.id,
      status: 'active',
      isEmailVerified: true,
    };

    const existing = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data });
      console.log(`✓ Updated admin user: ${ADMIN.email}`);
    } else {
      await prisma.user.create({ data: { ...data, email: ADMIN.email } });
      console.log(`✓ Created admin user: ${ADMIN.email}`);
    }

    if (!process.env.ADMIN_PASSWORD) {
      console.warn('⚠ ADMIN_PASSWORD not set — using the default password. Change it before deploying.');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
};

seedUsers();
