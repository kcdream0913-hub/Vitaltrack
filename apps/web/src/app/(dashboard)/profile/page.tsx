'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ExternalLink, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return (user.email ?? 'U').slice(0, 2).toUpperCase()
}

function getDisplayName(user: User): string {
  return (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'User'
}

function formatMemberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year:  'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
        {action}
      </div>
      <div className="px-6 py-4 space-y-4">
        {children}
      </div>
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs font-medium text-neutral-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-neutral-800 flex-1 text-right">
        {value ?? <span className="text-neutral-300 italic">Not set</span>}
      </span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-neutral-100 flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-neutral-100 rounded w-40" />
          <div className="h-4 bg-neutral-100 rounded w-56" />
          <div className="h-3 bg-neutral-100 rounded w-32" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 h-40" />
      <div className="bg-white rounded-xl border border-neutral-200 h-28" />
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [user,    setUser]    = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser()
      .then(({ data }) => setUser(data.user))
      .finally(() => setLoading(false))
  }, [])

  async function handleSignOut() {
    setSigning(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0F172A] mb-6">Profile</h1>
      <ProfileSkeleton />
    </div>
  )

  if (!user) return (
    <div className="p-8 flex items-center justify-center min-h-full">
      <p className="text-neutral-500 text-sm">Unable to load profile. Please sign in again.</p>
    </div>
  )

  const initials   = getInitials(user)
  const name       = getDisplayName(user)
  const email      = user.email ?? ''
  const memberSince = user.created_at ? formatMemberSince(user.created_at) : '—'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0F172A] mb-6">Profile</h1>

      <div className="space-y-5">

        {/* ── Header card ── */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 flex items-center gap-5">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full bg-[#1E6FD9] flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <span className="text-2xl font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-[#0F172A] truncate">{name}</p>
            <p className="text-sm text-neutral-500 truncate mt-0.5">{email}</p>
            <p className="text-xs text-neutral-400 mt-1">Member since {memberSince}</p>
          </div>
        </div>

        {/* ── Health Profile ── */}
        <SectionCard
          title="Health Profile"
          action={
            <button
              className="text-xs font-medium text-[#1E6FD9] hover:text-blue-800 transition-colors min-h-[44px] px-3 flex items-center gap-1"
              aria-label="Edit health profile"
            >
              Edit <ChevronRight className="w-3 h-3" aria-hidden="true" />
            </button>
          }
        >
          <ProfileRow label="Blood Type"        value={undefined} />
          <ProfileRow label="Date of Birth"     value={undefined} />
          <ProfileRow label="Primary Physician" value={undefined} />
        </SectionCard>

        {/* ── Account Settings ── */}
        <SectionCard title="Account Settings">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-neutral-500">Email</span>
            <span className="text-sm text-neutral-400 select-all">{email}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-neutral-500">Password</span>
            <a
              href="/auth/reset-password"
              className="text-sm text-[#1E6FD9] hover:text-blue-800 flex items-center gap-1 transition-colors min-h-[44px] py-2"
              aria-label="Go to change password page"
            >
              Change Password
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </SectionCard>

        {/* ── Danger Zone ── */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-red-700 mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-800">Sign out of VitalTrack</p>
              <p className="text-xs text-neutral-500 mt-0.5">You will be redirected to the login page.</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signing}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              aria-label="Sign out of your account"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              {signing ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
