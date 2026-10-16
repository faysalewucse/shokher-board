// All available permissions
// Key = used in code & stored in DB, Value = human-readable description for the ShokherBoard portal
// maskIndex = bit position for compact JWT bitmask encoding
// This is the single source of truth — roles are dynamic and stored in the database (Role.permissions)
// maskIndex values are sparse on purpose: keep existing bits stable so issued
// tokens keep decoding correctly, and pick unused bits for new permissions.
const PERMISSIONS = {
  // User management (bits 0–19)
  USER_READ_OWN: { maskIndex: 0, description: 'View own profile and account details' },
  USER_READ_ANY: { maskIndex: 1, description: 'View any user profile and list all users' },
  USER_CREATE: { maskIndex: 2, description: 'Create new user accounts' },
  USER_UPDATE_OWN: { maskIndex: 3, description: 'Edit own profile, password, and avatar' },
  USER_UPDATE_ANY: { maskIndex: 4, description: 'Edit any user profile and account details' },
  USER_DELETE_OWN: { maskIndex: 5, description: 'Delete own account permanently' },
  USER_DELETE_ANY: { maskIndex: 6, description: 'Delete any user account permanently' },
  USER_ASSIGN_ROLE: { maskIndex: 7, description: 'Assign or change a role for any user' },

  // Role management (bits 20–29)
  ROLE_READ: { maskIndex: 20, description: 'View all roles and their permissions' },
  ROLE_CREATE: { maskIndex: 21, description: 'Create new roles with selected permissions' },
  ROLE_UPDATE: { maskIndex: 22, description: 'Edit role name, description, and permissions' },
  ROLE_DELETE: { maskIndex: 23, description: 'Delete roles permanently' },

  // Permission management (bits 30–39)
  PERMISSION_READ: { maskIndex: 30, description: 'View all available permissions' },
  PERMISSION_ASSIGN: { maskIndex: 31, description: 'Assign permissions to roles' },
  PERMISSION_REVOKE: { maskIndex: 32, description: 'Revoke permissions from roles' },

  // Clients, Projects & Boards (bits 40–49)
  CLIENT_READ: { maskIndex: 40, description: 'View clients' },
  CLIENT_MANAGE: { maskIndex: 41, description: 'Create, edit and archive clients' },
  PROJECT_READ: { maskIndex: 42, description: 'View projects' },
  PROJECT_MANAGE: { maskIndex: 43, description: 'Create, edit and archive projects' },
  BOARD_CREATE: { maskIndex: 44, description: 'Create new boards' },
  BOARD_MANAGE_ANY: { maskIndex: 45, description: 'See and manage every board, regardless of membership' },

  // Settings & System (bits 90–99)
  SETTINGS_READ: { maskIndex: 90, description: 'View application settings' },
  SETTINGS_UPDATE: { maskIndex: 91, description: 'Modify application settings' },
  SYSTEM_MANAGE: { maskIndex: 94, description: 'Access system logs, storage stats, and maintenance tools', superAdminOnly: true },
  AUDIT_READ: { maskIndex: 97, description: 'View audit logs of admin actions' },

  // Portal Access (bits 130–135)
  PORTAL_ACCESS: { maskIndex: 130, description: 'Access to the ShokherBoard portal/dashboard' },

  // Notifications (bits 146–150)
  NOTIFICATION_SEND: { maskIndex: 149, description: 'Send a notification to a specific user' },
};

// Grouped for portal display (when creating/editing roles)
const PERMISSION_GROUPS = {
  'User Management': [
    'USER_READ_OWN',
    'USER_READ_ANY',
    'USER_CREATE',
    'USER_UPDATE_OWN',
    'USER_UPDATE_ANY',
    'USER_DELETE_OWN',
    'USER_DELETE_ANY',
    'USER_ASSIGN_ROLE',
  ],
  'Role Management': [
    'ROLE_READ',
    'ROLE_CREATE',
    'ROLE_UPDATE',
    'ROLE_DELETE',
  ],
  'Permission Management': [
    'PERMISSION_READ',
    'PERMISSION_ASSIGN',
    'PERMISSION_REVOKE',
  ],
  'Clients & Projects': [
    'CLIENT_READ',
    'CLIENT_MANAGE',
    'PROJECT_READ',
    'PROJECT_MANAGE',
  ],
  'Boards': [
    'BOARD_CREATE',
    'BOARD_MANAGE_ANY',
  ],
  'Settings & System': [
    'SETTINGS_READ',
    'SETTINGS_UPDATE',
    'SYSTEM_MANAGE',
    'AUDIT_READ',
  ],
  'Portal Access': [
    'PORTAL_ACCESS',
  ],
  'Notifications': [
    'NOTIFICATION_SEND',
  ],
};

// Every permission needs its own JWT bit — two keys on one maskIndex silently
// grant each other (decode returns both). Fail fast at boot instead.
{
  const seen = new Map();
  for (const [key, { maskIndex }] of Object.entries(PERMISSIONS)) {
    if (seen.has(maskIndex)) {
      throw new Error(`Permission maskIndex ${maskIndex} is shared by ${seen.get(maskIndex)} and ${key} — give each its own bit`);
    }
    seen.set(maskIndex, key);
  }
}

// All permission keys as a flat array
const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

// Validate if a permission key is valid
const isValidPermission = (key) => key in PERMISSIONS;

/**
 * Encode an array of permission keys into a bitmask string
 * e.g. ['USER_READ_OWN', 'ROLE_READ'] → "1048577"
 * @param {string[]} permissionKeys - Array of permission keys
 * @returns {string} - Bitmask as string (BigInt-safe)
 */
const encodePermissions = (permissionKeys) => {
  let mask = BigInt(0);
  for (const key of permissionKeys) {
    const perm = PERMISSIONS[key];
    if (perm) {
      mask |= BigInt(1) << BigInt(perm.maskIndex);
    }
  }
  return mask.toString();
};

/**
 * Decode a bitmask string back into an array of permission keys
 * e.g. "1048577" → ['USER_READ_OWN', 'ROLE_READ']
 * @param {string} maskStr - Bitmask as string
 * @returns {string[]} - Array of permission keys
 */
const decodePermissions = (maskStr) => {
  const mask = BigInt(maskStr);
  const keys = [];
  for (const [key, { maskIndex }] of Object.entries(PERMISSIONS)) {
    if (mask & (BigInt(1) << BigInt(maskIndex))) {
      keys.push(key);
    }
  }
  return keys;
};

module.exports = {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  isValidPermission,
  encodePermissions,
  decodePermissions,
};
