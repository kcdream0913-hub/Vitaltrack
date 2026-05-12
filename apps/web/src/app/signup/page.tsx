'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data:        { full_name: name },
        emailRedirectTo: `${location.origin}/auth/callback?next=/`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleGoogleSignup() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${location.origin}/auth/callback?next=/` },
    })
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(30,111,217,0.1)' }}
          >
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;ve sent a confirmation link to <strong className="text-gray-700">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-semibold hover:underline"
            style={{ color: '#1E6FD9' }}
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Branding panel ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1E6FD9 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white font-bold text-lg">VT</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">VitalTrack</span>
        </div>

        {/* Hero copy */}
        <div className="mt-12">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Start your<br />health journey.
          </h1>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Join thousands of users who trust VitalTrack to manage their health data securely.
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-3 mt-auto pt-12">
          {[
            { icon: '🆓', text: 'Free forever — no credit card needed' },
            { icon: '📊', text: 'Real-time vital sign tracking' },
            { icon: '💊', text: 'Smart medication reminders' },
            { icon: '🔒', text: 'End-to-end encrypted & HIPAA compliant' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
              <span className="text-base">{f.icon}</span>
              <span className="text-sm">{f.text}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Trusted by patients and clinicians worldwide.
        </p>
      </div>

      {/* ── Right: Signup form ────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#1E6FD9' }}
            >
              <span className="text-white font-bold text-sm">VT</span>
            </div>
            <span className="font-bold text-gray-900">VitalTrack</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
          <p className="text-sm text-gray-500 mt-1">Free forever — no credit card required</p>

          {/* Google SSO */}
          <button
            onClick={handleGoogleSignup}
            type="button"
            className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Jane Smith"
                autoComplete="name"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-colors min-h-[44px]"
                onFocus={e => { e.currentTarget.style.borderColor = '#1E6FD9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,111,217,0.15)' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-colors min-h-[44px]"
                onFocus={e => { e.currentTarget.style.borderColor = '#1E6FD9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,111,217,0.15)' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-colors min-h-[44px]"
                onFocus={e => { e.currentTarget.style.borderColor = '#1E6FD9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,111,217,0.15)' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                <span className="text-red-500 text-sm shrink-0">⚠</span>
                <p className="text-xs text-red-600 leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
              style={{ backgroundColor: '#1E6FD9' }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1a5fbd' }}
              onMouseOut={e  => { e.currentTarget.style.backgroundColor = '#1E6FD9' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account…
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            By signing up you agree to our{' '}
            <span className="underline cursor-default">Terms</span>
            {' & '}
            <span className="underline cursor-default">Privacy Policy</span>
          </p>

          <p className="mt-5 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: '#1E6FD9' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
