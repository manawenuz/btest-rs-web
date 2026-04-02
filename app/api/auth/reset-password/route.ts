import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isEmailEnabled } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  token: z.string().length(64),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  if (!isEmailEnabled()) {
    return NextResponse.json(
      { error: 'Password reset is not configured on this instance.' },
      { status: 501 }
    );
  }

  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await rateLimit(`reset:${ip}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 422 }
      );
    }

    const { token, password } = parsed.data;
    const tokenHash = hashToken(token);
    const sql = getDb();

    // Find valid, unused, non-expired token
    const [resetToken] = await sql`
      SELECT id, user_id FROM password_reset_tokens
      WHERE token_hash = ${tokenHash}
        AND used = FALSE
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    // Update password
    const newHash = await hashPassword(password);
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${resetToken.user_id}`;

    // Mark token as used
    await sql`UPDATE password_reset_tokens SET used = TRUE WHERE id = ${resetToken.id}`;

    return NextResponse.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
