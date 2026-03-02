import nodemailer from 'nodemailer';

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.in",
  port: 465,
  secure: true,
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASSWORD,
  },
});

export async function sendCredentialsEmail(
  toEmail: string,
  name: string,
  username: string,
  password: string
): Promise<boolean> {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.error('[Email] SMTP credentials not configured');
    return false;
  }

  try {
    const mailOptions = {
      from: `"WhatsApp Business API" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: 'Your WhatsApp Business API Dashboard Login Credentials',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">WhatsApp Business API Dashboard</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0;">Welcome, ${name}!</h2>
            
            <p style="color: #4b5563;">Your account has been created successfully. Here are your login credentials:</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Username:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Password:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${password}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> Please keep these credentials secure and do not share them with anyone. We recommend changing your password after your first login.
              </p>
            </div>
            
            <p style="color: #4b5563;">If you have any questions or need assistance, please contact your administrator.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from WhatsApp Business API Dashboard. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to WhatsApp Business API Dashboard!

Hi ${name},

Your account has been created successfully. Here are your login credentials:

Username: ${username}
Password: ${password}

Important: Please keep these credentials secure and do not share them with anyone. We recommend changing your password after your first login.

If you have any questions or need assistance, please contact your administrator.

This is an automated message. Please do not reply to this email.
      `.trim()
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Credentials sent successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send credentials email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  name: string,
  username: string,
  newPassword: string
): Promise<boolean> {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.error('[Email] SMTP credentials not configured');
    return false;
  }

  try {
    const mailOptions = {
      from: `"WhatsApp Business API" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: 'Your Password Has Been Reset - WhatsApp Business API Dashboard',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">WhatsApp Business API Dashboard</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0;">Password Reset</h2>
            
            <p style="color: #4b5563;">Hi ${name}, your password has been reset by an administrator. Here are your new login credentials:</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Username:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">New Password:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${newPassword}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> Please keep these credentials secure. We recommend changing your password after logging in.
              </p>
            </div>
            
            <p style="color: #4b5563;">If you did not request this password reset, please contact your administrator immediately.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from WhatsApp Business API Dashboard. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset - WhatsApp Business API Dashboard

Hi ${name},

Your password has been reset by an administrator. Here are your new login credentials:

Username: ${username}
New Password: ${newPassword}

Important: Please keep these credentials secure. We recommend changing your password after logging in.

If you did not request this password reset, please contact your administrator immediately.

This is an automated message. Please do not reply to this email.
      `.trim()
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset email sent successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    return false;
  }
}

export async function sendPasswordResetLinkEmail(
  toEmail: string,
  name: string,
  resetLink: string,
  expiryMinutes = 15
): Promise<boolean> {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.error('[Email] SMTP credentials not configured');
    return false;
  }

  try {
    const mailOptions = {
      from: `"WhatsApp Business API" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: 'Reset Your Password - WhatsApp Business API Dashboard',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">WhatsApp Business API Dashboard</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0;">Reset your password</h2>
            <p style="color: #4b5563;">Hi ${name}, we received a request to reset your password.</p>
            <p style="color: #4b5563;">Use the button below to set a new password. This link will expire in ${expiryMinutes} minutes.</p>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
                Reset Password
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">If the button does not work, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #111827; font-size: 13px;">${resetLink}</p>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 20px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Reset your password

Hi ${name},

We received a request to reset your password.
Use the link below to set a new password (expires in ${expiryMinutes} minutes):
${resetLink}

If you did not request this change, you can ignore this email.
      `.trim(),
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset link sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset link email:', error);
    return false;
  }
}
