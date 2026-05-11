'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type Severity = 'info' | 'warning' | 'critical' | 'success'

interface AlertBannerProps {
  severity:   Severity
  title:      string
  message?:   string
  dismissible?: boolean
  action?:    { label: string; onClick: () => void }
  className?: string
}

const SEVERITY_STYLES: Record<Severity, { container: string; icon: string; title: string }> = {
  success:  {
    container: 'bg-secondary-50 border-secondary-200',
    icon:      '✓',
    title:     'text-secondary-800',
  },
  info:     {
    container: 'bg-primary-50 border-primary-200',
    icon:      'ℹ',
    title:     'text-primary-800',
  },
  warning:  {
    container: 'bg-warning-50 border-warning-200',
    icon:      '⚠',
    title:     'text-warning-800',
  },
  critical: {
    container: 'bg-accent-50 border-accent-200',
    icon:      '!',
    title:     'text-accent-800',
  },
}

const DOT_COLORS: Record<Severity, string> = {
  success:  'bg-secondary-500',
  info:     'bg-primary-500',
  warning:  'bg-warning-500',
  critical: 'bg-accent-500',
}

export function AlertBanner({
  severity = 'info',
  title,
  message,
  dismissible = true,
  action,
  className,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const styles = SEVERITY_STYLES[severity]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        styles.container,
        className,
      )}
    >
      {/* Icon / dot */}
      <div className={cn('mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white', DOT_COLORS[severity])}>
        {severity === 'critical' && (
          <span className="absolute w-5 h-5 rounded-full animate-ping opacity-50" style={{ backgroundColor: 'currentColor' }} />
        )}
        {styles.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', styles.title)}>{title}</p>
        {message && <p className="text-xs text-neutral-600 mt-0.5">{message}</p>}
        {action && (
          <button
            onClick={action.onClick}
            className={cn('mt-1.5 text-xs font-medium underline', styles.title)}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss alert"
          className="text-neutral-400 hover:text-neutral-600 transition-colors flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  )
}
