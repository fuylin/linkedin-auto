import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

export async function middleware(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/accounts/:path*', '/analytics/:path*', '/billing/:path*', '/calendar/:path*', '/posts/:path*', '/schedule/:path*', '/templates/:path*'],
};
