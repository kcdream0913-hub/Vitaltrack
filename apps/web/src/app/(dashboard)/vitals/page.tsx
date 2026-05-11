'use client'

import { useState } from 'react'
import { useVitalsList } from '@/lib/hooks/useVitals'
import { useVitalTrend } from '@/lib/hooks/useAnalytics'
import { TrendChart } from '@/components/charts/TrendChart'
import { StatusChip } from '@/components/ui/StatusChip'
import { cn, formatMetricValue, getMetricStatus, getMetricColor } from '@/lib/utils'
import type { VitalType } from '@/lib/api/client'

const VITAL_TYPES: { type: VitalType; label: string; unit: string; color: string }[] = [
  { type: 'heart_rate',      label: 'Heart Rate',     unit: 'bpm',    color: '#EF4444' },
  { type: 'blood_pressure',  label: 'Blood Pressure', unit: 'mmHg',   color: '#DC2626' },
  { type: 'blood_glucose',   label: 'Blood Glucose',  unit: 'mg/dL',  color: '#F97316' },
  { type: 'weight',          label: 'Weight',         unit: 'kg',     color: '#16A085' },
  { type: 'blood_oxygen',    label: 'SpO₂',           unit: '%',      color: '#0EA5E9' },
  { type: 'body_temperature',label: 'Temperature',    unit: '°C',     color: '#F59E0B' },
]

const DATE_RANGES = ['1W', '1M', '3M', '6M', '1Y'] as const
type DateRange = typeof DATE_RANGES[number]

export default function VitalsPage() {
  const [selectedType, setSelectedType] = useState<VitalType>('heart_rate')
  const [dateRange, setDateRange]       = useState<DateRange>('1M')

  const { data: vitals = [], isLoading } = useVitalsList({ vital_type: selectedType, page_size: 50 })
  const { data: trend }                  = useVitalTrend(selectedType)

  const active = VITAL_TYPES.find(v => v.type === selectedType)!

  const chartData = vitals.map(v => ({
    date:           new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value:          Number(v.value),
    secondaryValue: v.secondary_value ? Number(v.secondary_value) : undefined,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Vitals & Trends</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Track your health metrics over time</p>
        </div>
        <button className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
          + Log Reading
        </button>
      </div>

      {/* Vital Type Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {VITAL_TYPES.map(vt => (
          <button
            key={vt.type}
            onClick={() => setSelectedType(vt.type)}
            className={cn(
              'flex-shrink-0 px-4 py-3 rounded-xl border text-left transition-all',
              selectedType === vt.type
                ? 'bg-white border-transparent shadow-elevation-2'
                : 'bg-white/60 border-neutral-200 hover:bg-white',
            )}
          >
            <div className="text-xs font-medium text-neutral-500">{vt.label}</div>
            <div
              className="text-sm font-semibold mt-0.5"
              style={{ color: selectedType === vt.type ? vt.color : undefined }}
            >
              — {vt.unit}
            </div>
          </button>
        ))}
      </div>

      {/* Chart Card */}
      <div className="bg-white rounded-2xl shadow-elevation-2 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{active.label}</h2>
            {trend && (
              <p className="text-sm text-neutral-500 mt-0.5">
                Avg {Number((trend as any).average).toFixed(1)} {active.unit}
                &nbsp;·&nbsp;
                Range {Number((trend as any).min_value).toFixed(0)}–{Number((trend as any).max_value).toFixed(0)}
              </p>
            )}
          </div>
          {/* Date range selector */}
          <div className="flex gap-1">
            {DATE_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  dateRange === r
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length > 0 ? (
          <TrendChart
            data={chartData}
            metricType={selectedType}
            color={active.color}
            unit={active.unit}
            height={280}
          />
        ) : (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-neutral-400">
            <span className="text-4xl">📈</span>
            <p className="text-sm font-medium">No readings yet</p>
            <p className="text-xs">Log your first {active.label} reading to see trends</p>
          </div>
        )}
      </div>

      {/* Log History */}
      <div className="bg-white rounded-2xl shadow-elevation-2 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Log History</h2>
          <span className="text-xs text-neutral-400">{vitals.length} readings</span>
        </div>

        {vitals.length === 0 ? (
          <div className="p-12 text-center text-neutral-400">
            <p className="text-sm">No readings logged for this vital type.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {vitals.map(v => {
              const status = getMetricStatus(selectedType, Number(v.value))
              return (
                <div key={v.id} className="px-6 py-3 flex items-center gap-4 hover:bg-neutral-50 transition-colors">
                  <span
                    className="metric-display text-2xl font-bold w-24"
                    style={{ color: active.color }}
                  >
                    {formatMetricValue(selectedType, Number(v.value))}
                  </span>
                  <span className="text-xs text-neutral-400 w-16">{v.unit}</span>
                  <span className="text-sm text-neutral-600 flex-1">
                    {new Date(v.recorded_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  {v.device_source && (
                    <span className="text-xs text-neutral-400">{v.device_source}</span>
                  )}
                  <StatusChip status={status} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
