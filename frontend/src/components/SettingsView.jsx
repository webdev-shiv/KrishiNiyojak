import React, { useState } from 'react';
import { 
  User, 
  MapPin, 
  Tractor, 
  Globe, 
  Volume2, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';

export const SettingsView = ({ 
  farmerProfile, 
  onProfileUpdated, 
  onBack, 
  lang = 'hi', 
  t, 
  onToggleLang 
}) => {
  const [formData, setFormData] = useState({
    full_name: farmerProfile?.full_name || 'Ramesh Kumar',
    village: farmerProfile?.village || 'Karnal',
    district: farmerProfile?.district || 'Karnal',
    state: farmerProfile?.state || 'Haryana',
    farm_size_acres: farmerProfile?.farm_size_acres || 5,
    preferred_language: farmerProfile?.preferred_language || lang,
    crops_grown: farmerProfile?.crops_grown || ['Wheat', 'Paddy'],
    voice_speed: 'normal',
    sms_notifications: true,
    whatsapp_notifications: true
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const availableCrops = ['Wheat', 'Paddy', 'Mustard', 'Cotton', 'Sugarcane', 'Potato', 'Maize'];

  const toggleCrop = (crop) => {
    setFormData(prev => {
      const exists = prev.crops_grown.includes(crop);
      const updated = exists 
        ? prev.crops_grown.filter(c => c !== crop) 
        : [...prev.crops_grown, crop];
      return { ...prev, crops_grown: updated };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        full_name: formData.full_name,
        village: formData.village,
        district: formData.district,
        state: formData.state,
        farm_size_acres: parseFloat(formData.farm_size_acres) || 5,
        crops_grown: formData.crops_grown,
        preferred_language: formData.preferred_language
      };

      const result = await nitiClient.updateFarmerProfile(payload);
      setSuccessMsg(lang === 'hi' ? 'सेटिंग्स और खेत विवरण सफलतापूर्वक सहेज लिए गए हैं!' : 'Settings and farm details updated successfully!');
      if (onProfileUpdated) {
        onProfileUpdated(result);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-niti-forest hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{lang === 'hi' ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-niti-forest/15 shadow-sm space-y-6">
        <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              {lang === 'hi' ? 'खाता एवं खेत सेटिंग्स' : 'Account & Farm Settings'}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {lang === 'hi' ? 'नाम, भाषा, खेत आकार, फसलें व सूचना प्राथमिकताएं' : 'Manage your verified profile, farm coordinates, language, and voice options'}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-niti-mint text-niti-forest border border-niti-forest/20">
            {lang === 'hi' ? 'भूमिका: किसान' : 'Role: Farmer'}
          </span>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs md:text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs md:text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Personal Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-niti-forest" />
              <span>{lang === 'hi' ? 'व्यक्तिगत जानकारी' : 'Personal Details'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'पूरा नाम' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs md:text-sm focus:border-niti-forest outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'मोबाइल नंबर (सत्यापित)' : 'Mobile Number (Verified)'}
                </label>
                <input
                  type="text"
                  disabled
                  value="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-xs md:text-sm cursor-not-allowed"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {lang === 'hi' ? 'नंबर बदलने के लिए नया OTP सत्यापन अनिवार्य है।' : 'Number changes require mandatory re-verification.'}
                </span>
              </div>
            </div>
          </div>

          {/* Farm Details */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-niti-forest" />
              <span>{lang === 'hi' ? 'खेत का स्थान व विवरण' : 'Farm Location & Acreage'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'गाँव / क्षेत्र' : 'Village'}
                </label>
                <input
                  type="text"
                  value={formData.village}
                  onChange={(e) => setFormData(prev => ({ ...prev, village: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs md:text-sm focus:border-niti-forest outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'ज़िला' : 'District'}
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs md:text-sm focus:border-niti-forest outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'कुल खेत का आकार (एकड़)' : 'Farm Size (Acres)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.farm_size_acres}
                  onChange={(e) => setFormData(prev => ({ ...prev, farm_size_acres: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs md:text-sm focus:border-niti-forest outline-none"
                />
              </div>
            </div>

            {/* Crops */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                {lang === 'hi' ? 'उगाई जाने वाली मुख्य फसलें' : 'Crops Grown'}
              </label>
              <div className="flex flex-wrap gap-2">
                {availableCrops.map(crop => {
                  const isSelected = formData.crops_grown.includes(crop);
                  return (
                    <button
                      type="button"
                      key={crop}
                      onClick={() => toggleCrop(crop)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'bg-niti-forest text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {crop} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-niti-forest" />
              <span>{lang === 'hi' ? 'भाषा एवं आवाज़ प्राथमिकता' : 'Language & Voice Preferences'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'पसंदीदा भाषा' : 'Preferred Language'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, preferred_language: 'hi' }));
                      if (lang !== 'hi' && onToggleLang) onToggleLang();
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      formData.preferred_language === 'hi' 
                        ? 'bg-niti-forest text-white border-niti-forest' 
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    हिन्दी (Hindi)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, preferred_language: 'en' }));
                      if (lang !== 'en' && onToggleLang) onToggleLang();
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      formData.preferred_language === 'en' 
                        ? 'bg-niti-forest text-white border-niti-forest' 
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'hi' ? 'आवाज़ बोलने की गति' : 'Assistant Voice Speed'}
                </label>
                <select
                  value={formData.voice_speed}
                  onChange={(e) => setFormData(prev => ({ ...prev, voice_speed: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 text-xs md:text-sm focus:border-niti-forest outline-none"
                >
                  <option value="slow">{lang === 'hi' ? 'धीमी (स्पष्ट व समझने में आसान)' : 'Slow & Clear'}</option>
                  <option value="normal">{lang === 'hi' ? 'सामान्य गति (Normal)' : 'Normal Pace'}</option>
                  <option value="fast">{lang === 'hi' ? 'तीव्र गति (Fast)' : 'Fast'}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-2xl bg-niti-forest hover:bg-niti-moss text-white text-xs md:text-sm font-bold shadow-lg shadow-niti-forest/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{lang === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'सेटिंग्स सुरक्षित करें' : 'Save Settings'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
