"""
Clinical domain router — conditions, allergies, encounters,
immunizations, lab results, symptoms.
All endpoints sourced from MediKeep, adapted for VitalTrack auth.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.api.v1.deps import CurrentUser, DbSession
from app.services.clinical_service import (
    AllergyService,
    ConditionService,
    EncounterService,
    ImmunizationService,
    LabResultService,
    SymptomService,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

# ── Condition ─────────────────────────────────────────────────────────────────

class ConditionCreate(BaseModel):
    condition_name: Optional[str] = Field(None, max_length=200)
    diagnosis: str = Field(..., min_length=1, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    onset_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = Field("active", pattern="^(active|inactive|resolved|chronic|recurrence|relapse)$")
    severity: Optional[str] = Field(None, pattern="^(mild|moderate|severe|critical)$")
    icd10_code: Optional[str] = Field(None, max_length=20)
    snomed_code: Optional[str] = Field(None, max_length=30)
    code_description: Optional[str] = Field(None, max_length=500)
    prescribed_by: Optional[str] = Field(None, max_length=120)
    tags: Optional[List[str]] = []


class ConditionResponse(BaseModel):
    id: UUID
    condition_name: Optional[str]
    diagnosis: str
    notes: Optional[str]
    onset_date: Optional[date]
    end_date: Optional[date]
    status: str
    severity: Optional[str]
    icd10_code: Optional[str]
    snomed_code: Optional[str]
    code_description: Optional[str]
    prescribed_by: Optional[str]
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Allergy ───────────────────────────────────────────────────────────────────

class AllergyCreate(BaseModel):
    allergen: str = Field(..., min_length=1, max_length=200)
    reaction: str = Field(..., min_length=1, max_length=500)
    severity: Optional[str] = Field(None, pattern="^(mild|moderate|severe|critical)$")
    onset_date: Optional[date] = None
    status: str = Field("active", pattern="^(active|inactive|resolved)$")
    notes: Optional[str] = Field(None, max_length=2000)
    medication_name: Optional[str] = Field(None, max_length=200)
    tags: Optional[List[str]] = []


class AllergyResponse(BaseModel):
    id: UUID
    allergen: str
    reaction: str
    severity: Optional[str]
    onset_date: Optional[date]
    status: str
    notes: Optional[str]
    medication_name: Optional[str]
    tags: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Encounter ─────────────────────────────────────────────────────────────────

class EncounterCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)
    encounter_date: date
    notes: Optional[str] = Field(None, max_length=5000)
    visit_type: Optional[str] = Field(None, max_length=60)
    chief_complaint: Optional[str] = Field(None, max_length=500)
    diagnosis: Optional[str] = Field(None, max_length=500)
    treatment_plan: Optional[str] = Field(None, max_length=5000)
    follow_up_instructions: Optional[str] = Field(None, max_length=2000)
    duration_minutes: Optional[int] = Field(None, ge=1, le=1440)
    location: Optional[str] = Field(None, max_length=100)
    priority: Optional[str] = Field(None, pattern="^(routine|urgent|emergency)$")
    practitioner_name: Optional[str] = Field(None, max_length=120)
    facility_name: Optional[str] = Field(None, max_length=200)
    condition_id: Optional[UUID] = None
    tags: Optional[List[str]] = []


class EncounterResponse(BaseModel):
    id: UUID
    reason: str
    encounter_date: date
    notes: Optional[str]
    visit_type: Optional[str]
    chief_complaint: Optional[str]
    diagnosis: Optional[str]
    treatment_plan: Optional[str]
    follow_up_instructions: Optional[str]
    duration_minutes: Optional[int]
    location: Optional[str]
    priority: Optional[str]
    practitioner_name: Optional[str]
    facility_name: Optional[str]
    condition_id: Optional[UUID]
    tags: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Immunization ──────────────────────────────────────────────────────────────

class ImmunizationCreate(BaseModel):
    vaccine_name: str = Field(..., min_length=1, max_length=200)
    vaccine_trade_name: Optional[str] = Field(None, max_length=200)
    date_administered: date
    dose_number: Optional[int] = Field(None, ge=1, le=99)
    ndc_number: Optional[str] = Field(None, max_length=50)
    lot_number: Optional[str] = Field(None, max_length=50)
    manufacturer: Optional[str] = Field(None, max_length=200)
    site: Optional[str] = Field(None, max_length=100)
    route: Optional[str] = Field(None, max_length=50)
    expiration_date: Optional[date] = None
    location: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=2000)
    practitioner_name: Optional[str] = Field(None, max_length=120)
    tags: Optional[List[str]] = []


class ImmunizationResponse(BaseModel):
    id: UUID
    vaccine_name: str
    vaccine_trade_name: Optional[str]
    date_administered: date
    dose_number: Optional[int]
    lot_number: Optional[str]
    manufacturer: Optional[str]
    site: Optional[str]
    route: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    practitioner_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Lab Results ───────────────────────────────────────────────────────────────

class LabTestComponentCreate(BaseModel):
    test_name: str = Field(..., max_length=200)
    abbreviation: Optional[str] = Field(None, max_length=30)
    test_code: Optional[str] = Field(None, max_length=30)
    result_type: str = Field("quantitative", pattern="^(quantitative|qualitative)$")
    value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=30)
    qualitative_value: Optional[str] = Field(None, max_length=50)
    ref_range_min: Optional[float] = None
    ref_range_max: Optional[float] = None
    ref_range_text: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(normal|high|low|critical)$")
    category: Optional[str] = Field(None, max_length=60)
    display_order: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=1000)


class LabTestComponentResponse(BaseModel):
    id: UUID
    test_name: str
    abbreviation: Optional[str]
    result_type: str
    value: Optional[float]
    unit: Optional[str]
    qualitative_value: Optional[str]
    ref_range_min: Optional[float]
    ref_range_max: Optional[float]
    ref_range_text: Optional[str]
    status: Optional[str]
    category: Optional[str]
    display_order: Optional[int]
    notes: Optional[str]

    class Config:
        from_attributes = True


class LabResultCreate(BaseModel):
    test_name: str = Field(..., min_length=1, max_length=300)
    test_code: Optional[str] = Field(None, max_length=50)
    test_category: Optional[str] = Field(None, max_length=60)
    test_type: Optional[str] = Field(None, max_length=60)
    facility: Optional[str] = Field(None, max_length=200)
    status: str = Field("ordered", pattern="^(ordered|in_progress|completed|cancelled)$")
    labs_result: Optional[str] = Field(None, pattern="^(normal|abnormal|critical|inconclusive)$")
    ordered_date: Optional[date] = None
    completed_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=5000)
    practitioner_name: Optional[str] = Field(None, max_length=120)
    tags: Optional[List[str]] = []
    components: Optional[List[LabTestComponentCreate]] = []


class LabResultResponse(BaseModel):
    id: UUID
    test_name: str
    test_code: Optional[str]
    test_category: Optional[str]
    facility: Optional[str]
    status: str
    labs_result: Optional[str]
    ordered_date: Optional[date]
    completed_date: Optional[date]
    notes: Optional[str]
    practitioner_name: Optional[str]
    tags: Optional[List[str]]
    components: List[LabTestComponentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Symptom ───────────────────────────────────────────────────────────────────

class SymptomCreate(BaseModel):
    symptom_name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    status: str = Field("active", pattern="^(active|resolved|chronic)$")
    is_chronic: bool = False
    first_occurrence_date: date
    last_occurrence_date: Optional[date] = None
    typical_triggers: Optional[List[str]] = []
    general_notes: Optional[str] = Field(None, max_length=2000)
    tags: Optional[List[str]] = []


class SymptomOccurrenceCreate(BaseModel):
    occurred_at: datetime
    severity_scale: Optional[int] = Field(None, ge=1, le=10)
    duration_minutes: Optional[int] = Field(None, ge=1)
    triggers: Optional[List[str]] = []
    relieving_factors: Optional[List[str]] = []
    resolved: bool = False
    notes: Optional[str] = Field(None, max_length=1000)


class SymptomOccurrenceResponse(BaseModel):
    id: UUID
    symptom_id: UUID
    occurred_at: datetime
    severity_scale: Optional[int]
    duration_minutes: Optional[int]
    triggers: Optional[List[str]]
    relieving_factors: Optional[List[str]]
    resolved: bool
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SymptomResponse(BaseModel):
    id: UUID
    symptom_name: str
    category: Optional[str]
    status: str
    is_chronic: bool
    first_occurrence_date: date
    last_occurrence_date: Optional[date]
    resolved_date: Optional[date]
    typical_triggers: Optional[List[str]]
    general_notes: Optional[str]
    tags: Optional[List[str]]
    occurrences: List[SymptomOccurrenceResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# CONDITION ENDPOINTS  /api/v1/conditions
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/conditions", response_model=ConditionResponse, status_code=status.HTTP_201_CREATED, summary="Add a condition")
async def create_condition(payload: ConditionCreate, user_id: CurrentUser, db: DbSession) -> Any:
    svc = ConditionService(db)
    return await svc.create(user_id=user_id, **payload.model_dump())


@router.get("/conditions", response_model=List[ConditionResponse], summary="List conditions")
async def list_conditions(
    user_id: CurrentUser, db: DbSession,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    svc = ConditionService(db)
    return await svc.list(user_id=user_id, status=status, page=page, page_size=page_size)


@router.get("/conditions/{condition_id}", response_model=ConditionResponse, summary="Get a condition")
async def get_condition(condition_id: UUID, user_id: CurrentUser, db: DbSession) -> Any:
    return await ConditionService(db).get_by_id(condition_id=condition_id, user_id=user_id)


@router.patch("/conditions/{condition_id}", response_model=ConditionResponse, summary="Update a condition")
async def update_condition(condition_id: UUID, payload: ConditionCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await ConditionService(db).update(condition_id=condition_id, user_id=user_id, **payload.model_dump(exclude_none=True))


@router.delete("/conditions/{condition_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a condition")
async def delete_condition(condition_id: UUID, user_id: CurrentUser, db: DbSession) -> None:
    await ConditionService(db).delete(condition_id=condition_id, user_id=user_id)


# ══════════════════════════════════════════════════════════════════════════════
# ALLERGY ENDPOINTS  /api/v1/allergies
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/allergies", response_model=AllergyResponse, status_code=status.HTTP_201_CREATED, summary="Add an allergy")
async def create_allergy(payload: AllergyCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await AllergyService(db).create(user_id=user_id, **payload.model_dump())


@router.get("/allergies", response_model=List[AllergyResponse], summary="List allergies")
async def list_allergies(
    user_id: CurrentUser, db: DbSession,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Any:
    return await AllergyService(db).list(user_id=user_id, status=status, page=page, page_size=page_size)


@router.get("/allergies/{allergy_id}", response_model=AllergyResponse, summary="Get an allergy")
async def get_allergy(allergy_id: UUID, user_id: CurrentUser, db: DbSession) -> Any:
    return await AllergyService(db).get_by_id(allergy_id=allergy_id, user_id=user_id)


@router.patch("/allergies/{allergy_id}", response_model=AllergyResponse, summary="Update an allergy")
async def update_allergy(allergy_id: UUID, payload: AllergyCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await AllergyService(db).update(allergy_id=allergy_id, user_id=user_id, **payload.model_dump(exclude_none=True))


@router.delete("/allergies/{allergy_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete an allergy")
async def delete_allergy(allergy_id: UUID, user_id: CurrentUser, db: DbSession) -> None:
    await AllergyService(db).delete(allergy_id=allergy_id, user_id=user_id)


# ══════════════════════════════════════════════════════════════════════════════
# ENCOUNTER ENDPOINTS  /api/v1/encounters
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/encounters", response_model=EncounterResponse, status_code=status.HTTP_201_CREATED, summary="Log an encounter")
async def create_encounter(payload: EncounterCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await EncounterService(db).create(user_id=user_id, **payload.model_dump())


@router.get("/encounters", response_model=List[EncounterResponse], summary="List encounters")
async def list_encounters(
    user_id: CurrentUser, db: DbSession,
    visit_type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    return await EncounterService(db).list(
        user_id=user_id, visit_type=visit_type,
        start_date=start_date, end_date=end_date,
        page=page, page_size=page_size,
    )


@router.get("/encounters/{encounter_id}", response_model=EncounterResponse, summary="Get an encounter")
async def get_encounter(encounter_id: UUID, user_id: CurrentUser, db: DbSession) -> Any:
    return await EncounterService(db).get_by_id(encounter_id=encounter_id, user_id=user_id)


@router.patch("/encounters/{encounter_id}", response_model=EncounterResponse, summary="Update an encounter")
async def update_encounter(encounter_id: UUID, payload: EncounterCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await EncounterService(db).update(encounter_id=encounter_id, user_id=user_id, **payload.model_dump(exclude_none=True))


@router.delete("/encounters/{encounter_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete an encounter")
async def delete_encounter(encounter_id: UUID, user_id: CurrentUser, db: DbSession) -> None:
    await EncounterService(db).delete(encounter_id=encounter_id, user_id=user_id)


# ══════════════════════════════════════════════════════════════════════════════
# IMMUNIZATION ENDPOINTS  /api/v1/immunizations
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/immunizations", response_model=ImmunizationResponse, status_code=status.HTTP_201_CREATED, summary="Log an immunization")
async def create_immunization(payload: ImmunizationCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await ImmunizationService(db).create(user_id=user_id, **payload.model_dump())


@router.get("/immunizations", response_model=List[ImmunizationResponse], summary="List immunizations")
async def list_immunizations(
    user_id: CurrentUser, db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Any:
    return await ImmunizationService(db).list(user_id=user_id, page=page, page_size=page_size)


@router.get("/immunizations/{immunization_id}", response_model=ImmunizationResponse, summary="Get an immunization")
async def get_immunization(immunization_id: UUID, user_id: CurrentUser, db: DbSession) -> Any:
    return await ImmunizationService(db).get_by_id(immunization_id=immunization_id, user_id=user_id)


@router.patch("/immunizations/{immunization_id}", response_model=ImmunizationResponse, summary="Update an immunization")
async def update_immunization(immunization_id: UUID, payload: ImmunizationCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await ImmunizationService(db).update(immunization_id=immunization_id, user_id=user_id, **payload.model_dump(exclude_none=True))


@router.delete("/immunizations/{immunization_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete an immunization")
async def delete_immunization(immunization_id: UUID, user_id: CurrentUser, db: DbSession) -> None:
    await ImmunizationService(db).delete(immunization_id=immunization_id, user_id=user_id)


# ══════════════════════════════════════════════════════════════════════════════
# LAB RESULT ENDPOINTS  /api/v1/labs
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/labs", response_model=LabResultResponse, status_code=status.HTTP_201_CREATED, summary="Add a lab result")
async def create_lab_result(payload: LabResultCreate, user_id: CurrentUser, db: DbSession) -> Any:
    data = payload.model_dump()
    components = data.pop("components", [])
    return await LabResultService(db).create(user_id=user_id, components=components, **data)


@router.get("/labs", response_model=List[LabResultResponse], summary="List lab results")
async def list_lab_results(
    user_id: CurrentUser, db: DbSession,
    test_category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    return await LabResultService(db).list(
        user_id=user_id, test_category=test_category,
        status=status, page=page, page_size=page_size,
    )


@router.get("/labs/{lab_result_id}", response_model=LabResultResponse, summary="Get a lab result with components")
async def get_lab_result(lab_result_id: UUID, user_id: CurrentUser, db: DbSession) -> Any:
    return await LabResultService(db).get_by_id(lab_result_id=lab_result_id, user_id=user_id)


@router.delete("/labs/{lab_result_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a lab result")
async def delete_lab_result(lab_result_id: UUID, user_id: CurrentUser, db: DbSession) -> None:
    await LabResultService(db).delete(lab_result_id=lab_result_id, user_id=user_id)


# ══════════════════════════════════════════════════════════════════════════════
# SYMPTOM ENDPOINTS  /api/v1/symptoms
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/symptoms", response_model=SymptomResponse, status_code=status.HTTP_201_CREATED, summary="Add a symptom")
async def create_symptom(payload: SymptomCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await SymptomService(db).create(user_id=user_id, **payload.model_dump())


@router.get("/symptoms", response_model=List[SymptomResponse], summary="List symptoms")
async def list_symptoms(
    user_id: CurrentUser, db: DbSession,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
) -> Any:
    return await SymptomService(db).list(user_id=user_id, status=status, page=page, page_size=page_size)


@router.get("/symptoms/{symptom_id}", response_model=SymptomResponse, summary="Get a symptom with occurrences")
async def get_symptom(symptom_id: UUID, user_id: CurrentUser, db: DbSession) -> Any:
    return await SymptomService(db).get_by_id(symptom_id=symptom_id, user_id=user_id)


@router.post("/symptoms/{symptom_id}/occurrences", response_model=SymptomOccurrenceResponse, status_code=status.HTTP_201_CREATED, summary="Log a symptom occurrence")
async def log_occurrence(symptom_id: UUID, payload: SymptomOccurrenceCreate, user_id: CurrentUser, db: DbSession) -> Any:
    return await SymptomService(db).log_occurrence(
        symptom_id=symptom_id, user_id=user_id, **payload.model_dump()
    )


@router.delete("/symptoms/{symptom_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a symptom")
async def delete_symptom(symptom_id: UUID, user_id: CurrentUser, db: DbSession) -> None:
    await SymptomService(db).delete(symptom_id=symptom_id, user_id=user_id)
