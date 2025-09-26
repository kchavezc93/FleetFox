import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth-actions';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ role: null }, { status: 200, headers: { 'cache-control': 'no-store' } });
  return NextResponse.json({ role: user.role, username: user.username, email: user.email }, { status: 200, headers: { 'cache-control': 'no-store' } });
}
