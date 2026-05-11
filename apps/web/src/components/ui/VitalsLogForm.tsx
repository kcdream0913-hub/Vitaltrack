'use client'

import { useState } from 'react'
import { useCreateVital } from '@/lib/hooks/useVitals'
import { cn } from '@/lib/utils'
import type { VitalType } from '@/lib/api/client'

interface Props {
  onClose: () => void
  defaultType?: VitalType
}

const VITAL_OPTIONS: { value: VitalType; label: string; unit: string; placeholder: string; hasSecondary?: boolean }[] = [
  { value: 'heart_rate',       label: 'Heart Rate',      unit: 'bpm',    placeholder: 'e.g. 72' },
  { value: 'blood_pressure',   label: 'Blood Pressure',  unit: 'mmHg',   placeholder: 'e.g. 120', hasSecondary: true },
  { value: 'blood_glucose',    label: 'Blood Glucose',   unit: 'mg/dL',  placeholder: 'e.g. 100' },
  { value: 'blood_oxygen',     label: 'Blood Oxygen',    unit: '%',      placeholder: 'e.g. 98' },
  { value: 'body_temperature', label: 'Temperature',     unit: '°C',     placeholder: 'e.g. 37.0' },
  { value: 'weight',           label: 'Weight',          unit: 'kg',     placeholder: 'e.g. 78.5' },
  { value: 'respiratory_rate', label: 'Respiratory Rate',unit: 'br/min', placeholder: 'e.g. 16' },
]

export function VitalsLogForm({ onClose, defaultType = 'heart_rate' }: Props) {
  const [type,            setType]           = useState<VitalType>(defaultType)
  const [value,           setValue]          = useState('')
  const [secondaryValue,  setSecondaryValue] = useState('')
  const [notes,           setNotes]          = useState('')
  const [deviceSource,    setDeviceSource]   = useState('')

  const createVital = useCreateVital()
  const selected    = VITAL_OPTIONS.find(o => o.value === type)!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value) return

    await createVital.mutateAsync({
      vital_type:      type,
      value:           parseFloat(value),
      unit:            selected.unit,
      recorded_at:     new Date().toISOString(),
      secondary_value: secondaryValue ? parseFloat(secondaryValue) : undefined,
      notes:           notes || undefined,
      device_source:   deviceSource || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900">Log Vital Reading</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Vital Type */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Vital Type</label>
            <div className="grid grid-cols-2 gap-2">
              {VITAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setType(opt.value); setValue(''); setSecondaryValue('') }}
                  className={cn(
                    'px-3 py-2 rounded-lg text-left text-sm transition-colors border',
                    type === opt.value
                      ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value */}
          <div className={cn('grid gap-3', selected.hasSecondary ? 'grid-cols-2' : 'grid-cols-1')}>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                {selected.hasSecondary ? 'Systolic' : 'Value'}
                <span className="ml-1 text-neutral-400">({selected.unit})</span>
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={selected.placeholder}
                required
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {selected.hasSecondary && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Diastolic <span className="text-neutral-400">(mmHg)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={secondaryValue}
                  onChange={e => setSecondaryValue(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Device Source */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Device / Source (optional)</label>
            <input
              type="text"
              value={deviceSource}
              onChange={e => setDeviceSource(e.target.value)}
              placeholder="e.g. Apple Watch, Omron M7, Manual"
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any context about this reading..."
              rows={2}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createVital.isPending || !value}
              className="flex-1 px-4 py-2.5 bg-primary-600 rounded-lg text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createVital.isPending ? 'Saving...' : 'Save Reading'}
            </button>
          </div>

          {createVital.isError && (
            <p className="text-xs text-accent-600 text-center">
              Failed to save reading. Please try again.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
