const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const activity = require('./activityService');
const { toUserLite, USER_LITE_SELECT } = require('./boardFormat');

const toClient = (c) => ({
  id: c.id,
  name: c.name,
  company: c.company,
  email: c.email,
  phone: c.phone,
  notes: c.notes,
  archivedAt: c.archivedAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  ...(c._count ? { projectCount: c._count.projects } : {}),
});

const PROJECT_COUNT = { _count: { select: { projects: { where: { archivedAt: null } } } } };

const listClients = async ({ q, archived } = {}) => {
  const where = { archivedAt: archived === 'true' || archived === true ? { not: null } : null };
  if (q && String(q).trim()) {
    const term = String(q).trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { company: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }
  const clients = await prisma.client.findMany({ where, include: PROJECT_COUNT, orderBy: { name: 'asc' } });
  return clients.map(toClient);
};

const getClient = async (id) => {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      ...PROJECT_COUNT,
      projects: {
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { owner: USER_LITE_SELECT },
      },
    },
  });
  if (!client) throwError('Client not found', 404);
  return {
    ...toClient(client),
    projects: client.projects.map((p) => ({
      id: p.id, name: p.name, description: p.description, clientId: p.clientId, status: p.status,
      startDate: p.startDate, deadline: p.deadline, ownerId: p.ownerId, owner: toUserLite(p.owner),
      archivedAt: p.archivedAt, createdAt: p.createdAt, updatedAt: p.updatedAt,
    })),
  };
};

const createClient = async (data, actorId) => {
  const client = await prisma.client.create({ data: { ...data, createdById: actorId }, include: PROJECT_COUNT });
  await activity.log({ type: 'client.created', actorId, data: { clientId: client.id, name: client.name } });
  return toClient(client);
};

const updateClient = async (id, data) => {
  const existing = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throwError('Client not found', 404);
  const client = await prisma.client.update({ where: { id }, data, include: PROJECT_COUNT });
  return toClient(client);
};

const archiveClient = async (id) => {
  const existing = await prisma.client.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
  if (!existing) throwError('Client not found', 404);
  const client = await prisma.client.update({
    where: { id },
    data: { archivedAt: existing.archivedAt || new Date() },
    include: PROJECT_COUNT,
  });
  return toClient(client);
};

module.exports = { listClients, getClient, createClient, updateClient, archiveClient, toClient };
