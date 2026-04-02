import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { hashPassword, createToken, generateApiKey } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success, remaining } = await rateLimit(`register:${ip}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'X-RateLimit-Remaining': String(remaining) },
        }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      );
    }

    const { email, password } = parsed.data;
    const sql = getDb();

    // Check email uniqueness
    const existing =
      await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const apiKey = generateApiKey();
    const [user] = await sql`
      INSERT INTO users (email, password_hash, api_key)
      VALUES (${email}, ${passwordHash}, ${apiKey})
      RETURNING id, email, api_key, created_at
    `;

    const token = await createToken(user.id);

    const response = NextResponse.json(
      { token, api_key: user.api_key },
      { status: 201 }
    );
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
