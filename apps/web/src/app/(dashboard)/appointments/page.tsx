'use client'

import { useState } from 'react'
import {
  Calendar, MapPin, Clock, Pencil, Trash2, Plus, RefreshCw, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppointments, useDeleteAppointment } from '@/lib/hooks/useAppointments'
import { AddAppointmentModal } from '@/components/appointments/AddAppointmentModal'
import type { AppointmentResponse, AppointmentStatus } from '@/lib/api/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAppointmentDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
    hour12:  true,
  }).format(new Date(iso)).replace(',', ' ·')
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled:  { label: 'Scheduled', className: 'bg-blue-50 text-blue-700'   },
  completed:  { label: 'Completed', className: 'bg-green-50 text-green-700' },
  cancelled:  { label: 'Cancelled', className: 'bg-red-50 text-red-600'     },
  no_show:    { label: 'No-show',   className: 'bg-amber-50 text-amber-700' },
}

function isUpcoming(appt: AppointmentResponse): boolean {
  return new Date(appt.appointment_date) >= new Date() && appt.status === 'scheduled'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AppointmentSkeleton() {
  return (
    <li className="bg-white rounded-xl border border-neutral-200 p-5" aria-hidden="true">
      <div className="flex items-start gap-4">
        <div className="animate-pulse bg-neutral-100 rounded-full w-10 h-10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="animate-pulse bg-neutral-100 rounded h-4 w-48" />
          <div className="animate-pulse bg-neutral-100 rounded h-3 w-32" />
          <div className="animate-pulse bg-neutral-100 rounded h-3 w-40" />
        </div>
        <div className="animate-pulse bg-neutral-100 rounded-full h-6 w-20" />
      </div>
    </li>
  )
}

// ─── Empty states ──────────────────────────────────────────────────────────────

function EmptyUpcoming({ onAdd }: { onAdd: () => void }) {
  return (
    <li
      className="col-span-full flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-xl border border-dashed border-neutral-300 list-none"
      role="listitem"
    >
      <Calendar className="w-12 h-12 text-neutral-300 mb-4" aria-hidden="true" />
      <h3 className="text-base font-semibold text-neutral-800 mb-1">No upcoming appointments</h3>
      <p className="text-sm text-neutral-500 mb-5 max-w-xs">
        Stay on top of your healthcare by scheduling appointments with your care team.
      </p>
      <button
        onClick={onAdd}
        className="bg-[#1E6FD9] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
        aria-label="Schedule your first appointment"
      >
        Schedule your first appointment
      </button>
    </li>
  )
}

function EmptyPast() {
  return (
    <li
      className="col-span-full flex flex-col items-center justify-center py-12 px-6 text-center bg-white rounded-xl border border-neutral-200 list-none"
      role="listitem"
    >
      <p className="text-sm text-neutral-500">No past appointments yet.</p>
    </li>
  )
}

// ─── Appointment card ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onEdit,
  onDelete,
}: {
  appt: AppointmentResponse
  onEdit: (a: AppointmentResponse) => void
  onDelete: (id: string) => void
}) {
  const status = STATUS_CONFIG[appt.status]
  const initials = getInitials(appt.provider_name)

  return (
    <li
      className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 flex items-start gap-4"
      role="listitem"
    >
      {/* Provider avatar */}
      <div
        className="w-10 h-10 rounded-full bg-[#1E6FD91a] flex items-center justify-center flex-shrink-0"
        aria-hidden="true"
      >
        <span className="text-sm font-semibold text-[#1E6FD9]">{initials}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[#0F172A] truncate">{appt.title}</h3>
          <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0', status.className)}>
            {status.label}
          </span>
        </div>

        {appt.provider_name && (
          <p className="text-sm text-neutral-600 mt-0.5">{appt.provider_name}</p>
        )}

        {appt.specialty && (
          <span className="inline-block mt-1 text-xs bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">
            {appt.specialty}
          </span>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            {formatAppointmentDate(appt.appointment_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            {appt.duration_minutes} min
          </span>
          {appt.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              {appt.location}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(appt)}
          className="p-2 rounded-lg text-neutral-400 hover:text-[#1E6FD9] hover:bg-blue-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={`Edit appointment: ${appt.title}`}
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onDelete(appt.id)}
          className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={`Cancel appointment: ${appt.title}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [tab,      setTab]      = useState<'upcoming' | 'past'>('upcoming')
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt,  setEditAppt] = useState<AppointmentResponse | undefined>(undefined)

  const { data: appointments = [], isLoading, isError, refetch } = useAppointments()
  const deleteAppt = useDeleteAppointment()

  const upcoming = appointments.filter(isUpcoming)
  const past     = appointments.filter(a => !isUpcoming(a))
  const current  = tab === 'upcoming' ? upcoming : past

  function handleEdit(a: AppointmentResponse) {
    setEditAppt(a)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditAppt(undefined)
    setModalOpen(true)
  }

  function handleDelete(id: string) {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      deleteAppt.mutate(id)
    }
  }

  return (
    <div className="min-h-full p-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Appointments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Manage your healthcare appointments</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-[#1E6FD9] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] transition-colors"
          aria-label="Schedule a new appointment"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Schedule Appointment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg w-fit mb-6" role="tablist" aria-label="Appointment views">
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] capitalize',
              tab === t
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            {t}
            {t === 'upcoming' && upcoming.length > 0 && !isLoading && (
              <span className="ml-1.5 bg-[#1E6FD9] text-white text-xs rounded-full px-1.5 py-0.5">
                {upcoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3 mb-4"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Unable to load appointments</p>
            <p className="text-xs text-red-600 mt-0.5">Check your connection and try again.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-red-700 font-medium hover:text-red-900 transition-colors min-h-[44px] px-3"
            aria-label="Retry loading appointments"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Appointment list */}
      <ul
        role="list"
        aria-label={`${tab === 'upcoming' ? 'Upcoming' : 'Past'} appointments`}
        className="space-y-3"
      >
        {isLoading ? (
          [1, 2, 3].map(i => <AppointmentSkeleton key={i} />)
        ) : current.length === 0 ? (
          tab === 'upcoming'
            ? <EmptyUpcoming onAdd={handleAdd} />
            : <EmptyPast />
        ) : (
          current.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </ul>

      {/* Modal */}
      {modalOpen && (
        <AddAppointmentModal
          onClose={() => { setModalOpen(false); setEditAppt(undefined) }}
          appointment={editAppt}
        />
      )}
    </div>
  )
}
