'use client'

import { useState } from 'react'
import {
  useConditions, useDeleteCondition,
  useAllergies, useDeleteAllergy,
  useEncounters, useDeleteEncounter,
  useImmunizations, useDeleteImmunization,
  useLabResults,
  useSymptoms,
} from '@/lib/hooks/useClinical'

// ── Severity badge helper ─────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  mild:     'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  severe:   'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-blue-100 text-blue-800',
  inactive:  'bg-gray-100 text-gray-600',
  resolved:  'bg-green-100 text-green-800',
  chronic:   'bg-purple-100 text-purple-800',
  ordered:   'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  abnormal:  'bg-red-100 text-red-800',
  normal:    'bg-green-100 text-green-800',
}

function Badge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label?.toLowerCase()] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'conditions',    label: 'Conditions',    icon: '🩺' },
  { id: 'allergies',     label: 'Allergies',     icon: '⚠️' },
  { id: 'encounters',    label: 'Encounters',    icon: '🏥' },
  { id: 'immunizations', label: 'Immunizations', icon: '💉' },
  { id: 'labs',          label: 'Lab Results',   icon: '🧪' },
  { id: 'symptoms',      label: 'Symptoms',      icon: '📋' },
] as const

type TabId = typeof TABS[number]['id']

// ── Conditions tab ────────────────────────────────────────────────────────────
function ConditionsTab() {
  const { data, isLoading } = useConditions()
  const del = useDeleteCondition()

  if (isLoading) return <Skeleton />
  if (!data?.length) return <Empty label="condition" />

  return (
    <ul className="divide-y divide-gray-100">
      {data.map(c => (
        <li key={c.id} className="py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{c.diagnosis}</span>
              {c.condition_name && <span className="text-gray-500 text-sm">({c.condition_name})</span>}
              <Badge label={c.status ?? 'active'} colorMap={STATUS_COLOR} />
              {c.severity && <Badge label={c.severity} colorMap={SEVERITY_COLOR} />}
            </div>
            <div className="mt-1 text-sm text-gray-500 flex gap-4 flex-wrap">
              {c.icd10_code && <span>ICD-10: <code className="font-mono">{c.icd10_code}</code></span>}
              {c.onset_date && <span>Onset: {fmt(c.onset_date)}</span>}
              {c.prescribed_by && <span>Dr. {c.prescribed_by}</span>}
            </div>
            {c.notes && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{c.notes}</p>}
          </div>
          <button
            onClick={() => del.mutate(c.id)}
            className="text-gray-300 hover:text-red-500 transition-colors text-sm"
            title="Remove"
          >✕</button>
        </li>
      ))}
    </ul>
  )
}

// ── Allergies tab ─────────────────────────────────────────────────────────────
function AllergiesTab() {
  const { data, isLoading } = useAllergies()
  const del = useDeleteAllergy()

  if (isLoading) return <Skeleton />
  if (!data?.length) return <Empty label="allergy" />

  return (
    <ul className="divide-y divide-gray-100">
      {data.map(a => (
        <li key={a.id} className="py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{a.allergen}</span>
              {a.severity && <Badge label={a.severity} colorMap={SEVERITY_COLOR} />}
              <Badge label={a.status ?? 'active'} colorMap={STATUS_COLOR} />
            </div>
            <p className="mt-1 text-sm text-gray-600">Reaction: {a.reaction}</p>
            {a.medication_name && (
              <p className="text-sm text-gray-500">Drug: {a.medication_name}</p>
            )}
            {a.onset_date && <p className="text-sm text-gray-400">Since {fmt(a.onset_date)}</p>}
          </div>
          <button onClick={() => del.mutate(a.id)} className="text-gray-300 hover:text-red-500 text-sm" title="Remove">✕</button>
        </li>
      ))}
    </ul>
  )
}

