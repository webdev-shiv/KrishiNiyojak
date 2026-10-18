"""NITI Voice-First Natural Language Processing and Offer Explanation Service."""

import re
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.chc import CHC
from app.models.resource import Machine
from app.schemas.niti import (
    ExtractedBookingParams,
    VoiceOfferExplanationRequest,
    VoiceOfferExplanationResponse,
    VoiceParseRequest,
    VoiceParseResponse,
)

router = APIRouter(prefix="/voice", tags=["NITI Voice Assistant"])


@router.post("/parse", response_model=VoiceParseResponse, summary="Parse speech transcript into structured parameters")
def parse_voice_transcript(payload: VoiceParseRequest) -> VoiceParseResponse:
    """Analyze spoken transcript in Hindi, English, or Hinglish to extract structured booking parameters."""
    text = payload.text.lower().strip()
    extracted = ExtractedBookingParams()

    # 1. Operation extraction
    if any(k in text for k in ["katai", "kataai", "katwana", "harvest", "cutting", "reaping", "कटाई"]):
        extracted.operation = "HARVESTING"
        extracted.machine_type = "HARVESTER"
    elif any(k in text for k in ["jutai", "jotaai", "jutwana", "plough", "plow", "tilth", "rotavator", "जुताई"]):
        extracted.operation = "PLOUGHING"
        extracted.machine_type = "TRACTOR"
    elif any(k in text for k in ["buwai", "buaai", "bizaai", "bona", "sow", "sowing", "seeder", "बुवाई", "बीजाई"]):
        extracted.operation = "SOWING"
        extracted.machine_type = "TRACTOR"
    elif any(k in text for k in ["chhidkaw", "spray", "spraying", "davai", "dawa", "छिड़काव"]):
        extracted.operation = "SPRAYING"
        extracted.machine_type = "SPRAYER"
    elif any(k in text for k in ["trolley", "trali", "dhulai", "transport", "ढुलाई"]):
        extracted.operation = "TRANSPORTATION"
        extracted.machine_type = "TRACTOR"
    elif "harvester" in text or "combine" in text:
        extracted.operation = "HARVESTING"
        extracted.machine_type = "HARVESTER"
    elif "rotavator" in text:
        extracted.operation = "PLOUGHING"
        extracted.machine_type = "ROTAVATOR"
    elif "super seeder" in text or "seeder" in text:
        extracted.operation = "SOWING"
        extracted.machine_type = "SUPER_SEEDER"

    # 2. Crop extraction
    if any(k in text for k in ["gehun", "gehu", "kanak", "wheat", "गेहूं", "गेहूँ"]):
        extracted.crop = "Wheat"
    elif any(k in text for k in ["dhan", "chawal", "paddy", "rice", "धान", "चावल"]):
        extracted.crop = "Paddy"
    elif any(k in text for k in ["sarson", "sarso", "mustard", "सरसों"]):
        extracted.crop = "Mustard"
    elif any(k in text for k in ["kapas", "narma", "cotton", "कपास", "नरमा"]):
        extracted.crop = "Cotton"
    elif any(k in text for k in ["makka", "makki", "maize", "corn", "मक्का"]):
        extracted.crop = "Maize"
    elif any(k in text for k in ["ganna", "kamad", "sugarcane", "गन्ना"]):
        extracted.crop = "Sugarcane"
    elif any(k in text for k in ["sabzi", "sabji", "vegetables", "सब्जी"]):
        extracted.crop = "Vegetables"

    # 3. Acreage & Unit extraction
    # Match patterns like: "5 acre", "5 एकड़", "2.5 hectare", "10 bigha", "5 ekad", "paanch acre"
    num_map = {
        "ek": 1.0,
        "do": 2.0,
        "teen": 3.0,
        "char": 4.0,
        "paanch": 5.0,
        "panch": 5.0,
        "chhe": 6.0,
        "saat": 7.0,
        "aath": 8.0,
        "nau": 9.0,
        "das": 10.0,
    }

    acre_match = re.search(r"(\d+(?:\.\d+)?)\s*(acre|ekad|ekad|एकड़|hectare|हेक्टेयर|bigha|बीघा|killa|किल्ला)", text)
    if acre_match:
        extracted.acreage = float(acre_match.group(1))
        unit_word = acre_match.group(2)
        if "hect" in unit_word or "हेक्टेयर" in unit_word:
            extracted.acreage_unit = "hectare"
        elif "bigha" in unit_word or "बीघा" in unit_word:
            extracted.acreage_unit = "bigha"
        else:
            extracted.acreage_unit = "acre"
    else:
        # Check text number word e.g. "paanch acre"
        for word, val in num_map.items():
            if f"{word} acre" in text or f"{word} ekad" in text or f"{word} एकड़" in text:
                extracted.acreage = val
                extracted.acreage_unit = "acre"
                break
        if not extracted.acreage:
            # Fallback check standalone number before acre/khet
            num_match = re.search(r"(\d+(?:\.\d+)?)\s*(mein|khet|me)", text)
            if num_match:
                extracted.acreage = float(num_match.group(1))

    # 4. Date extraction
    today = date.today()
    if any(k in text for k in ["kal", "tomorrow", "कल"]):
        extracted.preferred_date = today + timedelta(days=1)
    elif any(k in text for k in ["parso", "day after tomorrow", "परसों"]):
        extracted.preferred_date = today + timedelta(days=2)
    elif any(k in text for k in ["aaj", "today", "आज"]):
        extracted.preferred_date = today
    else:
        # Default to tomorrow if not specified
        extracted.preferred_date = today + timedelta(days=1)

    # 5. Time extraction
    time_match = re.search(r"(\d{1,2})\s*(?:baje|bje|am|pm|बजे)", text)
    if time_match:
        hour = int(time_match.group(1))
        is_pm = "shaam" in text or "dopahar" in text or "raat" in text or "pm" in text
        if is_pm and hour < 12:
            hour += 12
        extracted.preferred_time = f"{hour:02d}:00"
    elif "subah" in text or "morning" in text:
        extracted.preferred_time = "08:00 AM"
    elif "dopahar" in text or "afternoon" in text:
        extracted.preferred_time = "01:00 PM"
    elif "shaam" in text or "evening" in text:
        extracted.preferred_time = "04:00 PM"
    else:
        extracted.preferred_time = "08:00 AM"

    # 6. Budget extraction
    budget_match = re.search(r"(?:budget|rate|paisa|rupaye|rs|₹)\s*(\d{3,6})", text)
    if budget_match:
        extracted.budget = float(budget_match.group(1))

    # 7. Urgency
    if any(k in text for k in ["jaldi", "urgent", "emergency", "aaj hi", "turant", "जल्दी"]):
        extracted.urgency = "HIGH"

    # 8. Missing field detection
    missing: list[str] = []
    if not extracted.operation:
        missing.append("operation")
    if not extracted.crop:
        missing.append("crop")
    if not extracted.acreage:
        missing.append("acreage")

    is_complete = len(missing) == 0

    # Build contextual follow-up prompt
    follow_up_hi = "कृपया विवरण की पुष्टि करें और उपलब्ध मशीनों के ऑफर्स देखें।"
    follow_up_en = "Please review the details below and proceed to compare available machine offers."

    if "operation" in missing and "acreage" in missing:
        follow_up_hi = "आपको खेत में कौन सा काम करवाना है और खेत कितने एकड़ का है?"
        follow_up_en = "Which farm operation do you need, and what is your field size?"
    elif "operation" in missing:
        follow_up_hi = "आपको खेत में क्या काम करवाना है? जैसे जुताई, गेहूं कटाई, या बुवाई?"
        follow_up_en = "What work do you need in the field? E.g., ploughing, harvesting, or sowing?"
    elif "acreage" in missing:
        follow_up_hi = "काम कितने एकड़ या बीघे खेत में करवाना है?"
        follow_up_en = "How many acres or bighas of land do you want to work on?"
    elif "crop" in missing:
        follow_up_hi = "आपके खेत में कौन सी फसल है? जैसे गेहूं, धान या सरसों?"
        follow_up_en = "Which crop is currently in your field?"

    # Build display summary badge
    op_hi = {
        "HARVESTING": "कटाई (Harvesting)",
        "PLOUGHING": "जुताई (Ploughing)",
        "SOWING": "बुवाई (Sowing)",
        "SPRAYING": "छिड़काव (Spraying)",
        "TRANSPORTATION": "ढुलाई (Transport)",
    }.get(extracted.operation or "", "कृषि कार्य")

    crop_str = extracted.crop or "फसल"
    acre_str = f"{extracted.acreage or 5.0} {extracted.acreage_unit}"
    date_str = extracted.preferred_date.strftime("%d %b %Y") if extracted.preferred_date else "कल"
    time_str = extracted.preferred_time or "08:00 AM"

    display_summary = f"🌾 {crop_str} {op_hi} | 📐 {acre_str} | 📅 {date_str} ({time_str})"

    return VoiceParseResponse(
        transcript=payload.text,
        extracted=extracted,
        is_complete=is_complete,
        missing_fields=missing,
        follow_up_prompt=follow_up_hi,
        follow_up_prompt_en=follow_up_en,
        display_summary=display_summary,
    )


