import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'btest-rs-web',
    version: process.env.npm_package_version || '0.1.0',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.GIT_COMMIT || 'dev',
    ref: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    deployed: process.env.VERCEL_URL || 'local',
  });
}
