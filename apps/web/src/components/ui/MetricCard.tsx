'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatMetricValue, getMetricColor, getMetricUnit } from '@/lib/utils'
import { Sparkline } from './Sparkline'

interface MetricCardProps {
  title: string
  type: string
  value?: number
  secondaryValue?: number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  lastLogged?: string
  data?: number[]
  status?: 'normal' | 'high' | 'low' | 'critical'
  icon: React.ReactNode
  onClick?: () => void
  loading?: boolean
}

const statusConfig = {
  normal:   { label: 'Normal',   bg: 'bg-secondary-50',  text: 'text-secondary-700', border: 'border-l-secondary-500' },
  high:     { label: 'High',     bg: 'bg-accent-50',     text: 'text-accent-700',    border: 'border-l-accent-500'    },
  low:      { label: 'Low',      bg: 'bg-warning-50',    text: 'text-warning-700',   border: 'border-l-warning-500'   },
  critical: { label: 'Critical', bg: 'bg-accent-50',     text: 'text-accent-800',    border: 'border-l-accent-600'    },
}

export function MetricCard({
  title, type, value, secondaryValue, trend = 'stable',
  trendValue, lastLogged, data = [], status = 'normal',
  icon, onClick, loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm border border-neutral-200">
        <div className="skeleton h-4 w-24 mb-4" />
        <div className="skeleton h-12 w-20 mb-2" />
        <div className="skeleton h-8 w-full mt-4" />
      </div>
    )
  }

  const cfg = statusConfig[status]
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'stable' ? 'text-neutral-400'
    : (status === 'normal' ? 'text-secondary-600' : 'text-accent-600')

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-lg bg-white p-6 shadow-sm border-l-4 text-left',
        'transition-all duration-normal hover:-translate-y-0.5 hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
        cfg.border,
        !value && 'border-l-neutral-200',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('w-5 h-5', getMetricColor(type))}>{icon}</span>
          <span className="text-sm font-medium text-neutral-600">{title}</span>
        </div>
        {trendValue !== undefined && (
          <span className={cn('flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5', trendColor,
            trend === 'stable' ? 'bg-neutral-100' : status === 'normal' ? 'bg-secondary-50' : 'bg-accent-50')}>
            <TrendIcon className="w-3 h-3" />
            {trendValue > 0 ? '+' : ''}{trendValue}
          </span>
        )}
      </div>

      {value !== undefined ? (
        <div className="flex items-baseline gap-1">
          <span className={cn('metric-display text-5xl', getMetricColor(type))}>
            {formatMetricValue(value, type)}
            {secondaryValue !== undefined && (
              <span>/{formatMetricValue(secondaryValue, type)}</span>
            )}
          </span>
          <span className="text-lg font-medium text-neutral-500 pb-1">{getMetricUnit(type)}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-2xl font-bold text-neutral-300">—</span>
          <span className="text-xs text-neutral-400">No readings yet</span>
        </div>
      )}

      {data.length > 1 && (
        <div className="mt-4">
          <Sparkline data={data} color={getMetricColor(type)} />
          <span className="text-xs text-neutral-400 mt-1 block">Last 7 days</span>
        </div>
      )}

      {value !== undefined && (
        <div className="mt-3 flex items-center justify-between">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
            {cfg.label}
          </span>
          {lastLogged && (
            <span className="text-xs text-neutral-400">{lastLogged}</span>
          )}
        </div>
      )}
    </button>
  )
}
