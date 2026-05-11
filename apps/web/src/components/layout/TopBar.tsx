'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/analytics':    'Analytics & Insights',
  '/vitals':       'Vitals & Trends',
  '/medications':  'Medications',
  '/records':      'Medical Records',
  '/appointments': 'Appointments',
  '/reports':      'Health Reports',
  '/profile':      'Profile',
  '/settings':     'Settings',
  '/help':         'Help',
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  // Prefix match (nested routes)
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname.startsWith(route + '/')) return title
  }
  return 'VitalTrack'
}

function initials(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  const email = user.email ?? ''
  return email.slice(0, 2).toUpperCase()
}

function displayName(user: User): string {
  return (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'User'
}

export function TopBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [user,    setUser]    = useState<User | null>(null)
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    setSigning(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const title    = getPageTitle(pathname)
  const userInit = user ? initials(user) : '?'
  const userName = user ? displayName(user) : ''

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-neutral-200 bg-white flex-shrink-0">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-neutral-900 truncate">{title}</h1>

      {/* Right side: avatar + sign out */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#1E6FD9] flex items-center justify-center flex-shrink-0">
              {user.user_metadata?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.user_metadata.avatar_url as string}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xs font-semibold text-white">{userInit}</span>
              )}
            </div>
            {/* Name — hidden on small screens */}
            <span className="hidden sm:block text-sm font-medium text-neutral-700 max-w-[160px] truncate">
              {userName}
            </span>
          </div>
        )}

        {/* Sign-out button */}
        <button
          onClick={handleSignOut}
          disabled={signing}
          title="Sign out"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 rounded-lg hover:bg-neutral-100 hover:text-neutral-900 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
