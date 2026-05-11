import { cn } from '@/lib/utils'

type Status = 'normal' | 'high' | 'low' | 'critical' | 'optimal' | 'pending' | 'no-data'

interface StatusChipProps {
  status: Status
  className?: string
}

const config: Record<Status, { bg: string; text: string; label: string; dot: string }> = {
  normal:   { bg: 'bg-secondary-100', text: 'text-secondary-700', label: 'Normal',   dot: 'bg-secondary-500' },
  high:     { bg: 'bg-accent-100',    text: 'text-accent-700',    label: 'High',     dot: 'bg-accent-500'    },
  low:      { bg: 'bg-warning-100',   text: 'text-warning-700',   label: 'Low',      dot: 'bg-warning-500'   },
  critical: { bg: 'bg-accent-50',     text: 'text-accent-800',    label: 'Critical', dot: 'bg-accent-500'    },
  optimal:  { bg: 'bg-primary-50',    text: 'text-primary-700',   label: 'Optimal',  dot: 'bg-primary-500'   },
  pending:  { bg: 'bg-neutral-100',   text: 'text-neutral-600',   label: 'Pending',  dot: 'bg-neutral-400'   },
  'no-data':{ bg: 'bg-neutral-100',   text: 'text-neutral-400',   label: 'No data',  dot: 'bg-neutral-300'   },
}

export function StatusChip({ status, className }: StatusChipProps) {
  const cfg = config[status]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
      cfg.bg, cfg.text, className,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot,
        status === 'critical' && 'animate-pulse')} />
      {cfg.label}
    </span>
  )
}
