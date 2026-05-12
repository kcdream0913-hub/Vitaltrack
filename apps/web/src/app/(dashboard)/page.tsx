'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Heart, Footprints, Droplets, Moon, Scale, Gauge, Wind, CalendarClock } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { QuickLogButton } from '@/components/ui/QuickLogButton'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { VitalsLogForm } from '@/components/ui/VitalsLogForm'
import { useLatestVitals } from '@/lib/hooks/useVitals'
import { useAlerts } from '@/lib/hooks/useAnalytics'
import { medicationsApi } from '@/lib/api/client'
import { greetingByHour } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// ─── Static card config (icon / title / unit — no live data) ─────────────────

const CARD_CONFIG = [
  { type: 'heart_rate',     title: 'Heart Rate',     icon: <Heart    className="w-5 h-5" aria-hidden="true" /> },
  { type: 'blood_pressure', title: 'Blood Pressure', icon: <Gauge    className="w-5 h-5" aria-hidden="true" /> },
  { type: 'blood_glucose',  title: 'Blood Glucose',  icon: <Droplets className="w-5 h-5" aria-hidden="true" /> },
  { type: 'weight',         title: 'Weight',         icon: <Scale    className="w-5 h-5" aria-hidden="true" /> },
  { type: 'steps',          title: 'Steps Today',    icon: <Footprints className="w-5 h-5" aria-hidden="true" /> },
  { type: 'sleep',          title: 'Sleep',          icon: <Moon     className="w-5 h-5" aria-hidden="true" /> },
  { type: 'spo2',           title: 'SpO2',           icon: <Wind     className="w-5 h-5" aria-hidden="true" /> },
]

// Map API vital_type keys → CARD_CONFIG type keys
const API_TYPE_MAP: Record<string, string> = {
  heart_rate:      'heart_rate',
  blood_pressure:  'blood_pressure',
  blood_glucose:   'blood_glucose',
  blood_oxygen:    'spo2',
  body_temperature:'temperature',
  weight:          'weight',
  respiratory_rate:'respiratory_rate',
}

function getFirstName(user: User): string {
  const fullName = user.user_metadata?.full_name as string | undefined
  if (fullName) return fullName.trim().split(/\s+/)[0]
  const email = user.email ?? ''
  return email.split('@')[0]
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div
      className="animate-pulse bg-neutral-100 rounded-xl h-32"
      aria-hidden="true"
    />
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoReadingsState({ onLog }: { onLog: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-xl border border-dashed border-neutral-300">
      <span className="text-5xl mb-4" role="img" aria-label="Chart illustration">📊</span>
      <h3 className="text-base font-semibold text-neutral-800 mb-1">No readings yet</h3>
      <p className="text-sm text-neutral-500 mb-5 max-w-xs">
        Tap a metric below or use the button to log your first reading and start tracking your health.
      </p>
      <button
        onClick={onLog}
        className="bg-[#1E6FD9] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
        aria-label="Log your first vital reading"
      >
        Log First Reading
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const greeting = greetingByHour()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const [logFormOpen, setLogFormOpen] = useState(false)
  const [user,        setUser]        = useState<User | null>(null)

  // Auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  // Vitals
  const { data: vitalsData, isLoading: vitalsLoading, isError: vitalsError } = useLatestVitals()

  // Alerts
  const { data: alerts = [] } = useAlerts(false)

  // Medications (active count for summary card)
  const { data: medications } = useQuery({
    queryKey: ['medications', 'active'],
    queryFn:  () => medicationsApi.list(true),
    staleTime: 2 * 60_000,
  })

  // Merge static config with live API readings
  const readings = vitalsData?.readings ?? {}

  // Check if any reading exists — map API types to config types
  const hasAnyReading = Object.keys(readings).length > 0

  const metricCards = CARD_CONFIG.map(cfg => {
    // Find a reading for this card type
    const apiKey = Object.entries(API_TYPE_MAP).find(([, v]) => v === cfg.type)?.[0]
    const reading = apiKey ? readings[apiKey] : undefined

    return {
      ...cfg,
      value:      reading?.value,
      secondaryValue: reading?.secondary_value,
      trend:      'stable' as const,
      lastLogged: reading ? new Date(reading.recorded_at).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      }) : undefined,
    }
  })

  const firstName = user ? getFirstName(user) : '…'
  const activeMedCount  = medications?.length ?? 0
  const criticalAlerts  = (alerts as any[]).filter((a: any) => a.severity === 'critical')

  return (
    <div className="relative min-h-full p-8">
      {/* Critical alert banner */}
      {criticalAlerts.slice(0, 1).map((a: any) => (
        <AlertBanner
          key={a.id}
          severity="critical"
          title={`${a.vital_type.replace('_', ' ')} reading needs attention`}
          message={a.message}
          className="mb-6"
        />
      ))}

      {/* Error state for vitals */}
      {vitalsError && (
        <AlertBanner
          severity="warning"
          title="Could not load latest vitals"
          message="Check your connection and try refreshing the page."
          className="mb-6"
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-neutral-500 mt-1">{today} · Here&apos;s your health overview</p>
      </div>

      {/* Metric Grid */}
      <section aria-label="Health metrics">
        <h2 className="text-lg font-semibold text-neutral-800 mb-4">Today&apos;s Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vitalsLoading
            ? CARD_CONFIG.map(c => <MetricSkeleton key={c.type} />)
            : !hasAnyReading
              ? <NoReadingsState onLog={() => setLogFormOpen(true)} />
              : metricCards.map(card => (
                  <MetricCard
                    key={card.type}
                    {...card}
                    onClick={() => setLogFormOpen(true)}
                    aria-label={`${card.title}: ${card.value ?? 'no data'}`}
                  />
                ))
          }
        </div>
      </section>

      {/* Quick stats row */}
      <section className="mt-10" aria-label="Daily summary">
        <h2 className="text-lg font-semibold text-neutral-800 mb-4">Daily Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            label="Medications"
            value={activeMedCount > 0 ? `${activeMedCount} active` : 'None active'}
            sub={activeMedCount > 0 ? `${activeMedCount} medication${activeMedCount !== 1 ? 's' : ''} tracked` : 'Add a medication to track'}
            color="text-[#1E6FD9]"
          />
          <SummaryCard
            label="Next Appointment"
            value="—"
            sub="Visit the Appointments page to schedule"
            color="text-[#16A085]"
          />
          <SummaryCard
            label="Active Goal"
            value="—"
            sub="Set a health goal to track progress"
            color="text-purple-600"
          />
        </div>
      </section>

      {/* FAB */}
      <QuickLogButton />

      {/* Log Form Modal */}
      {logFormOpen && <VitalsLogForm onClose={() => setLogFormOpen(false)} />}
    </div>
  )
}

function SummaryCard({
  label, value, sub, color,
}: {
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-neutral-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{sub}</p>
    </div>
  )
}
