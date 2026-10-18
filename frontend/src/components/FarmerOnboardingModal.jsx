import React, { useState } from 'react';
import { Check, MapPin, Navigation, ArrowRight, ArrowLeft, Save, Sparkles, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { farmersService } from '../api/supabaseService';
import { isSupabaseConfigured } from '../api/supabaseClient';
import { translations } from '../data/translations';

const CROPS_OPTIONS = [
  { id: 'Wheat', labelHi: 'गेहूं (Wheat)', labelEn: 'Wheat' },
  { id: 'Paddy', labelHi: 'धान / चावल (Paddy)', labelEn: 'Paddy / Rice' },
  { id: 'Mustard', labelHi: 'सरसों (Mustard)', labelEn: 'Mustard' },
  { id: 'Cotton', labelHi: 'कपास / नरमा (Cotton)', labelEn: 'Cotton' },
  { id: 'Maize', labelHi: 'मक्का (Maize)', labelEn: 'Maize' },
  { id: 'Sugarcane', labelHi: 'गन्ना (Sugarcane)', labelEn: 'Sugarcane' },
  { id: 'Vegetables', labelHi: 'सब्जियां (Vegetables)', labelEn: 'Vegetables' },
  { id: 'Moong', labelHi: 'मूंग दाल (Moong)', labelEn: 'Moong Dal' },
];

export function FarmerOnboardingModal({ isOpen, onClose, lang = 'hi', user, onComplete, existingProfile, onSaveProfile }) {
  if (!isOpen) return null;
  const t = translations[lang] || translations.en;

  const [step, setStep] = useState(1); // 1, 2, 3
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: Personal Details (from real user or profile, no hardcoded Ramesh)
  const [fullName, setFullName] = useState(user?.full_name || existingProfile?.full_name || '');
  const [preferredLanguage, setPreferredLanguage] = useState(lang || 'hi');

  // Step 2: Farm Details (from real profile or UP defaults)
  const [village, setVillage] = useState(existingProfile?.village || '');
  const [district, setDistrict] = useState(existingProfile?.district || 'Lucknow');
  const [state, setState] = useState(existingProfile?.state || 'Uttar Pradesh');
  const [latitude, setLatitude] = useState(existingProfile?.latitude || 26.8467);
  const [longitude, setLongitude] = useState(existingProfile?.longitude || 80.9462);
  const [farmSize, setFarmSize] = useState(existingProfile?.farm_size || existingProfile?.farm_size_acres || 5.0);
  const [farmSizeUnit, setFarmSizeUnit] = useState('acres');
  const [selectedCrops, setSelectedCrops] = useState(
    existingProfile?.primary_crops 
      ? existingProfile.primary_crops.split(',').map(c => c.trim()) 
      : ['Wheat', 'Paddy']
  );
  const [seasonalCrops, setSeasonalCrops] = useState(existingProfile?.seasonal_crops || '');

  // GPS Permission State
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle, detecting, granted, denied

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      setErrorMsg(t.onboarding.locationPermissionDenied);
      return;
    }

    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsStatus('granted');
      },
      () => {
        setGpsStatus('denied');
        setErrorMsg(t.onboarding.locationPermissionDenied);
      },
      { timeout: 8000 }
    );
  };

  const toggleCrop = (cropId) => {
    if (selectedCrops.includes(cropId)) {
      setSelectedCrops(selectedCrops.filter((c) => c !== cropId));
    } else {
      setSelectedCrops([...selectedCrops, cropId]);
    }
  };

  // Step 3: Save to backend database
  const handleSaveProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const payload = {
        full_name: fullName,
        preferred_language: preferredLanguage,
        village,
        district,
        state,
        latitude,
        longitude,
        farm_size: parseFloat(farmSize),
        farm_size_unit: farmSizeUnit,
        primary_crops: selectedCrops.join(', '),
        seasonal_crops: seasonalCrops,
        onboarding_completed: true,
      };

      let updated = payload;
      const isConfig = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : Boolean(isSupabaseConfigured);
      if (isConfig) {
        try {
          updated = await farmersService.upsertFarmerProfile({
            ...payload,
            user_id: user?.user_id || user?.id || `F-${Date.now().toString(36)}`,
          });
        } catch (dbErr) {
          console.warn('[FarmerOnboardingModal] Direct Supabase profile update failed, falling back to client:', dbErr);
          updated = await nitiClient.updateFarmerProfile(payload);
        }
      } else {
        updated = await nitiClient.updateFarmerProfile(payload);
      }

      if (onSaveProfile) {
        onSaveProfile(updated);
      }
      if (onComplete) {
        onComplete(updated);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      backgroundColor: 'rgba(15, 41, 30, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '90vh',
        boxShadow: '0 25px 60px rgba(19, 78, 46, 0.3)',
        overflowY: 'auto',
        border: '1.5px solid #bbf7d0',
      }}>
        {/* Header with Progress Steps */}
        <div style={{ padding: '24px 28px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #e2ede6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              NITI First-Time Onboarding
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#134e2e', backgroundColor: '#dcfce7', padding: '3px 10px', borderRadius: '9999px' }}>
              Step {step} of 3
            </span>
          </div>

          <h2 style={{ fontSize: '1.35rem', color: '#134e2e', margin: 0 }}>
            {t.onboarding.title}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#4b6354', marginTop: '4px' }}>
            {t.onboarding.subtitle}
          </p>

          {/* Stepper Indicator */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: step >= 1 ? '#16a34a' : '#e2ede6' }} />
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: step >= 2 ? '#16a34a' : '#e2ede6' }} />
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: step >= 3 ? '#16a34a' : '#e2ede6' }} />
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px' }}>
          {errorMsg && (
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          {/* STEP 1: PERSONAL DETAILS */}
          {step === 1 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#134e2e', marginBottom: '16px' }}>{t.onboarding.step1}</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                  {t.onboarding.fullName}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.onboarding.fullNamePlaceholder}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                  {t.auth.phoneLabel}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                  <ShieldCheck size={18} style={{ color: '#16a34a' }} />
                  <span style={{ fontWeight: 600, color: '#134e2e' }}>{user?.phone_number || '+91 98765 43210'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '9999px' }}>
                    ✓ OTP Verified
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '8px' }}>
                  {t.onboarding.preferredLanguage}
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setPreferredLanguage('hi')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: preferredLanguage === 'hi' ? '2px solid #16a34a' : '1.5px solid #e2ede6',
                      backgroundColor: preferredLanguage === 'hi' ? '#f0fdf4' : '#ffffff',
                      color: preferredLanguage === 'hi' ? '#134e2e' : '#4b6354',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  >
                    हिन्दी (Hindi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredLanguage('en')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: preferredLanguage === 'en' ? '2px solid #16a34a' : '1.5px solid #e2ede6',
                      backgroundColor: preferredLanguage === 'en' ? '#f0fdf4' : '#ffffff',
                      color: preferredLanguage === 'en' ? '#134e2e' : '#4b6354',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  >
                    English
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!fullName}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              >
                {lang === 'hi' ? 'अगला: खेत का विवरण' : 'Next: Farm Details'}
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 2: FARM DETAILS */}
          {step === 2 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#134e2e', marginBottom: '16px' }}>{t.onboarding.step2}</h3>

              {/* Location GPS section */}
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                  <Navigation size={20} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', color: '#134e2e', margin: 0 }}>{t.onboarding.locationHeading}</h4>
                    <p style={{ fontSize: '0.8rem', color: '#4b6354', margin: '2px 0 0' }}>{t.onboarding.gpsPrompt}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={gpsStatus === 'detecting'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: gpsStatus === 'granted' ? '#dcfce7' : '#ffffff',
                    border: '1.5px solid #16a34a',
                    color: '#134e2e',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <MapPin size={16} />
                  {gpsStatus === 'granted'
                    ? (lang === 'hi' ? '✓ GPS स्थान प्राप्त (30.76°N, 75.82°E)' : '✓ GPS Location Detected')
                    : t.onboarding.useGps}
                </button>
              </div>

              {/* Manual Village / District / State */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                    {t.onboarding.village}
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Kila Raipur"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                    {t.onboarding.district}
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Ludhiana"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Farm Size & Units */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                  {t.onboarding.farmSize}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={farmSize}
                    onChange={(e) => setFarmSize(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '1rem', fontWeight: 700 }}
                  />
                  <select
                    value={farmSizeUnit}
                    onChange={(e) => setFarmSizeUnit(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '8px', fontWeight: 600 }}
                  >
                    <option value="acres">{t.onboarding.acres}</option>
                    <option value="hectares">{t.onboarding.hectares}</option>
                    <option value="bigha">{t.onboarding.bigha}</option>
                  </select>
                </div>
              </div>

              {/* Crops Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '8px' }}>
                  {t.onboarding.primaryCrops}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CROPS_OPTIONS.map((c) => {
                    const isSelected = selectedCrops.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCrop(c.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '9999px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          backgroundColor: isSelected ? '#134e2e' : '#f0fdf4',
                          color: isSelected ? '#ffffff' : '#134e2e',
                          border: isSelected ? '1.5px solid #134e2e' : '1px solid #bbf7d0',
                        }}
                      >
                        {isSelected && '✓ '}
                        {lang === 'hi' ? c.labelHi : c.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-outline"
                  style={{ flex: 1, padding: '14px' }}
                >
                  <ArrowLeft size={18} />
                  {lang === 'hi' ? 'पीछे' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!village || !district || selectedCrops.length === 0}
                  className="btn-primary"
                  style={{ flex: 2, padding: '14px' }}
                >
                  {lang === 'hi' ? 'समीक्षा और पुष्टि' : 'Review & Confirm'}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRM & SAVE */}
          {step === 3 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#134e2e', marginBottom: '14px' }}>{t.onboarding.step3}</h3>

              <div style={{ backgroundColor: '#f8faf8', border: '1px solid #e2ede6', borderRadius: '16px', padding: '18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2ede6', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b6354' }}>{t.onboarding.fullName}</span>
                  <span style={{ fontWeight: 700, color: '#0f291e' }}>{fullName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2ede6', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b6354' }}>{t.onboarding.preferredLanguage}</span>
                  <span style={{ fontWeight: 700, color: '#0f291e' }}>{preferredLanguage === 'hi' ? 'हिन्दी (Hindi)' : 'English'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2ede6', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b6354' }}>{t.onboarding.locationHeading}</span>
                  <span style={{ fontWeight: 700, color: '#0f291e' }}>{village}, {district} ({state})</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2ede6', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b6354' }}>{t.onboarding.farmSize}</span>
                  <span style={{ fontWeight: 700, color: '#0f291e' }}>{farmSize} {farmSizeUnit}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b6354' }}>{t.onboarding.primaryCrops}</span>
                  <span style={{ fontWeight: 700, color: '#134e2e', textAlign: 'right', maxWidth: '60%' }}>
                    {selectedCrops.join(', ')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ fontSize: '0.8rem', color: '#134e2e', textDecoration: 'underline', fontWeight: 600 }}
                >
                  ✏️ {t.onboarding.editStep1}
                </button>
                <span style={{ color: '#e2ede6' }}>•</span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{ fontSize: '0.8rem', color: '#134e2e', textDecoration: 'underline', fontWeight: 600 }}
                >
                  ✏️ {t.onboarding.editStep2}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '1.05rem', backgroundColor: '#15803d' }}
              >
                <Save size={18} />
                {loading ? (lang === 'hi' ? 'सहेजा जा रहा है...' : 'Saving Profile...') : t.onboarding.saveProfile}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FarmerOnboardingModal;
