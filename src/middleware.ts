import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-smart-rig-check-mvp'
const key = new TextEncoder().encode(secretKey)

async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    return null
  }
}

// Define public and protected route patterns
const publicRoutes = ['/login', '/_next', '/api', '/favicon.ico', '/images']
const managerOnlyRoutes = ['/dashboard']
const emtOnlyRoutes = ['/rig-check', '/end-of-shift']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for completely public assets and API
  if (publicRoutes.some(route => pathname.startsWith(route) || pathname === '/')) {
    // If user goes to root '/' redirect them to login directly
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // Check auth for protected routes
  const sessionToken = request.cookies.get('session')?.value
  const session = sessionToken ? await decrypt(sessionToken) : null

  // Not authenticated
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based authorization
  const role = session.role
  const temp_password = session.temp_password

  // Force password change if temp_password is true
  if (temp_password && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url))
  }

  // Prevent users from accessing /change-password if they don't have a temp password
  if (!temp_password && pathname === '/change-password') {
    if (role === 'manager' || role === 'director') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/rig-check', request.url))
  }

  // Directors can access manager routes AND /dashboard/users
  if (managerOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (role !== 'manager' && role !== 'director') {
      return NextResponse.redirect(new URL('/rig-check', request.url)) // Redirect EMTs back
    }
  }

  if (emtOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (!['emt', 'paramedic', 'nurse'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url)) // Redirect managers/directors back
    }
  }

  return NextResponse.next()
}

// Configure matcher to run middleware on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
