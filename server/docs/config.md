# Config

Base path: `/config`

App configuration is a singleton row (`key = "app_config"`), created automatically on first read.

---

## GET `/config/public`

No authentication. Returns non-sensitive fields for public clients.

```json
{
  "success": true,
  "message": "Config fetched successfully",
  "data": {
    "supportEmail":        "support@example.com",
    "supportNumbers":      ["+1 555 0100"],
    "maintenanceMode":     false,
    "maintenanceMessage":  null,
    "registrationEnabled": true
  }
}
```

---

## GET `/config`

**Permission:** `SETTINGS_READ`

Returns the full config row (`id`, `key`, the fields below, `createdAt`, `updatedAt`).

---

## PATCH `/config`

**Permission:** `SETTINGS_UPDATE`

Partial update — only provided fields change.

```json
{
  "supportEmail":        "support@example.com",
  "supportNumbers":      ["+1 555 0100", "+1 555 0101"],
  "maintenanceMode":     true,
  "maintenanceMessage":  "We'll be back in 30 minutes.",
  "registrationEnabled": false
}
```

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `supportEmail` | string | email, nullable | Contact email shown to users |
| `supportNumbers` | string[] | digits / spaces / `+ - ( )` | Support phone numbers |
| `maintenanceMode` | boolean | — | Maintenance flag for clients to honour |
| `maintenanceMessage` | string | nullable | Message shown during maintenance |
| `registrationEnabled` | boolean | — | When `false`, `POST /auth/register` returns `403` |

**Response `200`:** `{ "success": true, "message": "Config updated successfully", "data": { ...config } }`

---

## Adding fields

1. Add the column to `prisma/schema/config.prisma` and create a migration (`npx prisma migrate dev`).
2. Add the key to `UPDATABLE_FIELDS` in `src/services/configService.js`.
3. Add validation in `src/validations/configValidation.js`.
4. Expose it in `getPublicConfig` (`src/controllers/configController.js`) if it is safe to make public.
