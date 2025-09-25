import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Nota: El middleware corre en Edge Runtime. Evita acceder a BD aquí.
// Solo validamos la presencia de la cookie y redirigimos si falta.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir rutas públicas y estáticos
  const publicPaths = [
    '/login',
    '/favicon.ico',
    '/_next',
    '/api/public',
  ];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar cookie de sesión
  const token = req.cookies.get('session_token')?.value;
  const permScope = req.cookies.get('perm_scope')?.value || 'standard';
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  
  // Redirección kiosk: si es "fueling-only" y no está en rutas móviles, mandarlo a /fueling/mobile
  if (permScope === 'fueling-only') {
    const allowedPrefixes = ['/fueling/mobile', '/_next', '/favicon.ico', '/api', '/forbidden'];
    const isAllowed = allowedPrefixes.some(p => pathname.startsWith(p));
    if (!isAllowed) {
      const url = req.nextUrl.clone();
      url.pathname = '/fueling/mobile';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // Si hay cookie, permitimos y la validación fuerte ocurrirá en el layout del servidor
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Proteger todas las rutas excepto activos estáticos y la página de login
    '/((?!_next|api/public|favicon.ico|login).*)',
  ],
};
