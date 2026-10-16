const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const { isValidPermission } = require('../constants/permissions');

// 'all' is a legacy wildcard token kept in some seeded roles (e.g. admin). It
// has no maskIndex, so it never survives JWT encoding and is functionally dead.
// Drop it on save so it stops failing validation and self-cleans from the DB.
const LEGACY_PERMISSION_TOKENS = new Set(['all']);
const sanitizePermissions = (permissions = []) =>
  permissions.filter((p) => !LEGACY_PERMISSION_TOKENS.has(p));

const getAllRoles = async () => {
  const roles = await prisma.role.findMany({ orderBy: { index: 'asc' } });
  return { roles };
};

const getRoleById = async (id) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throwError('Role not found', 404);
  return { role };
};

const createRole = async ({ name, description, permissions = [], isDefault = false }) => {
  const existing = await prisma.role.findUnique({ where: { name: name.toLowerCase().trim() } });
  if (existing) throwError('Role name already exists', 409);

  permissions = sanitizePermissions(permissions);
  const invalid = permissions.filter((p) => !isValidPermission(p));
  if (invalid.length) throwError(`Invalid permissions: ${invalid.join(', ')}`, 400);

  if (isDefault) {
    await prisma.role.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  const role = await prisma.role.create({
    data: { name: name.toLowerCase().trim(), description, permissions, isDefault },
  });
  return { role };
};

const updateRole = async (id, { name, description, permissions, isDefault }) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throwError('Role not found', 404);

  const data = {};

  if (name !== undefined) {
    const duplicate = await prisma.role.findFirst({
      where: { name: name.toLowerCase().trim(), id: { not: id } },
    });
    if (duplicate) throwError('Role name already exists', 409);
    data.name = name.toLowerCase().trim();
  }

  if (permissions !== undefined) {
    permissions = sanitizePermissions(permissions);
    const invalid = permissions.filter((p) => !isValidPermission(p));
    if (invalid.length) throwError(`Invalid permissions: ${invalid.join(', ')}`, 400);
    data.permissions = permissions;
  }

  if (description !== undefined) data.description = description;

  if (isDefault === true) {
    await prisma.role.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
    data.isDefault = true;
  } else if (isDefault === false) {
    data.isDefault = false;
  }

  const updated = await prisma.role.update({ where: { id }, data });
  return { role: updated };
};

const deleteRole = async (id) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throwError('Role not found', 404);

  const usersWithRole = await prisma.user.count({ where: { roleId: id } });
  if (usersWithRole > 0) {
    throwError(`Cannot delete role — ${usersWithRole} user(s) are assigned to it`, 400);
  }

  await prisma.role.delete({ where: { id } });
};

module.exports = { getAllRoles, getRoleById, createRole, updateRole, deleteRole };
