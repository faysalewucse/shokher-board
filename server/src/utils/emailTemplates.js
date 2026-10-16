const baseTemplate = ({ title, previewText, content }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f4f6f9;">${previewText}</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1d4ed8;border-radius:12px 12px 0 0;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ${process.env.MAIL_FROM_NAME || 'ShokherBoard'}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                This email was sent by ${process.env.MAIL_FROM_NAME || 'ShokherBoard'}. If you did not request this, you can safely ignore it.
              </p>
              <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;">
                &copy; ${new Date().getFullYear()} ${process.env.MAIL_FROM_NAME || 'ShokherBoard'}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const otpBlock = (otp) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" style="background-color:#eff6ff;border:1px dashed #bfdbfe;border-radius:10px;padding:24px;">
        <p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Your one-time code</p>
        <p style="margin:0;color:#1d4ed8;font-size:36px;font-weight:800;letter-spacing:10px;font-family:monospace;">${otp}</p>
        <p style="margin:10px 0 0;color:#9ca3af;font-size:12px;">Expires in <strong>10 minutes</strong></p>
      </td>
    </tr>
  </table>
`;

const verificationEmail = (otp) =>
  baseTemplate({
    title: 'Verify your email address',
    previewText: `Your verification code is ${otp} — expires in 10 minutes.`,
    content: `
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Verify your email address</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
        Thanks for signing up! Use the code below to verify your email address and activate your account.
      </p>

      ${otpBlock(otp)}

      <p style="margin:20px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
        If you didn't create an account, no action is needed — this code will expire automatically.
      </p>
    `,
  });

const passwordResetEmail = (otp) =>
  baseTemplate({
    title: 'Reset your password',
    previewText: `Your password reset code is ${otp} — expires in 10 minutes.`,
    content: `
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Reset your password</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
        We received a request to reset your password. Use the code below to proceed. If you didn't make this request, you can safely ignore this email.
      </p>

      ${otpBlock(otp)}

      <p style="margin:20px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
        For your security, this code is valid for one use only and will expire in 10 minutes.
      </p>
    `,
  });

module.exports = {
  baseTemplate,
  verificationEmail,
  passwordResetEmail,
};
