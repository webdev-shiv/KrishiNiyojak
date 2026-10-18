import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  MapPin, 
  Tractor, 
  User, 
  ShieldCheck, 
  AlertCircle, 
  FileCheck, 
  ArrowRight,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { bookingsService } from '../api/supabaseService';
import { isSupabaseConfigured } from '../api/supabaseClient';

export const BookingConfirmationModal = ({ 
  isOpen, 
  onClose, 
  offer, 
  requestDetails = {}, 
  farmerProfile = {}, 
  onBookingSuccess, 
  lang = 'hi', 
  t 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  if (!isOpen || !offer) return null;

  const handleConfirmBooking = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        machine_id: offer.machine_id || offer.id || 'M0001',
        centre_id: offer.chc_id || offer.centre_id || 'CHC001',
        farmer_id: farmerProfile?.farmer_id || farmerProfile?.id || 'F0001',
        farmer_name: farmerProfile?.full_name || farmerProfile?.name || 'Farmer Ramesh Patel',
        operation: requestDetails.operation || 'HARVESTING',
        crop: requestDetails.crop || 'Wheat',
        farm_area: parseFloat(requestDetails.farm_area) || 1.19,
        field_location: requestDetails.field_location || farmerProfile?.village || 'Aligarh Rural, Uttar Pradesh',
        scheduled_date: requestDetails.preferred_date || new Date().toISOString().split('T')[0],
        scheduled_start_time: requestDetails.preferred_time || '08:00',
        total_price: offer.total_price || (offer.rate_per_acre ? offer.rate_per_acre * (parseFloat(requestDetails.farm_area) || 1) : 0),
        rate_per_acre: offer.rate_per_acre,
        operator_included: offer.includes_operator !== false,
        fuel_included: offer.includes_fuel !== false,
        special_instructions: `Farmer: ${farmerProfile?.full_name || 'Farmer'}, Req: ${requestDetails.requirements || ''}`
      };

      let result;
      const isConfig = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : Boolean(isSupabaseConfigured);
      if (isConfig) {
        result = await bookingsService.createBooking(payload);
      } else {
        result = await nitiClient.createBooking(payload);
      }

      setConfirmedBooking(result);
      if (onBookingSuccess) {
        onBookingSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to create booking in Supabase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-niti-forest/10 my-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-niti-forest/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-niti-forest/10 text-niti-forest flex items-center justify-center font-bold">
              {confirmedBooking ? <CheckCircle2 className="w-6 h-6 text-niti-forest" /> : <FileCheck className="w-6 h-6 text-niti-forest" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-niti-forest">
                {confirmedBooking 
                  ? (lang === 'hi' ? 'बुकिंग सफलतापूर्वक दर्ज!' : 'Booking Confirmed!')
                  : (lang === 'hi' ? 'बुकिंग विवरण व अंतिम पुष्टि' : 'Confirm Machine Booking')}
              </h2>
              <p className="text-xs text-gray-500">
                {confirmedBooking 
                  ? (lang === 'hi' ? 'आपका अनुरोध ऑपरेटर व सीएचसी को प्रेषित कर दिया गया है' : 'Sent to assigned operator & CHC dispatch')
                  : (lang === 'hi' ? 'कृपया सभी विवरण जांचकर पुष्टि करें' : 'Review final scheduling terms & total cost')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs md:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success View */}
        {confirmedBooking ? (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div className="p-6 rounded-3xl bg-niti-mint/50 border border-niti-forest/20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-niti-forest text-white mb-3 shadow-lg shadow-niti-forest/25">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="block text-xs font-bold text-niti-forest uppercase tracking-wider">
                {lang === 'hi' ? 'बुकिंग संदर्भ संख्या (Reference ID)' : 'Unique Booking Reference'}
              </span>
              <span className="text-2xl md:text-3xl font-extrabold text-niti-forest block mt-1 tracking-tight">
                {confirmedBooking.booking_reference || confirmedBooking.booking_id}
              </span>
              <p className="text-xs md:text-sm text-gray-600 mt-2 max-w-md mx-auto">
                {lang === 'hi'
                  ? 'मशीन एवं ऑपरेटर बुक हो चुके हैं। आप लाइव अपडेट्स सेक्शन में ऑपरेटर की लाइव स्थिति देख सकते हैं।'
                  : 'Your booking is confirmed with double-booking prevention. Track live operator journey on your dashboard.'}
              </p>
            </div>

            {/* Next Steps Progression */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-2">
              <span className="font-bold text-gray-800 block uppercase tracking-wider">
                {lang === 'hi' ? 'आगे क्या होगा?' : 'Next Milestones:'}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-niti-forest" />
                <span>{lang === 'hi' ? 'सीएचसी द्वारा ऑपरेटर को सूचना भेजी गई' : 'CHC dispatched notification to operator'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-niti-forest" />
                <span>{lang === 'hi' ? 'समय पर ऑपरेटर खेत के लिए रवाना होगा (Operator en route)' : 'Operator will depart for field on schedule'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-niti-forest" />
                <span>{lang === 'hi' ? 'काम पूरा होने के बाद ही भुगतान स्वीकृत होगा' : 'Secure payment settled upon verified job completion'}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-niti-forest hover:bg-niti-moss text-white text-sm font-bold shadow-lg shadow-niti-forest/20 transition-all flex items-center justify-center gap-2"
            >
              <span>{lang === 'hi' ? 'डैशबोर्ड पर जाएं व लाइव देखें' : 'Go to Dashboard & Track Live'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Confirmation Summary View */
          <div className="mt-6 space-y-5">
            {/* Machine & CHC Card */}
            <div className="p-4 rounded-2xl bg-niti-mint/30 border border-niti-forest/15 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white border border-niti-forest/20 flex items-center justify-center text-niti-forest shrink-0">
                <Tractor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{offer.machine_name}</h3>
                <p className="text-xs text-gray-500 font-medium">{offer.chc_name}</p>
                <div className="flex items-center gap-2 text-xs text-niti-forest font-semibold mt-0.5">
                  <span>★ {offer.rating || 4.5}</span>
                  <span>•</span>
                  <span>~{offer.estimated_arrival_minutes || 25} {lang === 'hi' ? 'मिनट आगमन' : 'mins ETA'}</span>
                </div>
              </div>
            </div>

            {/* Schedule & Location Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-gray-400 font-medium block flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {lang === 'hi' ? 'तारीख व समय' : 'Schedule'}
                </span>
                <span className="font-bold text-gray-800">
                  {requestDetails.preferred_date || 'Tomorrow'} at {requestDetails.preferred_time || '08:00'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-gray-400 font-medium block flex items-center gap-1 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {lang === 'hi' ? 'खेत का स्थान' : 'Field Location'}
                </span>
                <span className="font-bold text-gray-800 truncate block">
                  {requestDetails.field_location || 'Field Location'}
                </span>
              </div>
            </div>

            {/* Farm Area & Crop */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-gray-400 font-medium block mb-1">
                  {lang === 'hi' ? 'काम एवं फसल' : 'Operation & Crop'}
                </span>
                <span className="font-bold text-gray-800">
                  {requestDetails.operation || 'HARVESTING'} ({requestDetails.crop || 'Wheat'})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-gray-400 font-medium block mb-1">
                  {lang === 'hi' ? 'खेत का क्षेत्रफल' : 'Farm Acreage'}
                </span>
                <span className="font-bold text-gray-800">
                  {requestDetails.farm_area || 5} {lang === 'hi' ? 'एकड़' : 'Acres'}
                </span>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>{lang === 'hi' ? 'मशीन दर (प्रति एकड़)' : 'Machine Rate (per acre)'}</span>
                <span className="font-medium">₹{offer.rate_per_acre} × {requestDetails.farm_area || 5} acres</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{lang === 'hi' ? 'कुशल चालक (Operator)' : 'Certified Operator'}</span>
                <span className="text-niti-forest font-semibold">{lang === 'hi' ? 'शामिल (Free)' : 'Included'}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{lang === 'hi' ? 'ईंधन / डीजल' : 'Fuel / Diesel'}</span>
                <span className="text-niti-forest font-semibold">{lang === 'hi' ? 'शामिल (Free)' : 'Included'}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{lang === 'hi' ? 'ढुलाई / परिवहन' : 'Transport & Transit'}</span>
                <span className="text-gray-700 font-medium">
                  {offer.free_transportation ? (lang === 'hi' ? 'निःशुल्क' : 'Free') : `₹${offer.transportation_fee || 150}`}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline text-sm font-bold text-gray-900">
                <span>{lang === 'hi' ? 'कुल देय राशि' : 'Total Payable Amount'}</span>
                <span className="text-xl text-niti-forest font-extrabold">₹{offer.total_price}</span>
              </div>
            </div>

            {/* Terms Guarantee */}
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <ShieldCheck className="w-4 h-4 text-niti-forest shrink-0" />
              <span>
                {lang === 'hi' 
                  ? 'NITI गारंटी: वास्तविक ऑपरेटर कार्य समापन पर डिजिटल सत्यापन के बाद ही भुगतान पूरा होगा।' 
                  : 'NITI Guarantee: 100% collision-free scheduling. Verified before final settlement.'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl text-xs md:text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {lang === 'hi' ? 'वापस जाएं' : 'Back'}
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={loading}
                className="px-7 py-3 rounded-xl bg-niti-forest hover:bg-niti-moss text-white text-xs md:text-sm font-bold shadow-lg shadow-niti-forest/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{lang === 'hi' ? 'बुकिंग दर्ज हो रही है...' : 'Confirming Slot...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'hi' ? 'बुकिंग की पुष्टि करें (Confirm)' : 'Confirm Booking'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