// ── Encounters tab ────────────────────────────────────────────────────────────
function EncountersTab() {
  const { data, isLoading } = useEncounters()
  const del = useDeleteEncounter()

  if (isLoading) return <Skeleton />
  if (!data?.length) return <Empty label="encounter" />

  return (
    <ul className="divide-y divide-gray-100">
      {data.map(e => (
        <li key={e.id} className="py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{e.reason}</span>
              {e.visit_type && <Badge label={e.visit_type} colorMap={STATUS_COLOR} />}
              {e.priority && e.priority !== 'routine' && (
                <Badge label={e.priority} colorMap={{ urgent: 'bg-orange-100 text-orange-800', emergency: 'bg-red-100 text-red-800' }} />
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500 flex gap-4 flex-wrap">
              <span>{fmt(e.encounter_date)}</span>
              {e.practitioner_name && <span>Dr. {e.practitioner_name}</span>}
              {e.facility_name && <span>@ {e.facility_name}</span>}
            </div>
            {e.diagnosis && <p className="mt-1 text-sm text-gray-600">Dx: {e.diagnosis}</p>}
            {e.notes && <p className="text-sm text-gray-500 line-clamp-1">{e.notes}</p>}
          </div>
          <button onClick={() => del.mutate(e.id)} className="text-gray-300 hover:text-red-500 text-sm" title="Remove">✕</button>
        </li>
      ))}
    </ul>
  )
}

// ── Immunizations tab ─────────────────────────────────────────────────────────
function ImmunizationsTab() {
  const { data, isLoading } = useImmunizations()
  const del = useDeleteImmunization()

  if (isLoading) return <Skeleton />
  if (!data?.length) return <Empty label="immunization" />

  return (
    <ul className="divide-y divide-gray-100">
      {data.map(v => (
        <li key={v.id} className="py-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg shrink-0">
            💉
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{v.vaccine_name}</span>
              {v.dose_number && <span className="text-sm text-gray-500">Dose {v.dose_number}</span>}
            </div>
            <div className="text-sm text-gray-500 flex gap-4 flex-wrap mt-1">
              <span>{fmt(v.date_administered)}</span>
              {v.manufacturer && <span>{v.manufacturer}</span>}
              {v.lot_number && <span>Lot: {v.lot_number}</span>}
              {v.location && <span>@ {v.location}</span>}
            </div>
          </div>
          <button onClick={() => del.mutate(v.id)} className="text-gray-300 hover:text-red-500 text-sm" title="Remove">✕</button>
        </li>
      ))}
    </ul>
  )
}

// ── Lab Results tab ───────────────────────────────────────────────────────────
function LabsTab() {
  const { data, isLoading } = useLabResults()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <Skeleton />
  if (!data?.length) return <Empty label="lab result" />

  return (
    <ul className="divide-y divide-gray-100">
      {data.map(lr => (
        <li key={lr.id} className="py-4">
          <div
            className="flex items-start gap-4 cursor-pointer"
            onClick={() => setExpanded(expanded === lr.id ? null : lr.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">{lr.test_name}</span>
                <Badge label={lr.status ?? 'ordered'} colorMap={STATUS_COLOR} />
                {lr.labs_result && <Badge label={lr.labs_result} colorMap={STATUS_COLOR} />}
              </div>
              <div className="text-sm text-gray-500 flex gap-4 flex-wrap mt-1">
                {lr.test_category && <span>{lr.test_category}</span>}
                {lr.facility && <span>{lr.facility}</span>}
                {lr.completed_date && <span>Completed: {fmt(lr.completed_date)}</span>}
                {lr.components?.length > 0 && (
                  <span className="text-[#1E6FD9]">{lr.components.length} components ▾</span>
                )}
              </div>
            </div>
          </div>
          {expanded === lr.id && lr.components?.length > 0 && (
            <div className="mt-3 ml-0 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b">
                    <th className="pb-1 font-medium pr-4">Test</th>
                    <th className="pb-1 font-medium pr-4">Result</th>
                    <th className="pb-1 font-medium pr-4">Reference</th>
                    <th className="pb-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lr.components.map(c => (
                    <tr key={c.id}>
                      <td className="py-1 pr-4 text-gray-700">{c.abbreviation ?? c.test_name}</td>
                      <td className="py-1 pr-4 font-mono font-medium">
                        {c.value !== undefined && c.value !== null ? `${c.value} ${c.unit ?? ''}` : c.qualitative_value ?? '—'}
                      </td>
                      <td className="py-1 pr-4 text-gray-400">
                        {c.ref_range_text ?? (c.ref_range_min !== undefined ? `${c.ref_range_min}–${c.ref_range_max}` : '—')}
                      </td>
                      <td className="py-1">
                        {c.status && <Badge label={c.status} colorMap={STATUS_COLOR} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

// ── Symptoms tab ──────────────────────────────────────────────────────────────
function SymptomsTab() {
  const { data, isLoading } = useSymptoms()

  if (isLoading) return <Skeleton />
  if (!data?.length) return <Empty label="symptom" />

  return (
    <ul className="divide-y divide-gray-100">
      {data.map(s => (
        <li key={s.id} className="py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{s.symptom_name}</span>
            {s.is_chronic && <Badge label="chronic" colorMap={STATUS_COLOR} />}
            <Badge label={s.status} colorMap={STATUS_COLOR} />
            {s.category && <span className="text-sm text-gray-400">{s.category}</span>}
          </div>
          <div className="text-sm text-gray-500 flex gap-4 flex-wrap mt-1">
            <span>First: {fmt(s.first_occurrence_date)}</span>
            {s.last_occurrence_date && <span>Last: {fmt(s.last_occurrence_date)}</span>}
            {s.occurrences?.length > 0 && <span>{s.occurrences.length} episodes logged</span>}
          </div>
          {s.typical_triggers && s.typical_triggers.length > 0 && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {s.typical_triggers.map(t => (
                <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{t}</span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3 py-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-4xl mb-3">📄</p>
      <p>No {label}s recorded yet.</p>
    </div>
  )
}

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  conditions:    <ConditionsTab />,
  allergies:     <AllergiesTab />,
  encounters:    <EncountersTab />,
  immunizations: <ImmunizationsTab />,
  labs:          <LabsTab />,
  symptoms:      <SymptomsTab />,
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RecordsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('conditions')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Medical Records</h1>
        <p className="text-gray-500 mt-1">
          Conditions, allergies, encounters, immunizations, lab results, and symptoms — powered by MediKeep.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1E6FD9] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{TAB_CONTENT[activeTab]}</div>
    </div>
  )
}
