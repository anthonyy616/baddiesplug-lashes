import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loginAdmin, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '@/lib/admin-auth';

const schema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please enter a username and password.' }, { status: 400 });
    }

    const result = await loginAdmin(parsed.data.username, parsed.data.password);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, result.cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: '/',
    });
    return response;
  } catch (error) {
    // Surface configuration problems clearly in server logs
    if (error instanceof Error && error.message.includes('SESSION_SECRET')) {
      console.error('Admin login misconfigured: SESSION_SECRET is not set');
      return NextResponse.json(
        { error: 'Server configuration error: SESSION_SECRET is not set.' },
        { status: 500 }
      );
    }
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
