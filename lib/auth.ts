import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { getDb } from './db';

const JWT_SECRET = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET());
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export function generateApiKey(): string {
  return 'btk_' + randomBytes(16).toString('hex');
}

/**
 * Extract authenticated user ID from request.
 * Supports Bearer JWT, Bearer API key (btk_ prefix), and cookie-based JWT.
 */
export async function authenticateRequest(
  request: Request
): Promise<
  { userId: string; error?: never } | { userId?: never; error: string; status: number }
> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fall back to cookie-based JWT
    const cookie = request.headers.get('cookie');
    if (cookie) {
      const tokenMatch = cookie.match(/token=([^;]+)/);
      if (tokenMatch) {
        const userId = await verifyToken(tokenMatch[1]);
        if (userId) return { userId };
      }
    }
    return { error: 'Missing authorization', status: 401 };
  }

  const token = authHeader.slice(7);

  // API key authentication
  if (token.startsWith('btk_')) {
    const sql = getDb();
    const result = await sql`SELECT id FROM users WHERE api_key = ${token}`;
    if (result.length === 0) {
      return { error: 'Invalid API key', status: 401 };
    }
    return { userId: result[0].id };
  }

  // JWT authentication
  const userId = await verifyToken(token);
  if (!userId) {
    return { error: 'Invalid or expired token', status: 401 };
  }
  return { userId };
}
