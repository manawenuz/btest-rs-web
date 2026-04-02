import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest, generateApiKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const sql = getDb();
    const [user] = await sql`
      SELECT api_key FROM users WHERE id = ${auth.userId} LIMIT 1
    `;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ api_key: user.api_key });
  } catch (error) {
    console.error('Get API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only allow JWT authentication for key regeneration, not API key auth.
    // This prevents a leaked API key from being used to regenerate itself.
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify this came from a JWT, not an API key
    const authHeader = request.headers.get('authorization') ?? '';
    const cookieToken = request.cookies.get('token')?.value;
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookieToken;

    if (token && token.startsWith('btk_')) {
      return NextResponse.json(
        { error: 'API key regeneration requires JWT authentication, not API key' },
        { status: 403 }
      );
    }

    const newApiKey = generateApiKey();
    const sql = getDb();

    const [updated] = await sql`
      UPDATE users
      SET api_key = ${newApiKey}
      WHERE id = ${auth.userId}
      RETURNING api_key
    `;

    if (!updated) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ api_key: updated.api_key });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
