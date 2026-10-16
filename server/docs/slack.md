# Slack integration

**Every ShokherBoard user can connect their own Slack workspace to their account.** Each person does this from **Profile → Connected apps → Connect Slack** and can connect more than one workspace. Admins can see and remove every connection in **Settings → Integrations**.

It uses Slack OAuth v2 ("Add to Slack") with both token types:

| Stored in | Token | What it's for |
|---|---|---|
| `slack_workspaces` (one row per Slack team, shared) | **Bot token** (`xoxb-…`) | ShokherBoard's bot in that workspace: posting to channels, listing users and channels |
| `slack_connections` (one row per user per team) | **User token** (`xoxp-…`) | Acting as that person: their identity, posting as them |

Both tokens are encrypted at rest (AES-256-GCM) and the API never returns them.
- When a person **disconnects**, only their user token is revoked.
- When the **last** ShokherBoard user disconnects from a workspace, the bot token is revoked too and the workspace row is deleted.

One person leaving never breaks Slack for their teammates.

## 1. Create the Slack app (admin, one time)

1. Go to <https://api.slack.com/apps>, click **Create New App**, choose **From scratch**, name it `ShokherBoard`, and pick any workspace you own. That workspace is only the app's "home"; other workspaces can install it too.
2. Under **Basic Information → App Credentials**, copy the **Client ID** and **Client Secret**.
3. Under **OAuth & Permissions → Redirect URLs**, add:
   ```
   https://<your-api-domain>/api/v1/integrations/slack/callback
   ```
   Slack only accepts **HTTPS**. For local testing, use a tunnel (ngrok or Cloudflare Tunnel).
4. Under **OAuth & Permissions → Scopes**:
   - **Bot Token Scopes:** `chat:write`, `chat:write.public`, `channels:read`, `groups:read`, `users:read`, `users:read.email`, `team:read`
   - **User Token Scopes:** `users:read`, `users:read.email`, `chat:write`
5. **To let people connect workspaces other than the app's home workspace:** go to **Manage Distribution**, complete the checklist and click **Activate Public Distribution**. Without this, only members of the app's home workspace can connect. This doesn't list the app in the Slack Marketplace.
6. Optional: under **Basic Information → Display Information**, set the app name and icon people see on Slack's approval screen.

## 2. Configure the server

Add the following to `server/.env`, then restart the server:

```env
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_REDIRECT_URI=https://<your-api-domain>/api/v1/integrations/slack/callback   # exactly as in step 1.3
FRONTEND_URL=https://<your-portal-domain>          # where people return after connecting (/profile)
ENCRYPTION_KEY=<64 hex chars>                      # encrypts stored Slack tokens
# Optional overrides (comma-separated):
# SLACK_SCOPES=chat:write,chat:write.public,channels:read,groups:read,users:read,users:read.email,team:read
# SLACK_USER_SCOPES=users:read,users:read.email,chat:write
```

Generate `ENCRYPTION_KEY` with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Keep it stable. If it changes, stored tokens can't be decrypted and people have to reconnect.

## 3. Connect (any user)

1. Open **Profile → Connected apps** and click **Connect Slack**, or **Add workspace** if you've already connected one.
2. Pick the workspace on Slack's page and click **Allow**.
3. You're sent back to your profile and the workspace appears in the list. **Test** checks both tokens with `auth.test`. **Disconnect** removes it.

Connecting, reconnecting and disconnecting are recorded in the audit log (`SlackConnection`). Reconnecting the same workspace updates the existing row; it doesn't create a duplicate.

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/integrations/slack` | any signed-in user | `{ configured, connections[] }` for the caller (no tokens) |
| POST | `/integrations/slack/install` | any signed-in user (rate-limited) | Returns `{ url }`, the Slack authorize URL with a signed `state` (valid 10 min) |
| GET | `/integrations/slack/callback` | public (rate-limited) | Slack redirects here. Exchanges the code, stores the tokens, and redirects to `FRONTEND_URL/profile?slack=connected` or `?slack=error&reason=…` |
| POST | `/integrations/slack/connections/:id/test` | owner only | `auth.test` with the bot and user tokens |
| DELETE | `/integrations/slack/connections/:id` | owner only | Disconnect (see above) |
| GET | `/integrations/slack/admin` | SETTINGS_READ | Server setup status, plus every workspace and its connected users |
| DELETE | `/integrations/slack/admin/connections/:id` | SETTINGS_UPDATE | Remove anyone's connection |

## For future features

`src/services/slackService.js` exports:
- `getTokens(connectionId, userId)`, which returns `{ userToken, botToken, connection, workspace }`, decrypted.
- `callSlack(method, { token, body })`, which calls any Slack Web API method.

Find a user's connections with `prisma.slackConnection.findMany({ where: { userId } })`.
