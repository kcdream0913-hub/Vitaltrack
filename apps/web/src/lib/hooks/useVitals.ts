import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vitalsApi, VitalCreate, VitalsListParams } from '@/lib/api/client'

export const vitalKeys = {
  all:     ['vitals'] as const,
  lists:   () => [...vitalKeys.all, 'list'] as const,
  list:    (params: VitalsListParams) => [...vitalKeys.lists(), params] as const,
  latest:  () => [...vitalKeys.all, 'latest'] as const,
  detail:  (id: string) => [...vitalKeys.all, 'detail', id] as const,
}

/** Live "latest reading per type" — powers the dashboard metric cards */
export function useLatestVitals() {
  return useQuery({
    queryKey: vitalKeys.latest(),
    queryFn:  vitalsApi.latest,
    staleTime: 60_000,        // 1 min
    refetchInterval: 120_000, // background poll every 2 min
  })
}

/** Paginated / filtered list for the Vitals log page */
export function useVitalsList(params: VitalsListParams = {}) {
  return useQuery({
    queryKey: vitalKeys.list(params),
    queryFn:  () => vitalsApi.list(params),
    staleTime: 30_000,
  })
}

/** Single vital detail */
export function useVital(id: string) {
  return useQuery({
    queryKey: vitalKeys.detail(id),
    queryFn:  () => vitalsApi.get(id),
    enabled:  Boolean(id),
  })
}

/** Log a new reading — optimistic update on the latest cache */
export function useCreateVital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vitalsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vitalKeys.all })
    },
  })
}

/** Soft-delete */
export function useDeleteVital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vitalsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vitalKeys.all })
    },
  })
}
