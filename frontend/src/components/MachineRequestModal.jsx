import React, { useState, useEffect } from 'react';
import { 
  X, 
  Tractor, 
  MapPin, 
  Calendar, 
  Clock, 
  IndianRupee, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Check
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { machineryService } from '../api/supabaseService';
import { isSupabaseConfigured } from '../api/supabaseClient';
import { NitiMap } from './NitiMap';

export const MachineRequestModal = ({ 
  isOpen, 
  onClose, 
  onOffersFound, 
  farmerProfile, 
  lang = 'hi', 
  t 
}) => {
  const [showMapPicker, setShowMapPicker] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({
    operation: 'HARVESTING',
    machine_type: 'HARVESTER',
    crop: farmerProfile?.primary_crops?.split(',')?.[0]?.trim() || farmerProfile?.crops_grown?.[0] || 'Wheat',
    farm_area: farmerProfile?.farm_size != null ? String(farmerProfile.farm_size) : '1.19',
    field_location: farmerProfile?.village 
      ? `${farmerProfile.village}, ${farmerProfile.district || 'Uttar Pradesh'}` 
      : (farmerProfile?.district ? `${farmerProfile.district}, Uttar Pradesh` : 'Dhanipur Kalan, Agra, Uttar Pradesh'),
    preferred_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    preferred_time: '08:00',
    deadline: '',
    budget: '',
    requirements: '',
    latitude: farmerProfile?.latitude || 27.1767,
    longitude: farmerProfile?.longitude || 78.0081
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Sync initial farm size if profile updates
  useEffect(() => {
    if (farmerProfile) {
      setFormData(prev => ({
        ...prev,
        crop: prev.crop || farmerProfile?.primary_crops?.split(',')?.[0]?.trim() || 'Wheat',
        farm_area: prev.farm_area || (farmerProfile?.farm_size != null ? String(farmerProfile.farm_size) : '1.19'),
        field_location: prev.field_location || (farmerProfile?.village 
          ? `${farmerProfile.village}, ${farmerProfile.district || 'Uttar Pradesh'}` 
          : 'Uttar Pradesh'),
        latitude: farmerProfile?.latitude || prev.latitude || 27.1767,
        longitude: farmerProfile?.longitude || prev.longitude || 78.0081
      }));
    }
  }, [farmerProfile]);

  if (!isOpen) return null;

  const operations = [
    { value: 'HARVESTING', labelEn: 'Harvesting (कटाई)', labelHi: 'कटाई (Harvesting)', defaultMachine: 'HARVESTER' },
    { value: 'PLOUGHING', labelEn: 'Ploughing / Tillage (जुताई)', labelHi: 'जुताई (Ploughing)', defaultMachine: 'TRACTOR' },
    { value: 'SOWING', labelEn: 'Sowing / Seeding (बुआई)', labelHi: 'बुआई (Sowing)', defaultMachine: 'TRACTOR' },
    { value: 'SPRAYING', labelEn: 'Spraying / Protection (छिड़काव)', labelHi: 'छिड़काव (Spraying)', defaultMachine: 'SPRAYER' },
    { value: 'THRESHING', labelEn: 'Threshing (गहाई)', labelHi: 'गहाई (Threshing)', defaultMachine: 'TRACTOR' },
    { value: 'TRANSPORTATION', labelEn: 'Transportation (ढुलाई)', labelHi: 'ढुलाई (Transport)', defaultMachine: 'TRACTOR' },
  ];

  const machineTypes = [
    { value: 'HARVESTER', label: lang === 'hi' ? 'कंबाइन हार्वेस्टर' : 'Combine Harvester' },
    { value: 'TRACTOR', label: lang === 'hi' ? 'ट्रैक्टर (45-60 HP)' : 'Tractor (45-60 HP)' },
    { value: 'SPRAYER', label: lang === 'hi' ? 'बूम / ड्रोन स्प्रेयर' : 'Boom / Drone Sprayer' },
    { value: 'ROTAVATOR', label: lang === 'hi' ? 'रोटावेटर' : 'Rotavator' },
    { value: 'SEED_DRILL', label: lang === 'hi' ? 'सीड कम फर्टिलाइजर ड्रिल' : 'Seed Drill' }
  ];

  const commonCrops = ['Wheat (गेहूं)', 'Paddy / Rice (धान)', 'Mustard (सरसों)', 'Cotton (कपास)', 'Sugarcane (गन्ना)', 'Potato (आलू)', 'Maize (मक्का)'];

  const handleChange = (e) => {
    setIsDirty(true);
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'operation') {
        const found = operations.find(o => o.value === value);
        if (found) updated.machine_type = found.defaultMachine;
      }
      return updated;
    });
  };

  const handleClose = () => {
    if (isDirty && !loading && !successMsg) {
      const confirmed = window.confirm(
        lang === 'hi' 
          ? 'आपके पास बिना सहेजे विवरण हैं। क्या आप वास्तव में फॉर्म बंद करना चाहते हैं?'
          : 'You have unsaved changes. Are you sure you want to close this form?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submissions

    setError(null);
    setSuccessMsg(null);

    // Form validation
    if (!formData.operation || !formData.farm_area || !formData.preferred_date) {
      setError(lang === 'hi' ? 'कृपया सभी आवश्यक फ़ील्ड भरें।' : 'Please fill all mandatory fields.');
      return;
    }

    const farmAreaNum = parseFloat(formData.farm_area);
    if (isNaN(farmAreaNum) || farmAreaNum <= 0) {
      setError(
        lang === 'hi' 
          ? 'कृपया एक मान्य धनात्मक क्षेत्रफल (Acre) दर्ज करें (जैसे 1.19, 2.5)।' 
          : 'Please enter a valid positive farm area in acres (e.g. 1.19, 2.5).'
      );
      return;
    }

    if (farmAreaNum > 1000) {
      setError(
        lang === 'hi' 
          ? 'खेत का क्षेत्रफल अधिकतम 1000 एकड़ हो सकता है।' 
          : 'Farm area cannot exceed 1000 acres.'
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        operation: formData.operation,
        machine_type: formData.machine_type,
        crop: formData.crop || 'Wheat',
        farm_area: farmAreaNum, // Preserves exact decimal area, e.g. 1.19
        field_location: formData.field_location,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time || '08:00',
        deadline: formData.deadline || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        requirements: formData.requirements || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        farmer_id: farmerProfile?.farmer_id || farmerProfile?.id || 'F0001'
      };

      let offers = [];
      let totalMatching = 0;
      const isConfig = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : Boolean(isSupabaseConfigured);
      if (isConfig) {
        try {
          const machines = await machineryService.getAvailableMachinery({
            category: formData.machine_type
          });
          if (machines && machines.length > 0) {
            offers = machines.slice(0, 10).map((m) => {
              const rate = m.rate != null ? m.rate : (m.hourly_rate_inr != null ? m.hourly_rate_inr : (m.rate_per_acre_inr != null ? m.rate_per_acre_inr : 0));
              const totalEst = rate > 0 ? (m.rate_unit === 'Acre' ? rate * farmAreaNum : rate * 4) : 0;
              return {
                offer_id: m.id,
                machine_id: m.id,
                chc_id: m.centre_id,
                machine_name: m.name,
                chc_name: m.centres?.name || 'Local CHC Hub',
                total_price: Math.round(totalEst),
                rate_per_acre: m.rate_unit === 'Acre' ? rate : (rate ? Math.round(rate * 1.25) : 0),
                rate_per_hour: m.rate_unit === 'Hour' ? rate : (rate ? Math.round(rate * 0.8) : 0),
                rating: m.rating || m.farmer_rating || null,
                reviews_count: m.reviews_count || 0,
                estimated_arrival_minutes: null,
                includes_operator: m.operator_included !== false,
                includes_fuel: m.fuel_included !== false,
                horsepower: m.horsepower || null,
                distance_km: null,
              };
            });
            totalMatching = machines.length;
          }
        } catch (dbErr) {
          console.warn('[MachineRequestModal] Direct Supabase machinery search warning:', dbErr);
        }
      }

      if (offers.length === 0) {
        try {
          const result = await nitiClient.searchOffers(payload);
          offers = result?.offers || [];
          totalMatching = result?.total_offers_found ?? result?.total_matching ?? offers.length;
        } catch (apiErr) {
          console.warn('[MachineRequestModal] nitiClient searchOffers warning:', apiErr);
        }
      }

      const totalAvailable = totalMatching > 0 ? totalMatching : offers.length;

      if (offers.length > 0) {
        setSuccessMsg(
          lang === 'hi' 
            ? `${offers.length} सत्यापित मशीन ऑफ़र सफलतापूर्वक प्राप्त हुए!` 
            : `Found ${offers.length} verified matching machine offers!`
        );
        setTimeout(() => {
          onOffersFound({
            offers,
            requestDetails: payload,
            totalAvailable
          });
          onClose();
        }, 500);
      } else {
        setError(
          lang === 'hi' 
            ? 'डेटाबेस में आपके अनुरोध से मेल खाती कोई मशीन नहीं मिली। कृपया फ़िल्टर बदलें।' 
            : 'No matching machines found in database for this specification. Please adjust requirements.'
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to search available machine offers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-niti-forest/10 my-auto max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Sticky Header */}
        <div className="shrink-0 p-5 md:p-6 border-b border-niti-forest/10 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-niti-forest/10 flex items-center justify-center text-niti-forest shrink-0">
              <Tractor className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-niti-forest leading-tight">
                {lang === 'hi' ? 'मशीन अनुरोध फॉर्म' : 'Request Farm Machinery'}
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                {lang === 'hi' 
                  ? 'सटीक विवरण भरें ताकि निकटतम सीएचसी से सबसे कम दर वाले ऑफ़र मिलें'
                  : 'Enter field details to receive verified CHC quotes and guaranteed availability'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Close Form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} id="farmer-request-form" className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Operation & Machine Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                {lang === 'hi' ? 'खेत का काम (Operation) *' : 'Farm Operation *'}
              </label>
              <select
                name="operation"
                value={formData.operation}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm font-medium bg-white"
              >
                {operations.map(op => (
                  <option key={op.value} value={op.value}>
                    {lang === 'hi' ? op.labelHi : op.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                {lang === 'hi' ? 'मशीन प्रकार (Machine Type) *' : 'Machine Type *'}
              </label>
              <select
                name="machine_type"
                value={formData.machine_type}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm font-medium bg-white"
              >
                {machineTypes.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Crop & Field Size (Accepts any positive decimal acres, e.g. 1.19) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                {lang === 'hi' ? 'फसल (Crop) *' : 'Crop Type *'}
              </label>
              <input
                type="text"
                name="crop"
                value={formData.crop}
                onChange={handleChange}
                list="crop-list"
                placeholder="e.g. Wheat, Paddy"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm"
              />
              <datalist id="crop-list">
                {commonCrops.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                {lang === 'hi' ? 'खेत का क्षेत्रफल (Farm Area in Acres) *' : 'Farm Area (Acres) *'}
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max="1000"
                name="farm_area"
                value={formData.farm_area}
                onChange={handleChange}
                placeholder="e.g. 1.19"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm font-medium"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                {lang === 'hi' ? 'दशमलव मान स्वीकार्य हैं (जैसे 1.19, 2.5 एकड़)' : 'Decimal values supported (e.g. 1.19, 2.5 acres)'}
              </span>
            </div>
          </div>

          {/* Location with Leaflet Map Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-niti-forest" />
                <span>{lang === 'hi' ? 'खेत का स्थान एवं पिन (Field Location & GPS Pin) *' : 'Field Location & GPS Pin *'}</span>
              </label>
              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="text-xs font-bold text-niti-forest hover:underline cursor-pointer"
              >
                {showMapPicker ? (lang === 'hi' ? 'मानचित्र छुपाएं' : 'Hide Map') : (lang === 'hi' ? 'मानचित्र पर चुनें' : 'Pick on Map')}
              </button>
            </div>
            <input
              type="text"
              name="field_location"
              value={formData.field_location}
              onChange={handleChange}
              placeholder="Village, Tehsil, District"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm mb-2"
            />
            {showMapPicker && (
              <div className="space-y-1.5 animate-fade-in">
                <NitiMap
                  mode="picker"
                  center={{ lat: formData.latitude, lng: formData.longitude }}
                  onLocationSelect={({ latitude, longitude, displayName }) => {
                    setIsDirty(true);
                    setFormData(prev => ({
                      ...prev,
                      latitude,
                      longitude,
                      field_location: displayName || prev.field_location
                    }));
                  }}
                  height="220px"
                />
                <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                  <span>GPS: {formData.latitude.toFixed(4)}° N, {formData.longitude.toFixed(4)}° E</span>
                  <span className="text-emerald-700 font-semibold">Click map or use 'My GPS' to set coordinates</span>
                </div>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                {lang === 'hi' ? 'तारीख (Preferred Date) *' : 'Preferred Date *'}
              </label>
              <input
                type="date"
                name="preferred_date"
                value={formData.preferred_date}
                min={new Date().toISOString().split('T')[0]}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                {lang === 'hi' ? 'समय (Start Time) *' : 'Start Time *'}
              </label>
              <input
                type="time"
                name="preferred_time"
                value={formData.preferred_time}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm font-medium"
              />
            </div>
          </div>

          {/* Optional Budget & Specific Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-gray-500" />
                {lang === 'hi' ? 'अधिकतम बजट (Optional Budget in ₹)' : 'Max Budget (Optional ₹)'}
              </label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="e.g. 5000"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                {lang === 'hi' ? 'विशेष आवश्यकताएं (Notes)' : 'Special Instructions'}
              </label>
              <input
                type="text"
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                placeholder={lang === 'hi' ? 'जैसे: गीली मिट्टी, संकरा रास्ता...' : 'e.g. wet soil, narrow farm road'}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-niti-forest focus:ring-2 focus:ring-niti-forest/20 outline-none text-sm"
              />
            </div>
          </div>

          {/* Fair Comparison Guarantee Badge */}
          <div className="p-3.5 rounded-2xl bg-niti-mint/60 border border-niti-forest/15 flex items-center gap-3 text-xs text-niti-forest">
            <Sparkles className="w-5 h-5 text-niti-leaf shrink-0" />
            <span>
              {lang === 'hi'
                ? 'NITI गारंटी: वास्तविक ऑपरेटर उपलब्धता, दूरी व पारदर्शी मूल्य पर आधारित सत्यापित ऑफ़र ही दिखाए जाएंगे।'
                : 'NITI Fair Match: Only verified CHC providers with conflict-free operator availability are queried.'}
            </span>
          </div>
        </form>

        {/* Fixed Sticky Footer with Actions */}
        <div className="shrink-0 p-4 md:px-6 md:py-4 bg-gray-50/90 border-t border-gray-100 flex items-center justify-end gap-3 z-10">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-gray-600 hover:bg-gray-200/70 transition-colors cursor-pointer"
          >
            {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
          </button>
          <button
            type="submit"
            form="farmer-request-form"
            disabled={loading}
            className="px-7 py-2.5 rounded-xl bg-niti-forest hover:bg-niti-moss text-white text-xs md:text-sm font-bold shadow-lg shadow-niti-forest/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{lang === 'hi' ? 'सीएचसी ऑफ़र खोज रहे हैं...' : 'Checking CHC Availability...'}</span>
              </>
            ) : (
              <>
                <span>{lang === 'hi' ? 'उपलब्ध ऑफ़र देखें' : 'Search Matching Offers'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
