import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    return NextResponse.json({ user: session?.user || null });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
