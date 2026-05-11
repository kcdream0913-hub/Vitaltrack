'use client'

import { useHealthScore, useAlerts, useInsightReport } from '@/lib/hooks/useAnalytics'
import { cn } from '@/lib/utils'

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 32, circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#E5E7EB" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold metric-display" style={{ color }}>
          {value}
        </span>
      </div>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  )
}

const SCORE_CATEGORIES = [
  { key: 'heart',      label: 'Heart',     color: '#EF4444' },
  { key: 'metabolic',  label: 'Metabolic', color: '#F97316' },
  { key: 'activity',   label: 'Activity',  color: '#1E6FD9' },
  { key: 'sleep',      label: 'Sleep',     color: '#8B5CF6' },
  { key: 'nutrition',  label: 'Nutrition', color: '#16A085' },
]

const SEVERITY_STYLES = {
  critical: 'bg-accent-50 border-l-4 border-accent-500 text-accent-700',
  warning:  'bg-warning-50 border-l-4 border-warning-500 text-warning-700',
  info:     'bg-primary-50 border-l-4 border-primary-500 text-primary-700',
}

export default function AnalyticsPage() {
  const { data: score, isLoading: scoreLoading }   = useHealthScore()
  const { data: alerts = [], isLoading: alertLoad } = useAlerts(false)
  const { data: report }                            = useInsightReport()

  const hs = score as any

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Analytics & Insights</h1>
        <p className="text-sm text-neutral-500 mt-0.5">AI-powered health analysis and recommendations</p>
      </div>

      {/* Health Score Card */}
      <div className="bg-white rounded-2xl shadow-elevation-2 p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-4">Health Score</h2>
        {scoreLoading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hs ? (
          <div className="flex items-center gap-8">
            {/* Overall big ring */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 -rotate-90">
                  <circle cx="64" cy="64" r="52" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                  <circle
                    cx="64" cy="64" r="52" fill="none"
                    stroke="#1E6FD9" strokeWidth="10"
                    strokeDasharray={`${(hs.overall / 100) * 327} 327`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold metric-display text-primary-600">{hs.overall}</span>
                  <span className="text-xs text-neutral-400">/ 100</span>
                </div>
              </div>
              <span className="text-sm font-medium text-neutral-700 mt-2">Overall</span>
            </div>

            {/* Category rings */}
            <div className="flex gap-6 flex-wrap">
              {SCORE_CATEGORIES.map(c => (
                <ScoreRing key={c.key} value={hs[c.key] ?? 0} label={c.label} color={c.color} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">Health score unavailable — log more readings to generate insights.</p>
        )}
      </div>

      {/* Insights */}
      {hs?.insights?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-elevation-2 p-6">
          <h2 className="text-base font-semibold text-neutral-900 mb-3">AI Insights</h2>
          <ul className="space-y-2">
            {hs.insights.map((insight: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-sm text-neutral-700">
                <span className="mt-0.5 text-primary-500 flex-shrink-0">●</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {(report as any)?.recommendations?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-elevation-2 p-6">
          <h2 className="text-base font-semibold text-neutral-900 mb-3">Recommendations</h2>
          <div className="space-y-3">
            {(report as any).recommendations.map((rec: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-primary-50 rounded-lg">
                <span className="text-primary-600 flex-shrink-0 mt-0.5">💡</span>
                <p className="text-sm text-primary-800">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="bg-white rounded-2xl shadow-elevation-2 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">
            Health Alerts
            {(alerts as any[]).length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-accent-500 text-white text-xs font-medium rounded-full">
                {(alerts as any[]).length}
              </span>
            )}
          </h2>
        </div>
        {alertLoad ? (
          <div className="p-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (alerts as any[]).length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm font-medium text-neutral-600">No active alerts</p>
            <p className="text-xs text-neutral-400 mt-1">All your readings are within normal ranges.</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {(alerts as any[]).map((alert: any) => (
              <div key={alert.id} className={cn('p-4 rounded-lg text-sm', SEVERITY_STYLES[alert.severity as keyof typeof SEVERITY_STYLES])}>
                <div className="font-medium">{alert.vital_type.replace('_', ' ')}</div>
                <div className="mt-0.5 opacity-90">{alert.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
