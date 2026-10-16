# Permissions

Base path: `/permissions`

Permissions are static constants defined in `src/constants/permissions.js`. Roles (stored in the database) hold arrays of permission keys. On login, a role's permissions are encoded as a bitmask (`p` claim) in the JWT using each permission's `maskIndex`, and decoded on every request by the `authenticate` middleware.

Routes are protected with `authorize('KEY', ...)` (all required) or `authorizeAny('KEY', ...)` (any one).

> **maskIndex values are stable.** Never reuse or change a bit for an existing permission — issued tokens would decode to the wrong permissions. Pick an unused bit for new permissions; the module throws at boot if two keys share a bit.

---

## GET `/permissions`

**Permission:** `PERMISSION_READ`

Returns all permissions grouped by category (used by an admin UI when editing roles).

```json
{
  "success": true,
  "message": "Permissions fetched",
  "data": {
    "groups": {
      "User Management": [
        { "key": "USER_READ_OWN", "description": "View own profile and account details" }
      ],
      "Role Management": [ "..." ]
    }
  }
}
```

---

## Permission reference

| Group | Key | Bit | Used by |
|-------|-----|-----|---------|
| **User** | `USER_READ_OWN` | 0 | — (own profile routes need only authentication) |
| | `USER_READ_ANY` | 1 | `GET /users`, `GET /users/:id` |
| | `USER_CREATE` | 2 | `POST /users` |
| | `USER_UPDATE_OWN` | 3 | — |
| | `USER_UPDATE_ANY` | 4 | `PATCH /users/:id` |
| | `USER_DELETE_OWN` | 5 | — |
| | `USER_DELETE_ANY` | 6 | `DELETE /users/:id` |
| | `USER_ASSIGN_ROLE` | 7 | `PATCH /users/:id/assign-role` |
| **Role** | `ROLE_READ` | 20 | `GET /roles`, `GET /roles/:id` |
| | `ROLE_CREATE` | 21 | `POST /roles` |
| | `ROLE_UPDATE` | 22 | `PATCH /roles/:id` |
| | `ROLE_DELETE` | 23 | `DELETE /roles/:id` |
| **Permission** | `PERMISSION_READ` | 30 | `GET /permissions` |
| | `PERMISSION_ASSIGN` | 31 | — |
| | `PERMISSION_REVOKE` | 32 | — |
| **Settings & System** | `SETTINGS_READ` | 90 | `GET /config` |
| | `SETTINGS_UPDATE` | 91 | `PATCH /config` |
| | `SYSTEM_MANAGE` | 94 | `/admin/*`, `DELETE /notifications/cleanup` |
| | `AUDIT_READ` | 97 | `/audit-logs/*` |
| **Portal** | `PORTAL_ACCESS` | 130 | — (for a frontend portal gate) |
| **Notifications** | `NOTIFICATION_SEND` | 149 | `POST /users/:id/send-notification`, `POST /notifications/broadcast` |
