'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  allergiesApi, AllergyCreate,
  conditionsApi, ConditionCreate,
  encountersApi, EncounterCreate,
  immunizationsApi, ImmunizationCreate,
  labsApi, LabResultCreate,
  symptomsApi, SymptomCreate, SymptomOccurrenceCreate,
} from '@/lib/api/client'

// ── Conditions ────────────────────────────────────────────────────────────────

export function useConditions(params?: { status?: string }) {
  return useQuery({
    queryKey: ['conditions', params],
    queryFn:  () => conditionsApi.list(params),
    staleTime: 60_000,
  })
}

export function useCondition(id: string) {
  return useQuery({
    queryKey: ['conditions', id],
    queryFn:  () => conditionsApi.get(id),
    enabled:  !!id,
  })
}

export function useCreateCondition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ConditionCreate) => conditionsApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['conditions'] }),
  })
}

export function useUpdateCondition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<ConditionCreate>) =>
      conditionsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conditions'] }),
  })
}

export function useDeleteCondition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => conditionsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['conditions'] }),
  })
}

// ── Allergies ─────────────────────────────────────────────────────────────────

export function useAllergies(params?: { status?: string }) {
  return useQuery({
    queryKey: ['allergies', params],
    queryFn:  () => allergiesApi.list(params),
    staleTime: 120_000,
  })
}

export function useCreateAllergy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AllergyCreate) => allergiesApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['allergies'] }),
  })
}

export function useDeleteAllergy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => allergiesApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['allergies'] }),
  })
}

// ── Encounters ────────────────────────────────────────────────────────────────

export function useEncounters(params?: { visit_type?: string; start_date?: string; end_date?: string; page?: number }) {
  return useQuery({
    queryKey: ['encounters', params],
    queryFn:  () => encountersApi.list(params),
    staleTime: 60_000,
  })
}

export function useCreateEncounter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EncounterCreate) => encountersApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['encounters'] }),
  })
}

export function useDeleteEncounter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => encountersApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['encounters'] }),
  })
}

// ── Immunizations ─────────────────────────────────────────────────────────────

export function useImmunizations() {
  return useQuery({
    queryKey: ['immunizations'],
    queryFn:  () => immunizationsApi.list(),
    staleTime: 300_000,
  })
}

export function useCreateImmunization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ImmunizationCreate) => immunizationsApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['immunizations'] }),
  })
}

export function useDeleteImmunization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => immunizationsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['immunizations'] }),
  })
}

// ── Lab Results ───────────────────────────────────────────────────────────────

export function useLabResults(params?: { test_category?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ['labs', params],
    queryFn:  () => labsApi.list(params),
    staleTime: 60_000,
  })
}

export function useLabResult(id: string) {
  return useQuery({
    queryKey: ['labs', id],
    queryFn:  () => labsApi.get(id),
    enabled:  !!id,
  })
}

export function useCreateLabResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LabResultCreate) => labsApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['labs'] }),
  })
}

export function useDeleteLabResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => labsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['labs'] }),
  })
}

// ── Symptoms ──────────────────────────────────────────────────────────────────

export function useSymptoms(params?: { status?: string }) {
  return useQuery({
    queryKey: ['symptoms', params],
    queryFn:  () => symptomsApi.list(params),
    staleTime: 60_000,
  })
}

export function useSymptom(id: string) {
  return useQuery({
    queryKey: ['symptoms', id],
    queryFn:  () => symptomsApi.get(id),
    enabled:  !!id,
  })
}

export function useCreateSymptom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SymptomCreate) => symptomsApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['symptoms'] }),
  })
}

export function useLogSymptomOccurrence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SymptomOccurrenceCreate) =>
      symptomsApi.logOccurrence(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['symptoms', vars.id] })
      qc.invalidateQueries({ queryKey: ['symptoms'] })
    },
  })
}

export function useDeleteSymptom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => symptomsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['symptoms'] }),
  })
}
