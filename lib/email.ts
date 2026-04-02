import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'btest-rs-web <noreply@resend.dev>';

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<boolean> {
  const r = getResend();
  if (!r) return false;

  try {
    await r.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Reset your btest-rs-web password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1E1E1E; color: #FFFFFF; border-radius: 12px;">
          <h2 style="margin: 0 0 16px; color: #42A5F5;">btest-rs-web</h2>
          <p style="color: #9E9E9E; margin: 0 0 24px;">You requested a password reset. Click the button below to set a new password.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #42A5F5; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Reset Password</a>
          <p style="color: #9E9E9E; margin: 24px 0 0; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}
