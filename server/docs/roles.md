# Roles

Base path: `/roles`

All endpoints require authentication (`Authorization: Bearer <token>`).

Roles are dynamic and stored in the database (`Role` table). Each role holds an array of permission keys. One role can be marked `isDefault: true` — it is assigned to newly registered users. `npm run seed:roles` creates:

| Role | Permissions | Default |
|------|-------------|---------|
| `admin` | all permissions | no |
| `user` | `USER_READ_OWN`, `USER_UPDATE_OWN`, `CLIENT_READ`, `PROJECT_READ`, `BOARD_CREATE` | yes |

Role names are stored lowercase. Permission changes take effect on the user's next login (permissions live in the JWT).

---

## GET `/roles`

**Permission:** `ROLE_READ` — lists roles ordered by `index`.

```json
{
  "success": true,
  "message": "Roles fetched successfully",
  "data": [
    {
      "id":          "cm5kcud7w00003b6qaysmfqvz",
      "name":        "admin",
      "description": "Full system access",
      "permissions": ["USER_READ_ANY", "USER_CREATE", "..."],
      "isDefault":   false,
      "index":       1,
      "createdAt":   "2024-01-01T00:00:00.000Z",
      "updatedAt":   "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## GET `/roles/:id`

**Permission:** `ROLE_READ` — `data: { role }`, `404` if not found.

---

## POST `/roles`

**Permission:** `ROLE_CREATE`

```json
{
  "name":        "editor",
  "description": "Can manage users",
  "permissions": ["USER_READ_ANY", "USER_UPDATE_ANY"],
  "isDefault":   false
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | required, 2–50 chars, unique |
| `description` | string | optional, max 200 chars |
| `permissions` | string[] | optional — valid permission keys only |
| `isDefault` | boolean | optional — if `true`, unsets any existing default role |

**Response `201`:** `data: { role }`. `409` if the name exists, `400` for invalid permission keys.

---

## PATCH `/roles/:id`

**Permission:** `ROLE_UPDATE` — same fields as create, all optional.

---

## DELETE `/roles/:id`

**Permission:** `ROLE_DELETE` — fails with `400` if any users are assigned to the role.

---

## Error responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid permission keys or users still assigned |
| `401` | Missing or invalid token |
| `403` | Insufficient permissions |
| `404` | Role not found |
| `409` | Role name already exists |
