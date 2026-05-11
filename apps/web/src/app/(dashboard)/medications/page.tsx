'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { medicationsApi, type MedicationResponse } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const FREQ_LABELS: Record<string, string> = {
  once_daily:          'Once daily',
  twice_daily:         'Twice daily',
  three_times_daily:   'Three times daily',
  four_times_daily:    'Four times daily',
  weekly:              'Weekly',
  as_needed:           'As needed',
  custom:              'Custom',
}

const MED_COLORS = [
  '#EF4444','#F97316','#F59E0B','#16A085','#0EA5E9','#8B5CF6','#DC2626','#1E6FD9',
]

function colorForMed(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return MED_COLORS[Math.abs(h) % MED_COLORS.length]
}

export default function MedicationsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ['medications', filter],
    queryFn:  () => medicationsApi.list(filter === 'active' ? true : undefined),
    staleTime: 60_000,
  })

  const { data: summary = [] } = useQuery({
    queryKey: ['medications', 'adherence-summary'],
    queryFn:  () => medicationsApi.adherenceSummary(30),
    staleTime: 5 * 60_000,
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Medications</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Track prescriptions and adherence</p>
        </div>
        <button className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
          + Add Medication
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Meds',  value: meds.length,    color: 'text-primary-600' },
          { label: 'Taken Today',  value: '—',            color: 'text-secondary-500' },
          { label: '30-day Rate',  value: '—',            color: 'text-warning-500' },
          { label: 'Due Soon',     value: '—',            color: 'text-accent-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-elevation-1 p-4">
            <div className={cn('text-3xl font-bold metric-display', s.color)}>{s.value}</div>
            <div className="text-xs text-neutral-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['active', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize',
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100',
            )}
          >
            {f === 'active' ? 'Active' : 'All Medications'}
          </button>
        ))}
      </div>

      {/* Medication List */}
      <div className="bg-white rounded-2xl shadow-elevation-2 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : meds.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="text-5xl">💊</div>
            <p className="text-base font-medium text-neutral-700">No medications added</p>
            <p className="text-sm text-neutral-400">Add your first medication to start tracking adherence</p>
            <button className="mt-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg">
              + Add Medication
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {meds.map((med: MedicationResponse) => {
              const color = colorForMed(med.name)
              return (
                <div key={med.id} className="px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: color + '1a' }}
                  >
                    💊
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-neutral-900">{med.name}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: color + '1a', color }}
                      >
                        {med.dosage}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-0.5">{FREQ_LABELS[med.frequency] ?? med.frequency}</p>
                    {med.prescribed_by && (
                      <p className="text-xs text-neutral-400 mt-0.5">Prescribed by {med.prescribed_by}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium',
                        med.is_active
                          ? 'bg-secondary-50 text-secondary-600'
                          : 'bg-neutral-100 text-neutral-400',
                      )}
                    >
                      {med.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button className="text-xs text-primary-600 hover:underline">Log dose</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
