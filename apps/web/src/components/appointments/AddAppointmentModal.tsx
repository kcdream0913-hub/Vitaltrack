'use client'

import { useState, useId } from 'react'
import { X, Loader2, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateAppointment, useUpdateAppointment } from '@/lib/hooks/useAppointments'
import type { AppointmentResponse } from '@/lib/api/client'

interface Props {
  onClose: () => void
  /** Pass an existing appointment to edit it instead of creating */
  appointment?: AppointmentResponse
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90]

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = d.toISOString().slice(0, 10)
  const time = d.toTimeString().slice(0, 5)
  return { date, time }
}

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

export function AddAppointmentModal({ onClose, appointment }: Props) {
  const isEdit = Boolean(appointment)
  const prefill = appointment ? splitDateTime(appointment.appointment_date) : { date: '', time: '' }

  const [title,    setTitle]    = useState(appointment?.title            ?? '')
  const [provider, setProvider] = useState(appointment?.provider_name   ?? '')
  const [specialty,setSpecialty]= useState(appointment?.specialty       ?? '')
  const [date,     setDate]     = useState(prefill.date)
  const [time,     setTime]     = useState(prefill.time)
  const [duration, setDuration] = useState(String(appointment?.duration_minutes ?? 30))
  const [location, setLocation] = useState(appointment?.location        ?? '')
  const [notes,    setNotes]    = useState(appointment?.notes           ?? '')
  const [reminder, setReminder] = useState(true)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  const create = useCreateAppointment()
  const update = useUpdateAppointment()
  const isPending = create.isPending || update.isPending

  const uid = useId()
  const id = (field: string) => `${uid}-${field}`

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!title.trim())  errs.title = 'Title is required'
    if (!date)          errs.date  = 'Date is required'
    if (!time)          errs.time  = 'Time is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const body = {
      title:             title.trim(),
      provider_name:     provider.trim() || undefined,
      specialty:         specialty.trim() || undefined,
      location:          location.trim() || undefined,
      appointment_date:  combineDateTime(date, time),
      duration_minutes:  parseInt(duration, 10),
      notes:             notes.trim() || undefined,
    }

    try {
      if (isEdit && appointment) {
        await update.mutateAsync({ id: appointment.id, body })
      } else {
        await create.mutateAsync(body)
      }
      onClose()
    } catch {
      // error surfaced via mutation.isError below
    }
  }

  const mutationError = create.isError || update.isError

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={id('heading')}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <h2 id={id('heading')} className="text-lg font-semibold text-neutral-900">
            {isEdit ? 'Edit Appointment' : 'Schedule Appointment'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-neutral-100 text-neutral-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="overflow-y-auto px-6 py-5 space-y-4 flex-1"
        >

          {/* Title */}
          <div>
            <label htmlFor={id('title')} className="block text-xs font-medium text-neutral-700 mb-1.5">
              Title <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id={id('title')}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Annual physical, Cardiology follow-up"
              aria-required="true"
              aria-describedby={errors.title ? id('title-err') : undefined}
              className={cn(
                'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent',
                errors.title ? 'border-red-400' : 'border-neutral-200',
              )}
            />
            {errors.title && (
              <p id={id('title-err')} className="mt-1 text-xs text-red-500" role="alert">{errors.title}</p>
            )}
          </div>

          {/* Provider + Specialty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={id('provider')} className="block text-xs font-medium text-neutral-700 mb-1.5">Provider Name</label>
              <input
                id={id('provider')}
                type="text"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                placeholder="e.g. Dr. Patel"
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor={id('specialty')} className="block text-xs font-medium text-neutral-700 mb-1.5">Specialty</label>
              <input
                id={id('specialty')}
                type="text"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology"
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent"
              />
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={id('date')} className="block text-xs font-medium text-neutral-700 mb-1.5">
                Date <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={id('date')}
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                aria-required="true"
                aria-describedby={errors.date ? id('date-err') : undefined}
                className={cn(
                  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent',
                  errors.date ? 'border-red-400' : 'border-neutral-200',
                )}
              />
              {errors.date && (
                <p id={id('date-err')} className="mt-1 text-xs text-red-500" role="alert">{errors.date}</p>
              )}
            </div>
            <div>
              <label htmlFor={id('time')} className="block text-xs font-medium text-neutral-700 mb-1.5">
                Time <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={id('time')}
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                aria-required="true"
                aria-describedby={errors.time ? id('time-err') : undefined}
                className={cn(
                  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent',
                  errors.time ? 'border-red-400' : 'border-neutral-200',
                )}
              />
              {errors.time && (
                <p id={id('time-err')} className="mt-1 text-xs text-red-500" role="alert">{errors.time}</p>
              )}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label htmlFor={id('duration')} className="block text-xs font-medium text-neutral-700 mb-1.5">Duration</label>
            <select
              id={id('duration')}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent bg-white"
            >
              {DURATION_OPTIONS.map(min => (
                <option key={min} value={min}>{min} minutes</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label htmlFor={id('location')} className="block text-xs font-medium text-neutral-700 mb-1.5">Location</label>
            <input
              id={id('location')}
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. 123 Main St, Suite 4 or Telehealth"
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor={id('notes')} className="block text-xs font-medium text-neutral-700 mb-1.5">Notes</label>
            <textarea
              id={id('notes')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Preparation instructions, questions to ask, etc."
              rows={3}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9] focus:border-transparent resize-none"
            />
          </div>

          {/* Reminder toggle */}
          <label
            htmlFor={id('reminder')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <input
              id={id('reminder')}
              type="checkbox"
              checked={reminder}
              onChange={e => setReminder(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-[#1E6FD9] focus:ring-[#1E6FD9] accent-[#1E6FD9]"
            />
            <span className="flex items-center gap-1.5 text-sm text-neutral-700">
              <Bell className="w-4 h-4 text-[#1E6FD9]" aria-hidden="true" />
              Set reminder
            </span>
          </label>

          {/* Server error */}
          {mutationError && (
            <p className="text-xs text-red-500 text-center" role="alert">
              Failed to {isEdit ? 'update' : 'schedule'} appointment. Please try again.
            </p>
          )}
        </form>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px]"
            aria-label="Cancel and close modal"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={undefined}
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1E6FD9] text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            aria-label={isPending ? 'Saving appointment...' : isEdit ? 'Save changes' : 'Schedule appointment'}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Scheduling…' : isEdit ? 'Save Changes' : 'Schedule Appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
