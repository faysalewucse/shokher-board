const prisma = require('../lib/prisma');

const SINGLETON_KEY = 'app_config';

const UPDATABLE_FIELDS = [
  'supportEmail',
  'supportNumbers',
  'maintenanceMode',
  'maintenanceMessage',
  'registrationEnabled',
];

const getOrCreateConfig = async () => {
  let config = await prisma.config.findUnique({ where: { key: SINGLETON_KEY } });
  if (!config) config = await prisma.config.create({ data: { key: SINGLETON_KEY } });
  return config;
};

const getConfig = async () => {
  const config = await getOrCreateConfig();
  return { config };
};

const updateConfig = async (updates) => {
  await getOrCreateConfig();

  const data = {};
  UPDATABLE_FIELDS.forEach((key) => {
    if (updates[key] !== undefined) data[key] = updates[key];
  });

  const updated = await prisma.config.update({ where: { key: SINGLETON_KEY }, data });
  return { config: updated };
};

module.exports = { getConfig, updateConfig, getOrCreateConfig };
