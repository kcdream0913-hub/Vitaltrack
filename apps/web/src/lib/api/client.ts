'use client'

import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      body.error ?? `HTTP ${res.status}`,
      res.status,
      body.request_id,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ─── Vitals ───────────────────────────────────────────────────────────────────

export type VitalType =
  | 'heart_rate' | 'blood_pressure' | 'blood_glucose'
  | 'blood_oxygen' | 'body_temperature' | 'weight' | 'respiratory_rate'

export interface VitalCreate {
  vital_type:      VitalType
  value:           number
  unit:            string
  recorded_at:     string   // ISO 8601
  secondary_value?: number
  notes?:          string
  device_source?:  string
}

export interface VitalResponse {
  id:              string
  vital_type:      VitalType
  value:           number
  unit:            string
  recorded_at:     string
  secondary_value?: number
  notes?:          string
  device_source?:  string
  created_at:      string
}

export interface VitalsListParams {
  vital_type?: VitalType
  start_date?: string
  end_date?:   string
  page?:       number
  page_size?:  number
}

export const vitalsApi = {
  create:    (body: VitalCreate) =>
    apiFetch<VitalResponse>('/api/v1/vitals', { method: 'POST', body: JSON.stringify(body) }),

  list:      (params: VitalsListParams = {}) => {
    const q = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return apiFetch<VitalResponse[]>(`/api/v1/vitals${q ? '?' + q : ''}`)
  },

  latest:    () => apiFetch<{ readings: Record<string, VitalResponse>; as_of: string }>('/api/v1/vitals/latest'),

  get:       (id: string) => apiFetch<VitalResponse>(`/api/v1/vitals/${id}`),

  delete:    (id: string) => apiFetch<void>(`/api/v1/vitals/${id}`, { method: 'DELETE' }),
}

// ─── Medications ─────────────────────────────────────────────────────────────

export interface MedicationCreate {
  name:            string
  dosage:          string
  frequency:       string
  prescribed_by?:  string
  start_date:      string
  end_date?:       string
  notes?:          string
  reminder_enabled?: boolean
}

export interface MedicationResponse extends MedicationCreate {
  id:         string
  is_active:  boolean
  created_at: string
}

export interface AdherenceLogCreate {
  medication_id: string
  scheduled_at:  string
  taken_at?:     string
  was_taken:     boolean
  notes?:        string
}

export const medicationsApi = {
  create:        (body: MedicationCreate) =>
    apiFetch<MedicationResponse>('/api/v1/medications', { method: 'POST', body: JSON.stringify(body) }),

  list:          (is_active?: boolean) => {
    const q = is_active !== undefined ? `?is_active=${is_active}` : ''
    return apiFetch<MedicationResponse[]>(`/api/v1/medications${q}`)
  },

  get:           (id: string) => apiFetch<MedicationResponse>(`/api/v1/medications/${id}`),

  logAdherence:  (id: string, body: AdherenceLogCreate) =>
    apiFetch(`/api/v1/medications/${id}/adherence`, { method: 'POST', body: JSON.stringify(body) }),

  adherenceSummary: (days = 30) =>
    apiFetch(`/api/v1/medications/adherence/summary?days=${days}`),
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsApi = {
  trend:       (vital_type: string, params?: { start_date?: string; end_date?: string; period?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return apiFetch(`/api/v1/analytics/trends/${vital_type}${q}`)
  },
  healthScore: () => apiFetch('/api/v1/analytics/health-score'),
  alerts:      (acknowledged = false) =>
    apiFetch(`/api/v1/analytics/alerts?acknowledged=${acknowledged}`),
  report:      (start_date?: string, end_date?: string) => {
    const q = new URLSearchParams({
      ...(start_date ? { start_date } : {}),
      ...(end_date   ? { end_date   } : {}),
    }).toString()
    return apiFetch(`/api/v1/analytics/report${q ? '?' + q : ''}`)
  },
}

// ─── Clinical (MediKeep) ──────────────────────────────────────────────────────

export interface ConditionCreate {
  condition_name?: string
  diagnosis: string
  notes?: string
  onset_date?: string
  end_date?: string
  status?: string
  severity?: string
  icd10_code?: string
  snomed_code?: string
  code_description?: string
  prescribed_by?: string
  tags?: string[]
}
export interface ConditionResponse extends ConditionCreate {
  id: string; created_at: string; updated_at: string
}

export interface AllergyCreate {
  allergen: string; reaction: string
  severity?: string; onset_date?: string; status?: string
  notes?: string; medication_name?: string; tags?: string[]
}
export interface AllergyResponse extends AllergyCreate { id: string; created_at: string }

export interface EncounterCreate {
  reason: string; encounter_date: string
  notes?: string; visit_type?: string; chief_complaint?: string
  diagnosis?: string; treatment_plan?: string; follow_up_instructions?: string
  duration_minutes?: number; location?: string; priority?: string
  practitioner_name?: string; facility_name?: string
  condition_id?: string; tags?: string[]
}
export interface EncounterResponse extends EncounterCreate { id: string; created_at: string }

export interface ImmunizationCreate {
  vaccine_name: string; date_administered: string
  vaccine_trade_name?: string; dose_number?: number
  lot_number?: string; manufacturer?: string; site?: string
  route?: string; location?: string; notes?: string
  practitioner_name?: string; tags?: string[]
}
export interface ImmunizationResponse extends ImmunizationCreate { id: string; created_at: string }

export interface LabTestComponentCreate {
  test_name: string; result_type?: string
  value?: number; unit?: string; qualitative_value?: string
  ref_range_min?: number; ref_range_max?: number; ref_range_text?: string
  status?: string; category?: string; display_order?: number; notes?: string
}
export interface LabResultCreate {
  test_name: string; test_code?: string; test_category?: string
  test_type?: string; facility?: string; status?: string; labs_result?: string
  ordered_date?: string; completed_date?: string; notes?: string
  practitioner_name?: string; tags?: string[]
  components?: LabTestComponentCreate[]
}
export interface LabResultResponse extends Omit<LabResultCreate, 'components'> {
  id: string; created_at: string
  components: Array<LabTestComponentCreate & { id: string }>
}

export interface SymptomCreate {
  symptom_name: string; category?: string; status?: string
  is_chronic?: boolean; first_occurrence_date: string
  last_occurrence_date?: string; typical_triggers?: string[]
  general_notes?: string; tags?: string[]
}
export interface SymptomOccurrenceCreate {
  occurred_at: string; severity_scale?: number; duration_minutes?: number
  triggers?: string[]; relieving_factors?: string[]; resolved?: boolean; notes?: string
}
export interface SymptomResponse extends SymptomCreate {
  id: string; created_at: string; resolved_date?: string
  occurrences: Array<SymptomOccurrenceCreate & { id: string; symptom_id: string; created_at: string }>
}

function buildQuery(params: Record<string, unknown>) {
  const q = Object.entries(params).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])
  return q.length ? '?' + new URLSearchParams(q).toString() : ''
}

