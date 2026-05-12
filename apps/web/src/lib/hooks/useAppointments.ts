import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  appointmentsApi,
  AppointmentCreate,
  AppointmentStatus,
} from '@/lib/api/client'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const appointmentKeys = {
  all:      ['appointments'] as const,
  lists:    () => [...appointmentKeys.all, 'list'] as const,
  list:     (params?: { status?: AppointmentStatus; upcoming_only?: boolean }) =>
    [...appointmentKeys.lists(), params] as const,
  upcoming: () => [...appointmentKeys.all, 'upcoming'] as const,
  detail:   (id: string) => [...appointmentKeys.all, 'detail', id] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Filtered/paginated appointment list */
export function useAppointments(params?: { status?: AppointmentStatus; upcoming_only?: boolean }) {
  return useQuery({
    queryKey: appointmentKeys.list(params),
    queryFn:  () => appointmentsApi.list(params),
    staleTime: 60_000,
  })
}

/** Convenience hook — only upcoming appointments */
export function useUpcomingAppointments() {
  return useQuery({
    queryKey: appointmentKeys.upcoming(),
    queryFn:  appointmentsApi.upcoming,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

/** Single appointment detail */
export function useAppointment(id: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn:  () => appointmentsApi.get(id),
    enabled:  Boolean(id),
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Schedule a new appointment */
export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}

/** Edit an existing appointment */
export function useUpdateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AppointmentCreate> }) =>
      appointmentsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}

/** Cancel / delete an appointment */
export function useDeleteAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appointmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}
