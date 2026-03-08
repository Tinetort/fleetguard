import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient} from '@supabase/ssr'

// Routes that don't require authentication
// API routes handle their own auth (return 401 JSON instead of redirect)
const publicRoutes = ['/login', '/_next', '/api', '/favicon.ico', '/images', '/forgot-password', '/reset-password', '/auth/callback', '/manifest.json', '/icon-192x192.png', '/icon-512x512.png']
const managerOnlyRoutes = ['/dashboard']
const emtOnlyRoutes = ['/rig-check', '/end-of-shift']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for completely public assets and API
  if (publicRoutes.some(route => pathname.startsWith(route) || pathname === '/')) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Still need to refresh Supabase session for public routes
    return await updateSession(request)
  }

  // Create response and Supabase client
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch role + temp_password from profile
  const { data: profile } = await supabase
    .from('users')
    .select('role, temp_password')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    // User exists in auth but no profile yet — send to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = profile.role
  const temp_password = profile.temp_password

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
      return NextResponse.redirect(new URL('/rig-check', request.url))
    }
  }

  if (emtOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (!['emt', 'paramedic', 'nurse'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

// Helper to refresh Supabase session on public routes
async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js).*)',
  ],
}
