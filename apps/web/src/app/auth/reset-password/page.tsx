'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Stage = 'idle' | 'loading' | 'success' | 'error'

export default function ResetPasswordPage() {
  const [email,  setEmail]  = useState('')
  const [stage,  setStage]  = useState<Stage>('idle')
  const [errMsg, setErrMsg] = useState('')

  const uid        = useId()
  const emailId    = `${uid}-email`
  const errorDescId = `${uid}-email-error`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setErrMsg('Please enter your email address.')
      setStage('error')
      return
    }

    setStage('loading')
    setErrMsg('')

    const supabase = createClient()
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : '/auth/callback'

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    if (error) {
      setErrMsg(error.message)
      setStage('error')
    } else {
      setStage('success')
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 w-full max-w-sm p-8">

        {/* Back to login */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors mb-6 min-h-[44px] -ml-1 px-1"
          aria-label="Back to login page"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to login
        </Link>

        {/* Logo / brand */}
        <div className="mb-6">
          <span className="text-xl font-bold text-[#1E6FD9] tracking-tight">VitalTrack</span>
        </div>

        {stage === 'success' ? (
          /* ── Success state ── */
          <div className="text-center py-4">
            <CheckCircle
              className="w-12 h-12 text-green-500 mx-auto mb-4"
              aria-hidden="true"
            />
            <h1 className="text-lg font-bold text-[#0F172A] mb-2">Check your email</h1>
            <p className="text-sm text-neutral-500 leading-relaxed">
              We&apos;ve sent a password reset link to{' '}
              <strong className="text-neutral-800">{email}</strong>.
              {' '}Follow the link in the email to choose a new password.
            </p>
            <p className="text-xs text-neutral-400 mt-4">
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button
                onClick={() => setStage('idle')}
                className="text-[#1E6FD9] underline hover:text-blue-800 transition-colors"
              >
                try again
              </button>.
            </p>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <h1 className="text-xl font-bold text-[#0F172A] mb-1">Reset your password</h1>
            <p className="text-sm text-neutral-500 mb-6">
              Enter your account email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor={emailId}
                  className="block text-xs font-medium text-neutral-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (stage === 'error') setStage('idle') }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-required="true"
                  aria-describedby={stage === 'error' ? errorDescId : undefined}
                  aria-invalid={stage === 'error' ? 'true' : undefined}
                  className={cn(
                    'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent transition-colors',
                    stage === 'error' ? 'border-red-400 bg-red-50' : 'border-neutral-200',
                  )}
                />

                {stage === 'error' && errMsg && (
                  <div
                    id={errorDescId}
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs text-red-600"
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    {errMsg}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={stage === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-[#1E6FD9] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                aria-label={stage === 'loading' ? 'Sending reset link…' : 'Send reset link'}
              >
                {stage === 'loading' && (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                )}
                {stage === 'loading' ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
