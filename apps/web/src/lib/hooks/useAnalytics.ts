import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api/client'

export const analyticsKeys = {
  all:         ['analytics'] as const,
  healthScore: () => [...analyticsKeys.all, 'health-score'] as const,
  trend:       (type: string, period?: string) => [...analyticsKeys.all, 'trend', type, period] as const,
  alerts:      (ack: boolean) => [...analyticsKeys.all, 'alerts', ack] as const,
  report:      (start?: string, end?: string) => [...analyticsKeys.all, 'report', start, end] as const,
}

export function useHealthScore() {
  return useQuery({
    queryKey: analyticsKeys.healthScore(),
    queryFn:  analyticsApi.healthScore,
    staleTime: 5 * 60_000,
  })
}

export function useVitalTrend(
  vitalType: string,
  params?: { start_date?: string; end_date?: string; period?: string }
) {
  return useQuery({
    queryKey: analyticsKeys.trend(vitalType, params?.period),
    queryFn:  () => analyticsApi.trend(vitalType, params),
    enabled:  Boolean(vitalType),
    staleTime: 2 * 60_000,
  })
}

export function useAlerts(acknowledged = false) {
  return useQuery({
    queryKey: analyticsKeys.alerts(acknowledged),
    queryFn:  () => analyticsApi.alerts(acknowledged),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useInsightReport(start?: string, end?: string) {
  return useQuery({
    queryKey: analyticsKeys.report(start, end),
    queryFn:  () => analyticsApi.report(start, end),
    staleTime: 10 * 60_000,
  })
}
