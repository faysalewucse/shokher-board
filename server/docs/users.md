# Users

Base path: `/users`

All endpoints require authentication (`Authorization: Bearer <token>`). Responses never include `password` or token hashes.

---

## Self-service

### GET `/users/me`

Current user plus their permissions.

```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "user": {
      "id":              "cm5kcud7w00003b6qaysmfqvz",
      "name":            "John Doe",
      "email":           "john@example.com",
      "phone":           "+1 555 0100",
      "avatar":          "/uploads/avatars/photo-1700000000000-123456789.jpg",
      "role":            { "id": "...", "name": "admin" },
      "status":          "active",
      "isEmailVerified": true,
      "lastLoginAt":     "2024-01-15T10:30:00.000Z",
      "createdAt":       "2024-01-01T00:00:00.000Z"
    },
    "permissions": ["USER_READ_OWN", "USER_UPDATE_OWN"]
  }
}
```

### PATCH `/users/me`

```json
{ "name": "John Updated", "phone": "+1 555 0101" }
```

### PATCH `/users/me/password`

```json
{ "currentPassword": "secret123", "newPassword": "newsecret456" }
```

`400` if `currentPassword` is wrong.

### POST `/users/me/avatar`

`multipart/form-data` with an image in the `avatar` field (JPEG/PNG/WEBP/GIF, max 25 MB). Stored under `uploads/avatars/` and served at `/uploads/avatars/<file>`. The returned `avatar` is a relative path; prepend the API host on the client. The previous local avatar file is deleted.

---

## Administration

### GET `/users`

**Permission:** `USER_READ_ANY`

| Query | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `10` | Items per page |
| `search` | — | Name, email or phone (case-insensitive) |
| `status` | — | `active` \| `inactive` \| `suspended` \| `pending` |
| `role` | — | Role id |
| `dateFrom`, `dateTo` | — | `createdAt` range (`YYYY-MM-DD`, inclusive) |

Response: `data: [user, ...]`, `meta: { total, page, limit, totalPages }`.

### GET `/users/:id`

**Permission:** `USER_READ_ANY` — `data: { user }` (role includes permissions).

### POST `/users`

**Permission:** `USER_CREATE` — the account is pre-verified and `active` unless `status` is given.

```json
{
  "name":     "Jane Smith",
  "email":    "jane@example.com",
  "password": "secret123",
  "phone":    "+1 555 0102",
  "role":     "<roleId>",
  "status":   "active"
}
```

### PATCH `/users/:id`

**Permission:** `USER_UPDATE_ANY` — any of `name`, `phone`, `status`, `role` (role id or `null`).

### DELETE `/users/:id`

**Permission:** `USER_DELETE_ANY` — hard delete. The user's notifications are removed and audit-log entries keep the row with `actorId = null`. You cannot delete yourself.

### PATCH `/users/:id/assign-role`

**Permission:** `USER_ASSIGN_ROLE`

```json
{ "roleId": "<roleId>" }
```

Pass `null` to unassign. You cannot change your own role.

### POST `/users/:id/send-notification`

**Permission:** `NOTIFICATION_SEND` — creates an in-app notification for the user (pushed in real time over Socket.IO).

```json
{ "title": "Hello", "body": "Your account was reviewed.", "actionUrl": "/profile" }
```

---

## Error responses

| Status | Meaning |
|--------|---------|
| `400` | Validation error or self-operation restriction |
| `401` | Missing or invalid token |
| `403` | Insufficient permissions |
| `404` | User or role not found |
| `409` | Email already registered |
