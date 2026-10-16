const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const activity = require('./activityService');
const { canManageAny } = require('./boardAccess');
const { USER_LITE_SELECT, toUserLite, BOARD_INCLUDE, toBoard } = require('./boardFormat');

const PROJECT_INCLUDE = {
  client: { select: { id: true, name: true } },
  owner: USER_LITE_SELECT,
  _count: { select: { boards: { where: { archivedAt: null } } } },
};

const toProject = (p, progress) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  clientId: p.clientId,
  client: p.client ? { id: p.client.id, name: p.client.name } : null,
  status: p.status,
  startDate: p.startDate,
  deadline: p.deadline,
  ownerId: p.ownerId,
  owner: toUserLite(p.owner),
  archivedAt: p.archivedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  boardCount: p._count?.boards ?? 0,
  ...(progress ? { progress } : {}),
});

/** progress = { total, done } over active cards on active boards of each project. */
const getProgress = async (projectIds) => {
  const result = Object.fromEntries(projectIds.map((id) => [id, { total: 0, done: 0 }]));
  if (!projectIds.length) return result;
  const rows = await prisma.$queryRaw`
    SELECT b."projectId" AS "projectId",
           COUNT(c.id)::int AS total,
           COUNT(c."completedAt")::int AS done
      FROM cards c
      JOIN boards b ON b.id = c."boardId"
      JOIN lists l ON l.id = c."listId"
     WHERE b."projectId" = ANY(${projectIds})
       AND c."archivedAt" IS NULL
       AND l."archivedAt" IS NULL
       AND b."archivedAt" IS NULL
     GROUP BY b."projectId"`;
  rows.forEach((r) => { result[r.projectId] = { total: r.total, done: r.done }; });
  return result;
};

const assertClient = async (clientId) => {
  if (!clientId) return;
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!c) throwError('Client not found', 400);
};

const assertUser = async (userId) => {
  if (!userId) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!u) throwError('Owner not found', 400);
};

const listProjects = async ({ clientId, status, q, archived } = {}) => {
  const where = { archivedAt: archived === 'true' || archived === true ? { not: null } : null };
  if (clientId) where.clientId = String(clientId);
  if (status) where.status = String(status);
  if (q && String(q).trim()) {
    const term = String(q).trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ];
  }
  const projects = await prisma.project.findMany({ where, include: PROJECT_INCLUDE, orderBy: { createdAt: 'desc' } });
  const progress = await getProgress(projects.map((p) => p.id));
  return projects.map((p) => toProject(p, progress[p.id]));
};

const getProject = async (id, { userId, permissions }) => {
  const project = await prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
  if (!project) throwError('Project not found', 404);

  const manageAny = canManageAny(permissions);
  const boards = await prisma.board.findMany({
    where: { projectId: id, archivedAt: null, ...(manageAny ? {} : { members: { some: { userId } } }) },
    include: { ...BOARD_INCLUDE, members: { where: { userId }, select: { role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const progress = await getProgress([id]);

  return {
    ...toProject(project, progress[id]),
    boards: boards.map((b) => toBoard(b, manageAny ? 'owner' : b.members[0]?.role || null)),
  };
};

const createProject = async (data, actorId) => {
  await assertClient(data.clientId);
  await assertUser(data.ownerId);
  const project = await prisma.project.create({
    data: { ...data, ownerId: data.ownerId || actorId },
    include: PROJECT_INCLUDE,
  });
  await activity.log({ type: 'project.created', projectId: project.id, actorId, data: { name: project.name } });
  return toProject(project, { total: 0, done: 0 });
};

const updateProject = async (id, data, actorId) => {
  const existing = await prisma.project.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throwError('Project not found', 404);
  if (data.clientId !== undefined) await assertClient(data.clientId);
  if (data.ownerId !== undefined) await assertUser(data.ownerId);

  const project = await prisma.project.update({ where: { id }, data, include: PROJECT_INCLUDE });
  if (data.status !== undefined && data.status !== existing.status) {
    await activity.log({
      type: 'project.status_changed', projectId: id, actorId, data: { from: existing.status, to: data.status },
    });
  }
  const progress = await getProgress([id]);
  return toProject(project, progress[id]);
};

const archiveProject = async (id) => {
  const existing = await prisma.project.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
  if (!existing) throwError('Project not found', 404);
  const project = await prisma.project.update({
    where: { id },
    data: { archivedAt: existing.archivedAt || new Date() },
    include: PROJECT_INCLUDE,
  });
  return toProject(project);
};

module.exports = { listProjects, getProject, createProject, updateProject, archiveProject };
