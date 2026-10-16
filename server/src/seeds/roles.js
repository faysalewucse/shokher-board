require('dotenv').config();
const prisma = require('../lib/prisma');
const { ALL_PERMISSIONS } = require('../constants/permissions');

// Base roles. Add more here (or create them at runtime via /api/v1/roles).
const ROLES = [
  {
    name: 'admin',
    description: 'Full system access',
    index: 1,
    permissions: [...ALL_PERMISSIONS],
    isDefault: false,
  },
  {
    name: 'user',
    description: 'Regular user — own profile, read clients/projects, create boards',
    index: 100,
    permissions: ['USER_READ_OWN', 'USER_UPDATE_OWN', 'CLIENT_READ', 'PROJECT_READ', 'BOARD_CREATE'],
    isDefault: true, // assigned to self-registered accounts
  },
];

// Idempotent: re-running updates existing roles in place (upsert by name), so
// newly added permissions reach roles created by earlier seeds.
const seedRoles = async () => {
  try {
    console.log('Seeding roles...');

    // Only one role may be the default
    await prisma.role.updateMany({ where: { isDefault: true }, data: { isDefault: false } });

    for (const { name, ...data } of ROLES) {
      const existing = await prisma.role.findUnique({ where: { name }, select: { id: true } });
      await prisma.role.upsert({ where: { name }, update: data, create: { name, ...data } });
      console.log(`✓ ${existing ? 'Updated' : 'Created'} role: ${name}`);
    }

    console.log(`\nRole seeding completed (${ROLES.length} roles).`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
};

seedRoles();