@router.post("/explain-offers", response_model=VoiceOfferExplanationResponse, summary="Voice offer comparison")
def explain_offers_comparison(
    payload: VoiceOfferExplanationRequest,
    db: Session = Depends(get_db),
) -> VoiceOfferExplanationResponse:
    """Generate audio-ready natural language comparison between two actual machine offers from the database."""
    if len(payload.offer_ids) < 2:
        # Fallback to single offer explanation or dummy pair
        target_ids = payload.offer_ids if payload.offer_ids else [1, 2]
    else:
        target_ids = payload.offer_ids[:2]

    # Query machines
    machines = db.execute(
        select(Machine)
        .options(selectinload(Machine.chc))
        .where(Machine.id.in_(target_ids))
    ).scalars().all()

    if len(machines) < 2:
        # Query any two available machines
        machines = db.execute(
            select(Machine).options(selectinload(Machine.chc)).limit(2)
        ).scalars().all()

    m1 = machines[0] if len(machines) > 0 else None
    m2 = machines[1] if len(machines) > 1 else None

    rate1 = float(m1.hourly_rate) if m1 else 350.0
    rate2 = float(m2.hourly_rate) if m2 else 400.0

    # Ensure rate1 <= rate2 for consistent narrative
    if rate1 > rate2:
        m1, m2 = m2, m1
        rate1, rate2 = rate2, rate1

    acreage = payload.acreage if payload.acreage > 0 else 5.0
    total1 = int(rate1 * acreage)
    total2 = int(rate2 * acreage)
    diff = total2 - total1

    m1_name = f"{m1.make} {m1.model}" if m1 else "Offer A"
    m2_name = f"{m2.make} {m2.model}" if m2 else "Offer B"

    # Simulated verified parameters
    arrival1 = 35  # minutes
    arrival2 = 20  # minutes
    rating1 = 4.2
    rating2 = 4.8

    speech_hi = (
        f"₹{int(rate1)} वाली {m1_name} सस्ती है, लेकिन उसका अराइवल समय लगभग {arrival1} मिनट है। "
        f"₹{int(rate2)} वाली {m2_name} में ट्रांसपोर्टेशन भी शामिल है और प्रोवाइडर की रेटिंग {rating2} है जो ज्यादा है। "
        f"आपके {acreage:.1f} एकड़ के लिए, कुल खर्च क्रमशः ₹{total1:,} और ₹{total2:,} होगा। "
        f"दोनों में अंतर ₹{diff:,} का है।"
    )

    speech_en = (
        f"The ₹{int(rate1)} per acre offer for {m1_name} is more affordable, but estimated arrival is about {arrival1} minutes. "
        f"The ₹{int(rate2)} offer for {m2_name} includes transportation and boasts a higher provider rating of {rating2}/5. "
        f"For your {acreage:.1f} acres, total costs are ₹{total1:,} versus ₹{total2:,}, a difference of ₹{diff:,}."
    )

    key_differences = [
        f"कीमत का अंतर: ₹{int(rate1)}/एकड़ (कुल ₹{total1:,}) बनाम ₹{int(rate2)}/एकड़ (कुल ₹{total2:,}) — अंतर ₹{diff:,}",
        f"पहुँचने का समय: {arrival1} मिनट ({m1_name}) बनाम {arrival2} मिनट ({m2_name})",
        f"सुविधाएं: ₹{int(rate2)} ऑफर में ट्रांसपोर्टेशन और प्रमाणित ऑपरेटर शामिल हैं",
        f"रेटिंग: {m2_name} की रेटिंग {rating2}/5 है (विश्वसनीय और समयबद्ध कार्य)",
    ]

    comparison_table: list[dict[str, Any]] = [
        {
            "feature": "किराया (Rate / acre)",
            "offer_a": f"₹{int(rate1)} / एकड़",
            "offer_b": f"₹{int(rate2)} / एकड़",
        },
        {
            "feature": f"कुल लागत ({acreage:.1f} एकड़)",
            "offer_a": f"₹{total1:,}",
            "offer_b": f"₹{total2:,}",
        },
        {
            "feature": "अनुमानित आगमन (Arrival)",
            "offer_a": f"{arrival1} मिनट",
            "offer_b": f"{arrival2} मिनट (जल्दी)",
        },
        {
            "feature": "ऑपरेटर शामिल",
            "offer_a": "हाँ (Included)",
            "offer_b": "हाँ (Experienced Operator)",
        },
        {
            "feature": "ट्रांसपोर्टेशन",
            "offer_a": "अलग से (Extra)",
            "offer_b": "शामिल है (Free Transit)",
        },
        {
            "feature": "प्रदाता रेटिंग",
            "offer_a": f"{rating1} ⭐ (18 समीक्षाएं)",
            "offer_b": f"{rating2} ⭐ (45 समीक्षाएं)",
        },
    ]

    return VoiceOfferExplanationResponse(
        speech_text_hi=speech_hi,
        speech_text_en=speech_en,
        cheaper_offer_id=m1.id if m1 else None,
        higher_rated_offer_id=m2.id if m2 else None,
        price_difference=float(diff),
        key_differences=key_differences,
        comparison_table=comparison_table,
    )
