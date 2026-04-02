import { NextResponse } from 'next/server';
import { isEmailEnabled } from '@/lib/email';

export async function GET() {
  return NextResponse.json({ enabled: isEmailEnabled() });
}
