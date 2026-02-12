import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('lynia-auth-active');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
