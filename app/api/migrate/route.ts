import { NextRequest, NextResponse } from 'next/server';
import { migrate } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Only allow if the x-migrate-secret header matches MIGRATE_SECRET env var,
    // or if MIGRATE_SECRET is not configured (initial setup convenience).
    const migrateSecret = process.env.MIGRATE_SECRET;
    if (migrateSecret) {
      const providedSecret = request.headers.get('x-migrate-secret');
      if (providedSecret !== migrateSecret) {
        return NextResponse.json(
          { error: 'Unauthorized: invalid or missing migration secret' },
          { status: 403 }
        );
      }
    }

    await migrate();

    return NextResponse.json({
      success: true,
      message: 'Database migrated successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
