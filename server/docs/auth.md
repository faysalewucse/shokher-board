# Auth

Base path: `/auth`

All endpoints except `/auth/logout` are public. Rate limiting is applied per endpoint (per IP).

Authentication is a stateless JWT (`Authorization: Bearer <token>`), valid for `JWT_EXPIRES_IN` (default `7d`). The token carries the user's permissions as a compact bitmask (see [permissions.md](./permissions.md)).

---

## POST `/auth/register`

Register a new account and send a 6-digit verification OTP by email. New accounts get the role flagged `isDefault: true` (the seeded `user` role). Returns `403` if `registrationEnabled` is `false` in [config](./config.md).

**Rate limit:** 5 requests / hour

**Request body:**
```json
{
  "name":     "John Doe",
  "email":    "john@example.com",
  "password": "secret123",
  "phone":    "+1 555 0100"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | required, 2–50 chars |
| `email` | string | required, valid email |
| `password` | string | required, min 6 chars |
| `phone` | string | optional, digits / spaces / `+ - ( )` |

Re-registering an email that exists but is still unverified overwrites the pending account and sends a new OTP.

**Response `201`:** `{ "success": true, "message": "Registration successful. ...", "data": { "user": { ... } } }`

---

## POST `/auth/verify-email`

Verify the email with the OTP. Activates the account (`status: "active"`).

**Rate limit:** 10 requests / 15 min

```json
{ "email": "john@example.com", "otp": "482910" }
```

**Response `200`:** `{ "success": true, "message": "Email verified successfully. You can now log in.", "data": { "status": "active" } }`

---

## POST `/auth/resend-verification`

**Rate limit:** 3 requests / hour

```json
{ "email": "john@example.com" }
```

Always responds `200` (does not reveal whether the email exists).

---

## POST `/auth/login`

**Rate limit:** 10 requests / 15 min

```json
{ "email": "john@example.com", "password": "secret123" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id":              "cm5kcud7w00003b6qaysmfqvz",
      "name":            "John Doe",
      "email":           "john@example.com",
      "role":            { "id": "...", "name": "admin" },
      "status":          "active",
      "isEmailVerified": true
    },
    "permissions": ["USER_READ_OWN", "USER_UPDATE_OWN"]
  }
}
```

Fails with `401` on bad credentials and `403` if the account is not `active` or the email is unverified.

---

## POST `/auth/logout`

**Auth required.** JWTs are stateless, so the client simply discards its token; this endpoint exists as a hook for future server-side revocation.

---

## POST `/auth/forgot-password`

**Rate limit:** 3 requests / hour

```json
{ "email": "john@example.com" }
```

Always responds `200`. If the account exists, a 6-digit reset OTP is emailed (valid 10 minutes).

---

## POST `/auth/reset-password`

**Rate limit:** 5 requests / 15 min

```json
{ "email": "john@example.com", "otp": "193847", "password": "newpassword123" }
```

---

## Error responses

| Status | Meaning |
|--------|---------|
| `400` | Validation error, invalid/expired OTP |
| `401` | Invalid credentials |
| `403` | Account inactive, email unverified, or registration disabled |
| `409` | Email already registered |
| `429` | Rate limit exceeded |
| `503` | Email could not be sent (SMTP error) |
