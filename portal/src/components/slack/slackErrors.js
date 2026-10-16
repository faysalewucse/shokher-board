/** Readable text for the `reason` the server puts on the redirect back to the portal. */
export const SLACK_ERROR_TEXT = {
  access_denied: "You cancelled the Slack connection.",
  invalid_state: "The connect link expired or was already used. Please try again.",
  missing_code: "Slack didn't return an authorization code. Please try again.",
  slack_invalid_code: "Slack rejected the authorization code. Please try again.",
  slack_bad_redirect_uri: "The server's Slack Redirect URL doesn't match the Slack app settings. Ask an administrator.",
  slack_invalid_client_id: "The server's Slack app ID is wrong. Ask an administrator.",
  slack_bad_client_secret: "The server's Slack app secret is wrong. Ask an administrator.",
  slack_invalid_scope: "The Slack app is missing a required permission. Ask an administrator.",
  no_bot_token: "Slack didn't issue a token. Ask an administrator to check the Slack app's scopes.",
  no_user: "Slack didn't identify your account. Please try again.",
};
