"""Pydantic schemas for NITI: Auth, Onboarding, Voice NLP, Offers, and Bookings."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# --- Authentication & OTP ---
class OTPSendRequest(BaseModel):
    phone_number: str = Field(..., description="10-digit mobile number, with or without country code")
    role: str = Field(default="FARMER", description="Role: FARMER, CHC_MANAGER, OPERATOR")


class OTPSendResponse(BaseModel):
    success: bool
    message: str
    phone_number: str
    test_otp: str | None = None  # Provided in dev/demo mode


class OTPVerifyRequest(BaseModel):
    phone_number: str
    otp_code: str
    role: str = "FARMER"


class FarmerLoginRequest(BaseModel):
    phone_number: str | None = None
    otp_code: str | None = None
    email: str | None = None
    password: str | None = None


class RoleLoginRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    phone_number: str | None = None
    otp_code: str | None = None


class FarmerProfileSchema(BaseModel):
    id: int | None = None
    user_id: int
    preferred_language: str = "hi"
    village: str = ""
    district: str = ""
    state: str = "Punjab"
    latitude: float = 30.9010
    longitude: float = 75.8573
    farm_size: float = 5.0
    farm_size_unit: str = "acres"
    primary_crops: str = "Wheat, Paddy"
    seasonal_crops: str | None = None
    onboarding_completed: bool = False
    voice_speed: float = 1.0
    auto_speak: bool = True
    notifications_enabled: bool = True

    model_config = ConfigDict(from_attributes=True)


class FarmerProfileUpdateRequest(BaseModel):
    preferred_language: str | None = None
    full_name: str | None = None
    village: str | None = None
    district: str | None = None
    state: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    farm_size: float | None = None
    farm_size_unit: str | None = None
    primary_crops: str | None = None
    seasonal_crops: str | None = None
    onboarding_completed: bool | None = None
    voice_speed: float | None = None
    auto_speak: bool | None = None
    notifications_enabled: bool | None = None


class OperatorProfileSchema(BaseModel):
    id: int | None = None
    user_id: int
    skills: str = "Ploughing, Sowing"
    experience_years: float = 5.0
    supported_machinery: str = "TRACTOR, HARVESTER"
    license_number: str = "PB-DL-001"
    daily_working_hours: float = 8.0
    is_available: bool = True
    rating: float = 4.8
    total_jobs_completed: int = 15

    model_config = ConfigDict(from_attributes=True)


class OperatorProfileUpdateRequest(BaseModel):
    skills: str | None = None
    experience_years: float | None = None
    supported_machinery: str | None = None
    license_number: str | None = None
    daily_working_hours: float | None = None
    is_available: bool | None = None


class NitiLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    full_name: str
    phone_number: str | None
    email: str
    roles: list[str]
    is_new_user: bool = False
    farmer_profile: FarmerProfileSchema | None = None
    operator_profile: OperatorProfileSchema | None = None


# --- Voice NLP ---
class VoiceParseRequest(BaseModel):
    text: str = Field(..., description="Transcript of speech in Hindi, English, or Hinglish")
    language: str = Field(default="hi", description="Spoken language: hi, en, hinglish")
    farmer_lat: float | None = None
    farmer_lng: float | None = None


class ExtractedBookingParams(BaseModel):
    operation: str | None = None  # PLOUGHING, SOWING, HARVESTING, SPRAYING, TRANSPORTATION
    machine_type: str | None = None  # TRACTOR, HARVESTER, ROTAVATOR, SUPER_SEEDER, SPRAYER
    crop: str | None = None
    acreage: float | None = None
    acreage_unit: str = "acre"
    preferred_date: date | None = None
    preferred_time: str | None = None
    budget: float | None = None
    urgency: str = "NORMAL"
    location: str | None = None


class VoiceParseResponse(BaseModel):
    transcript: str
    extracted: ExtractedBookingParams
    is_complete: bool
    missing_fields: list[str]
    follow_up_prompt: str
    follow_up_prompt_en: str
    display_summary: str


class VoiceOfferExplanationRequest(BaseModel):
    offer_ids: list[int]
    acreage: float = 5.0
    question: str = ""
    language: str = "hi"


class VoiceOfferExplanationResponse(BaseModel):
    speech_text_hi: str
    speech_text_en: str
    cheaper_offer_id: int | None
    higher_rated_offer_id: int | None
    price_difference: float
    key_differences: list[str]
    comparison_table: list[dict[str, Any]]


# --- Offer Search & Comparison ---
class OfferSearchRequest(BaseModel):
    operation: str = Field(..., description="PLOUGHING, SOWING, HARVESTING, SPRAYING, etc.")
    crop: str = Field(default="Wheat")
    acreage: float = Field(default=5.0, ge=0.5)
    field_lat: float = Field(default=30.7600)
    field_lng: float = Field(default=75.8200)
    requested_date: date
    slot: str = Field(default="FULL_DAY")
    sort_by: str = Field(
        default="BEST_MATCH",
        description="BEST_MATCH, LOWEST_PRICE, HIGHEST_RATING, EARLIEST_ARRIVAL",
    )


class OfferItemResponse(BaseModel):
    id: int
    machine_id: int
    chc_id: int
    chc_name: str
    chc_phone: str
    machine_name: str
    machine_model: str
    machine_category: str
    horsepower: float
    rate_per_unit: Decimal
    rate_unit: str  # per acre or per hour
    total_quoted_price: Decimal
    operator_included: bool
    fuel_included: bool
    transportation_included: bool
    estimated_arrival_minutes: int
    estimated_work_duration_hours: float
    distance_km: float
    provider_rating: float
    review_count: int
    is_available: bool
    terms: str
    recommended: bool = False


class OfferSearchResponse(BaseModel):
    operation: str
    acreage: float
    total_offers_found: int
    offers: list[OfferItemResponse]


# --- NITI Booking Creation ---
class NitiBookingCreateRequest(BaseModel):
    offer_id: int
    field_latitude: float
    field_longitude: float
    acreage: float
    operation_type: str
    crop_type: str
    scheduled_date: date
    scheduled_slot: str = "FULL_DAY"
    notes: str | None = None


class BookingStatusEventResponse(BaseModel):
    id: int
    booking_id: int
    status: str
    title: str
    description: str
    actor_role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NitiBookingDetailResponse(BaseModel):
    id: int
    booking_code: str
    service_request_id: int
    chc_id: int
    chc_name: str
    farmer_id: int
    farmer_name: str
    farmer_phone: str | None
    machine_id: int | None
    machine_name: str | None
    machine_category: str | None
    operator_id: int | None
    operator_name: str | None
    operator_phone: str | None
    operation_type: str
    crop_type: str | None
    acreage: float
    scheduled_date: date
    scheduled_slot: str
    total_cost: Decimal
    payment_status: str
    status: str
    created_at: datetime
    events: list[BookingStatusEventResponse] = []

    model_config = ConfigDict(from_attributes=True)
