import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { getDb } from '@/lib/db';
import { isEmailEnabled, sendPasswordResetEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
});

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  if (!isEmailEnabled()) {
    return NextResponse.json(
      { error: 'Password reset is not configured on this instance. Contact the administrator.' },
      { status: 501 }
    );
  }

  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await rateLimit(`forgot:${ip}`, {
      maxRequests: 5,
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
        { error: 'Invalid email address' },
        { status: 422 }
      );
    }

    const { email } = parsed.data;
    const sql = getDb();

    // Always return success to prevent email enumeration
    const [user] = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (!user) {
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Invalidate any existing unused tokens for this user
    await sql`
      UPDATE password_reset_tokens SET used = TRUE
      WHERE user_id = ${user.id} AND used = FALSE
    `;

    // Generate token: 32 random bytes → 64 hex chars
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
    `;

    // Build reset URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || `https://${request.headers.get('host')}`;
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(email, resetUrl);

    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