export const conditionsApi = {
  create: (b: ConditionCreate) => apiFetch<ConditionResponse>('/api/v1/conditions', { method: 'POST', body: JSON.stringify(b) }),
  list:   (p?: { status?: string; page?: number; page_size?: number }) =>
    apiFetch<ConditionResponse[]>(`/api/v1/conditions${buildQuery(p ?? {})}`),
  get:    (id: string) => apiFetch<ConditionResponse>(`/api/v1/conditions/${id}`),
  update: (id: string, b: Partial<ConditionCreate>) => apiFetch<ConditionResponse>(`/api/v1/conditions/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  delete: (id: string) => apiFetch<void>(`/api/v1/conditions/${id}`, { method: 'DELETE' }),
}

export const allergiesApi = {
  create: (b: AllergyCreate) => apiFetch<AllergyResponse>('/api/v1/allergies', { method: 'POST', body: JSON.stringify(b) }),
  list:   (p?: { status?: string }) => apiFetch<AllergyResponse[]>(`/api/v1/allergies${buildQuery(p ?? {})}`),
  get:    (id: string) => apiFetch<AllergyResponse>(`/api/v1/allergies/${id}`),
  update: (id: string, b: Partial<AllergyCreate>) => apiFetch<AllergyResponse>(`/api/v1/allergies/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  delete: (id: string) => apiFetch<void>(`/api/v1/allergies/${id}`, { method: 'DELETE' }),
}

export const encountersApi = {
  create: (b: EncounterCreate) => apiFetch<EncounterResponse>('/api/v1/encounters', { method: 'POST', body: JSON.stringify(b) }),
  list:   (p?: { visit_type?: string; start_date?: string; end_date?: string; page?: number }) =>
    apiFetch<EncounterResponse[]>(`/api/v1/encounters${buildQuery(p ?? {})}`),
  get:    (id: string) => apiFetch<EncounterResponse>(`/api/v1/encounters/${id}`),
  update: (id: string, b: Partial<EncounterCreate>) => apiFetch<EncounterResponse>(`/api/v1/encounters/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  delete: (id: string) => apiFetch<void>(`/api/v1/encounters/${id}`, { method: 'DELETE' }),
}

export const immunizationsApi = {
  create: (b: ImmunizationCreate) => apiFetch<ImmunizationResponse>('/api/v1/immunizations', { method: 'POST', body: JSON.stringify(b) }),
  list:   () => apiFetch<ImmunizationResponse[]>('/api/v1/immunizations'),
  get:    (id: string) => apiFetch<ImmunizationResponse>(`/api/v1/immunizations/${id}`),
  update: (id: string, b: Partial<ImmunizationCreate>) => apiFetch<ImmunizationResponse>(`/api/v1/immunizations/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  delete: (id: string) => apiFetch<void>(`/api/v1/immunizations/${id}`, { method: 'DELETE' }),
}

export const labsApi = {
  create: (b: LabResultCreate) => apiFetch<LabResultResponse>('/api/v1/labs', { method: 'POST', body: JSON.stringify(b) }),
  list:   (p?: { test_category?: string; status?: string; page?: number }) =>
    apiFetch<LabResultResponse[]>(`/api/v1/labs${buildQuery(p ?? {})}`),
  get:    (id: string) => apiFetch<LabResultResponse>(`/api/v1/labs/${id}`),
  delete: (id: string) => apiFetch<void>(`/api/v1/labs/${id}`, { method: 'DELETE' }),
}

export const symptomsApi = {
  create:      (b: SymptomCreate) => apiFetch<SymptomResponse>('/api/v1/symptoms', { method: 'POST', body: JSON.stringify(b) }),
  list:        (p?: { status?: string }) => apiFetch<SymptomResponse[]>(`/api/v1/symptoms${buildQuery(p ?? {})}`),
  get:         (id: string) => apiFetch<SymptomResponse>(`/api/v1/symptoms/${id}`),
  logOccurrence: (id: string, b: SymptomOccurrenceCreate) =>
    apiFetch(`/api/v1/symptoms/${id}/occurrences`, { method: 'POST', body: JSON.stringify(b) }),
  delete:      (id: string) => apiFetch<void>(`/api/v1/symptoms/${id}`, { method: 'DELETE' }),
}

export { ApiError }
