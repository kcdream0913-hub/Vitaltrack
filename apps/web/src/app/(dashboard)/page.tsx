'use client'

import { useState } from 'react'
import { Heart, Footprints, Droplets, Moon, Scale, Gauge, Wind } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { QuickLogButton } from '@/components/ui/QuickLogButton'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { VitalsLogForm } from '@/components/ui/VitalsLogForm'
import { useLatestVitals } from '@/lib/hooks/useVitals'
import { useAlerts } from '@/lib/hooks/useAnalytics'
import { greetingByHour } from '@/lib/utils'

const METRIC_CARDS = [
  {
    title: 'Heart Rate',
    type: 'heart_rate',
    value: 72,
    trend: 'down' as const,
    trendValue: -3,
    lastLogged: '2h ago',
    data: [78, 75, 80, 74, 72, 71, 72],
    status: 'normal' as const,
    icon: <Heart className="w-5 h-5" />,
  },
  {
    title: 'Blood Pressure',
    type: 'blood_pressure',
    value: 118,
    secondaryValue: 76,
    trend: 'stable' as const,
    lastLogged: '3h ago',
    data: [125, 120, 122, 118, 116, 120, 118],
    status: 'normal' as const,
    icon: <Gauge className="w-5 h-5" />,
  },
  {
    title: 'Blood Glucose',
    type: 'glucose',
    value: 98,
    trend: 'up' as const,
    trendValue: 5,
    lastLogged: '1h ago',
    data: [92, 95, 105, 98, 101, 97, 98],
    status: 'normal' as const,
    icon: <Droplets className="w-5 h-5" />,
  },
  {
    title: 'Weight',
    type: 'weight',
    value: 74.2,
    trend: 'down' as const,
    trendValue: -0.3,
    lastLogged: 'Today',
    data: [75.1, 74.9, 74.7, 74.5, 74.4, 74.3, 74.2],
    status: 'normal' as const,
    icon: <Scale className="w-5 h-5" />,
  },
  {
    title: 'Steps Today',
    type: 'steps',
    value: 8432,
    trend: 'up' as const,
    trendValue: 12,
    lastLogged: 'Live',
    data: [6200, 7800, 9100, 5400, 8900, 7600, 8432],
    status: 'normal' as const,
    icon: <Footprints className="w-5 h-5" />,
  },
  {
    title: 'Sleep',
    type: 'sleep',
    value: 7.5,
    trend: 'up' as const,
    trendValue: 0.5,
    lastLogged: 'Last night',
    data: [6.2, 7.0, 6.5, 7.8, 6.9, 7.2, 7.5],
    status: 'normal' as const,
    icon: <Moon className="w-5 h-5" />,
  },
  {
    title: 'SpO2',
    type: 'spo2',
    value: 98,
    trend: 'stable' as const,
    lastLogged: '1h ago',
    data: [97, 98, 97, 98, 99, 98, 98],
    status: 'normal' as const,
    icon: <Wind className="w-5 h-5" />,
  },
]

export default function DashboardPage() {
  const greeting = greetingByHour()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const [logFormOpen, setLogFormOpen] = useState(false)
  const { data: alerts = [] } = useAlerts(false)

  return (
    <div className="relative min-h-full p-8">
      {/* Active alerts */}
      {(alerts as any[]).filter((a: any) => a.severity === 'critical').slice(0, 1).map((a: any) => (
        <AlertBanner
          key={a.id}
          severity="critical"
          title={`${a.vital_type.replace('_', ' ')} reading needs attention`}
          message={a.message}
          className="mb-6"
        />
      ))}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">{greeting}, Prabhat 👋</h1>
        <p className="text-sm text-neutral-500 mt-1">{today} · Here&apos;s your health overview</p>
      </div>

      {/* Metric Grid */}
      <section aria-label="Health metrics">
        <h2 className="text-lg font-semibold text-neutral-800 mb-4">Today&apos;s Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {METRIC_CARDS.map(card => (
            <MetricCard key={card.type} {...card} onClick={() => setLogFormOpen(true)} />
          ))}
        </div>
      </section>

      {/* Quick stats row */}
      <section className="mt-10" aria-label="Daily summary">
        <h2 className="text-lg font-semibold text-neutral-800 mb-4">Daily Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard label="Medications" value="2 / 3" sub="1 due at 8 PM" color="text-primary-600" />
          <SummaryCard label="Next Appointment" value="Jun 14" sub="Dr. Patel · Endocrinology" color="text-secondary-600" />
          <SummaryCard label="Active Goal" value="Weight loss" sub="68% to target · 3 weeks left" color="text-purple-600" />
        </div>
      </section>

      {/* FAB */}
      <QuickLogButton />

      {/* Log Form Modal */}
      {logFormOpen && <VitalsLogForm onClose={() => setLogFormOpen(false)} />}
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-neutral-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{sub}</p>
    </div>
  )
}
