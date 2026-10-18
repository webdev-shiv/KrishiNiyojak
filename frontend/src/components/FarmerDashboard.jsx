import React, { useState, useEffect } from 'react';
import { 
  Tractor, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Tag, 
  Bell, 
  ChevronRight, 
  Truck,
  Settings as CogIcon,
  User, 
  MapPin, 
  Sparkles, 
  RefreshCw,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  Send
} from 'lucide-react';
import { VoiceAssistantWidget } from './VoiceAssistantWidget';
import { MachineRequestModal } from './MachineRequestModal';
import { OfferComparisonView } from './OfferComparisonView';
import { BookingConfirmationModal } from './BookingConfirmationModal';
import { bookingsService, farmersService, machineryService } from '../api/supabaseService';
import { SupabaseStatusBanner } from './SupabaseStatusBanner';
import { supabase } from '../api/supabaseClient';

export const FarmerDashboard = ({ 
  farmerProfile, 
  currentUser,
  onUpdateProfile, 
  onOpenSettings, 
  activeView,
  onSelectView,
  lang = 'hi', 
  t 
}) => {
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, offers, completed, cancelled
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [activeOffersData, setActiveOffersData] = useState(null);
  const [selectedOfferForBooking, setSelectedOfferForBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [processingOfferId, setProcessingOfferId] = useState(null);
  const [complaintModalBooking, setComplaintModalBooking] = useState(null);
  const [complaintCategory, setComplaintCategory] = useState('Machinery Breakdown / Delay');
  const [complaintText, setComplaintText] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Sync activeView from sidebar
  useEffect(() => {
    if (activeView === 'request') {
      setIsRequestModalOpen(true);
    } else if (activeView === 'bookings') {
      setActiveTab('upcoming');
      const el = document.getElementById('farmer-bookings-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (activeView === 'updates') {
      const el = document.getElementById('live-updates-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (activeView === 'compare') {
      machineryService.getAvailableMachinery().then(machines => {
        if (machines && machines.length > 0) {
          const offers = machines.slice(0, 8).map(m => {
            const rate = m.rate || m.hourly_rate_inr || m.rate_per_acre_inr || 600;
            return {
              offer_id: m.id,
              machine_id: m.id,
              chc_id: m.centre_id,
              machine_name: m.name || m.machine_type || 'Farm Machine',
              chc_name: m.centres?.name || 'Local CHC Hub',
              total_price: Math.round(rate * 1.19),
              rate_per_acre: rate,
              rate_per_hour: Math.round(rate * 0.8),
              rating: m.rating || 4.8,
              includes_operator: m.operator_included !== false,
              includes_fuel: m.fuel_included !== false
            };
          });
          setActiveOffersData({
            offers,
            requestDetails: {
              operation: 'HARVESTING',
              crop: 'Wheat',
              farm_area: 1.19,
              field_location: farmerProfile?.village || 'Uttar Pradesh'
            },
            totalAvailable: machines.length
          });
        }
      }).catch(err => console.warn('[FarmerDashboard] Compare load warning:', err));
    }
  }, [activeView]);

  // Fetch strictly the authenticated farmer's bookings from Supabase
  const fetchBookings = async () => {
    setLoadingBookings(true);
    setError(null);
    try {
      const farmerId = farmerProfile?.farmer_id || farmerProfile?.id || currentUser?.farmer_id || currentUser?.id;
      const data = farmerId 
        ? await bookingsService.getFarmerBookings(farmerId)
        : [];

      setBookings(data || []);
    } catch (err) {
      console.error('[FarmerDashboard] Failed to load real bookings from Supabase:', err);
      setError(err);
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    if (!supabase) return;
    const channel = supabase.channel('farmer-broadcast-' + Math.random().toString(36).substring(7));

    channel.on('broadcast', { event: 'booking_status_updated' }, (event) => {
      console.log('[FarmerDashboard] Live booking status updated broadcast:', event);
      const { id, booking_id, status } = event.payload || {};
      const targetId = id || booking_id;
      if (targetId && status) {
        setBookings(prev => prev.map(b => (b.id === targetId || b.booking_id === targetId || b.booking_reference === targetId) ? { ...b, status } : b));
        fetchBookings();
      }
    });

    channel.on('broadcast', { event: 'booking_deleted' }, (event) => {
      console.log('[FarmerDashboard] Live booking deleted broadcast:', event);
      const targetId = event.payload?.id || event.payload?.booking_id;
      if (targetId) {
        setBookings(prev => prev.filter(b => b.id !== targetId && b.booking_id !== targetId && b.booking_reference !== targetId));
      }
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmerProfile, currentUser]);

  const handleDeleteBooking = async (booking) => {
    const bookingId = booking.booking_id || booking.id || booking.booking_reference;
    if (!bookingId) return;

    // Enforce ownership and authorization
    const currentFarmerId = farmerProfile?.farmer_id || farmerProfile?.id || currentUser?.farmer_id || currentUser?.id;
    if (booking.farmer_id && currentFarmerId && String(booking.farmer_id) !== String(currentFarmerId)) {
      alert(lang === 'hi' 
        ? 'अनधिकृत: आप केवल अपनी स्वयं की बुकिंग हटा सकते हैं।' 
        : 'Unauthorized: You can only delete your own bookings.');
      return;
    }

    // Preserve cancellation / audit policy for completed bookings
    if (booking.status === 'Completed' || booking.status === 'COMPLETED' || (booking.hours && booking.hours >= 2)) {
      alert(lang === 'hi'
        ? 'पूर्ण हो चुकी बुकिंग को हटाया नहीं जा सकता। यह वित्तीय और सरकारी ऑडिट रिकॉर्ड है।'
        : 'Completed bookings cannot be deleted as they are preserved for financial and agricultural audit history.');
      return;
    }

    const confirmMsg = lang === 'hi'
      ? `क्या आप वास्तव में बुकिंग "${booking.booking_reference || bookingId}" को रद्द और हटाना चाहते हैं?`
      : `Are you sure you want to cancel and delete booking "${booking.booking_reference || bookingId}"?`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(bookingId);
    try {
      // Optimistic local UI removal
      setBookings(prev => prev.filter(b => b.id !== bookingId && b.booking_id !== bookingId && b.booking_reference !== bookingId));

      await bookingsService.deleteBooking(bookingId, booking);
      await fetchBookings();
    } catch (err) {
      console.error('[FarmerDashboard] Delete error:', err);
      alert(lang === 'hi' ? 'बुकिंग हटाने में त्रुटि: ' + (err.message || '') : 'Failed to delete booking: ' + (err.message || ''));
      fetchBookings();
    } finally {
      setDeletingId(null);
    }
  };

  const handleAcceptOffer = async (booking) => {
    const bookingId = booking.booking_id || booking.id || booking.booking_reference;
    if (!bookingId) return;

    // Enforce authorization
    const currentFarmerId = farmerProfile?.farmer_id || farmerProfile?.id || currentUser?.farmer_id || currentUser?.id;
    if (booking.farmer_id && currentFarmerId && String(booking.farmer_id) !== String(currentFarmerId)) {
      alert(lang === 'hi' ? 'अनधिकृत कार्रवाई।' : 'Unauthorized action.');
      return;
    }

    setProcessingOfferId(bookingId);
    try {
      await bookingsService.acceptOfferByFarmer(bookingId);
      setBookings(prev => prev.map(b => (b.id === bookingId || b.booking_id === bookingId || b.booking_reference === bookingId)
        ? { ...b, status: 'Approved' } : b
      ));
      alert(lang === 'hi'
        ? '🎉 बधाई! आपने सीएचसी प्रस्ताव स्वीकार कर लिया है। बुकिंग अब अनुमोदित और निर्धारित है।'
        : '🎉 Offer accepted! Booking is now Approved & Scheduled for machinery dispatch.');
      await fetchBookings();
    } catch (err) {
      console.error('[FarmerDashboard] Accept offer error:', err);
      alert(lang === 'hi' ? 'प्रस्ताव स्वीकार करने में त्रुटि: ' + (err.message || '') : 'Failed to accept offer: ' + (err.message || ''));
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleRejectOffer = async (booking) => {
    const bookingId = booking.booking_id || booking.id || booking.booking_reference;
    if (!bookingId) return;

    const currentFarmerId = farmerProfile?.farmer_id || farmerProfile?.id || currentUser?.farmer_id || currentUser?.id;
    if (booking.farmer_id && currentFarmerId && String(booking.farmer_id) !== String(currentFarmerId)) {
      alert(lang === 'hi' ? 'अनधिकृत कार्रवाई।' : 'Unauthorized action.');
      return;
    }

    const reason = window.prompt(
      lang === 'hi' ? 'कृपया अस्वीकार करने का कारण दर्ज करें (वैकल्पिक):' : 'Enter reason for rejecting this offer (optional):',
      'Rate or timing not suitable'
    );
    if (reason === null) return;

    setProcessingOfferId(bookingId);
    try {
      await bookingsService.rejectOfferByFarmer(bookingId, reason);
      setBookings(prev => prev.map(b => (b.id === bookingId || b.booking_id === bookingId || b.booking_reference === bookingId)
        ? { ...b, status: 'Rejected' } : b
      ));
      alert(lang === 'hi' ? 'प्रस्ताव अस्वीकार कर दिया गया।' : 'Offer rejected.');
      await fetchBookings();
    } catch (err) {
      console.error('[FarmerDashboard] Reject offer error:', err);
      alert(lang === 'hi' ? 'अस्वीकार करने में त्रुटि: ' + (err.message || '') : 'Failed to reject offer: ' + (err.message || ''));
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleOpenComplaintModal = (booking) => {
    setComplaintModalBooking(booking);
    setComplaintCategory(booking.complaint_category || 'Machinery Breakdown / Delay');
    setComplaintText(booking.complaint_text || '');
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintModalBooking) return;
    const bookingId = complaintModalBooking.booking_id || complaintModalBooking.id || complaintModalBooking.booking_reference;
    if (!bookingId) return;

    setSubmittingComplaint(true);
    try {
      await bookingsService.submitFarmerComplaint(bookingId, {
        category: complaintCategory,
        text: complaintText || 'Issue raised by farmer',
      });
      alert(lang === 'hi'
        ? 'शिकायत सफलतापूर्वक दर्ज की गई! यह सीएचसी समीक्षा के लिए सुरक्षित है और बुकिंग स्थिति से स्वतंत्र रखी गई है।'
        : 'Complaint submitted successfully! It is recorded for CHC review and kept independent of booking status.');
      setComplaintModalBooking(null);
      await fetchBookings();
    } catch (err) {
      console.error('[FarmerDashboard] Complaint submit error:', err);
      alert(lang === 'hi' ? 'शिकायत दर्ज करने में विफल: ' + (err.message || '') : 'Failed to submit complaint: ' + (err.message || ''));
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleOffersFound = (data) => {
    setActiveOffersData(data);
  };

  const handleSelectOffer = (offer) => {
    setSelectedOfferForBooking(offer);
  };

  // Dynamically calculated real metrics
  const totalBookingsCount = bookings.length;
  const offersToConfirm = bookings.filter(b => b.status === 'Waiting for Farmer Confirmation');
  const upcomingBookings = bookings.filter(b => 
    b.status === 'Scheduled' || b.status === 'Pending' || b.status === 'Approved' || b.status === 'In Progress' || b.status === 'Waiting for Farmer Confirmation'
  );
  const completedBookings = bookings.filter(b => 
    b.status === 'Completed' || b.status === 'COMPLETED'
  );
  const cancelledBookings = bookings.filter(b => 
    b.status === 'Cancelled' || b.status === 'Rejected'
  );

  const displayedBookings = activeTab === 'offers'
    ? offersToConfirm
    : activeTab === 'upcoming' 
      ? upcomingBookings 
      : activeTab === 'completed' 
        ? completedBookings 
        : cancelledBookings;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fade-in pb-20">
      {/* 1. Profile Welcome Banner */}
      <div 
        style={{ background: 'linear-gradient(135deg, #0e3822 0%, #134e2e 50%, #1e5c38 100%)' }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0e3822] via-[#134e2e] to-[#1e5c38] text-white p-6 md:p-8 shadow-lg"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-2xl text-amber-300 shadow-inner">
              {farmerProfile?.full_name ? farmerProfile.full_name[0] : 'K'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  {farmerProfile?.full_name || 'Kisan Bandhu'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  {lang === 'hi' ? 'सत्यापित किसान' : 'Verified Farmer'}
                </span>
              </div>
              <p className="text-xs md:text-sm text-emerald-100/90 mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-300" />
                  {farmerProfile?.village ? `${farmerProfile.village}, ` : ''}{farmerProfile?.district || 'Uttar Pradesh'}
                </span>
                <span>•</span>
                <span>{farmerProfile?.farm_size || 5} {farmerProfile?.farm_size_unit || 'Acres'}</span>
                <span>•</span>
                <span className="text-amber-200 font-semibold">{farmerProfile?.primary_crops || 'Wheat, Paddy'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-xs md:text-sm shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'hi' ? 'नया मशीन अनुरोध' : 'Request Machine'}</span>
            </button>
            <button
              onClick={fetchBookings}
              disabled={loadingBookings}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors cursor-pointer"
              title="Refresh Bookings"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBookings ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Error Notice */}
      <SupabaseStatusBanner error={error} onRetry={fetchBookings} title="Farmer Bookings Database Notice" />

      {/* 2. Real Metric Cards (Derived from real Supabase records) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Bookings */}
        <div className="bg-[#eef5ee] rounded-2xl p-4 md:p-5 border border-[#cde2ce] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs md:text-sm font-semibold text-gray-700 block">Total Bookings</span>
            <span className="text-2xl md:text-3xl font-black text-gray-900 block">{totalBookingsCount}</span>
            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 pt-1">
              <span>Single source of truth</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#cde2ce] flex items-center justify-center text-emerald-900 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Upcoming Jobs */}
        <div className="bg-[#fff9e6] rounded-2xl p-4 md:p-5 border border-[#fde89c] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs md:text-sm font-semibold text-gray-700 block">Upcoming Jobs</span>
            <span className="text-2xl md:text-3xl font-black text-gray-900 block">{upcomingBookings.length}</span>
            <button 
              onClick={() => setActiveTab('upcoming')}
              className="text-[11px] font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 pt-1 cursor-pointer"
            >
              <span>View details</span>
              <span className="text-xs">→</span>
            </button>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fde89c] flex items-center justify-center text-amber-900 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Completed Jobs */}
        <div className="bg-[#e6f7ef] rounded-2xl p-4 md:p-5 border border-[#c7f0db] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs md:text-sm font-semibold text-gray-700 block">Completed Jobs</span>
            <span className="text-2xl md:text-3xl font-black text-gray-900 block">{completedBookings.length}</span>
            <button 
              onClick={() => setActiveTab('completed')}
              className="text-[11px] font-bold text-teal-900 hover:text-teal-950 flex items-center gap-1 pt-1 cursor-pointer"
            >
              <span>View history</span>
              <span className="text-xs">→</span>
            </button>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#c7f0db] flex items-center justify-center text-teal-800 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Cancelled */}
        <div className="bg-[#fdedec] rounded-2xl p-4 md:p-5 border border-[#fbd4d2] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs md:text-sm font-semibold text-gray-700 block">Cancelled</span>
            <span className="text-2xl md:text-3xl font-black text-gray-900 block">{cancelledBookings.length}</span>
            <button 
              onClick={() => setActiveTab('cancelled')}
              className="text-[11px] font-bold text-rose-800 hover:text-rose-950 flex items-center gap-1 pt-1 cursor-pointer"
            >
              <span>View list</span>
              <span className="text-xs">→</span>
            </button>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fbd4d2] flex items-center justify-center text-rose-800 shrink-0">
            <Tag className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Central Voice Assistant Widget */}
      <VoiceAssistantWidget
        farmerProfile={farmerProfile}
        onOffersFound={handleOffersFound}
        lang={lang}
        onOpenManualForm={() => setIsRequestModalOpen(true)}
      />

      {/* 4. Main 2-Column Section: My Bookings (Left) & Real Activity Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: My Bookings (7 cols) */}
        <div id="farmer-bookings-section" className="lg:col-span-7 bg-white rounded-3xl p-5 md:p-6 border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-gray-800" />
              <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
                {lang === 'hi' ? 'मेरी बुकिंग्स (My Bookings)' : 'My Bookings'}
              </h2>
            </div>
            <span className="text-xs text-gray-400 font-mono">Live PostgreSQL Records</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 pb-2 flex-wrap">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-niti-forest text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Upcoming ({upcomingBookings.length})
            </button>
            {offersToConfirm.length > 0 && (
              <button
                onClick={() => setActiveTab('offers')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 animate-pulse ${
                  activeTab === 'offers'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                <span>Offers to Confirm</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-black">
                  {offersToConfirm.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-niti-forest text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Completed ({completedBookings.length})
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'cancelled'
                  ? 'bg-niti-forest text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Cancelled / Rejected ({cancelledBookings.length})
            </button>
          </div>

          {/* Real Dynamic Bookings List */}
          {loadingBookings ? (
            <div className="py-12 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-niti-forest" />
              <p className="text-xs">Loading database records...</p>
            </div>
          ) : displayedBookings.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-gray-50 border border-dashed border-gray-200 space-y-3">
              <Tractor className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="text-sm font-bold text-gray-700">
                {lang === 'hi' ? 'इस श्रेणी में कोई बुकिंग नहीं है' : 'No Bookings in this Category'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {lang === 'hi'
                  ? 'आप ऊपर दिए गए माइक से बोलकर या "नया मशीन अनुरोध" बटन दबाकर तुरंत बुकिंग कर सकते हैं।'
                  : 'Use voice assistant or click "Request Machine" above to create real database bookings.'}
              </p>
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-niti-forest text-white font-bold text-xs"
              >
                {lang === 'hi' ? 'अभी मशीन अनुरोध करें' : 'Create First Booking'}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedBookings.map((b) => {
                const machineName = b.machinery?.name || b.offer_machine_model || b.operation || 'Farm Machine';
                const centreName = b.centres?.name || 'Local CHC Hub';
                const isOfferPending = b.status === 'Waiting for Farmer Confirmation';
                const bookingKey = b.booking_id || b.id || b.booking_reference;

                return (
                  <div 
                    key={b.id || bookingKey}
                    className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                      isOfferPending 
                        ? 'border-amber-400 bg-amber-50/40 shadow-xs ring-1 ring-amber-300' 
                        : 'border-gray-200 hover:border-niti-forest/40 bg-white shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0 p-1">
                          <img 
                            src="/assets/tractor-rotavator.jpg" 
                            alt={machineName} 
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                              {machineName}
                            </h3>
                            {isOfferPending && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                                CHC OFFER RECEIVED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 font-medium">
                            {b.operation} • {b.farm_area || 5} acres • {b.crop || 'Crop'}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {b.scheduled_date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              {b.scheduled_time || '08:00 – 12:00'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 pt-0.5">
                            <span className="flex items-center gap-1 font-medium text-gray-700">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              {centreName}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              {b.field_location}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            b.status === 'Completed' || b.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'Approved'
                                ? 'bg-emerald-600 text-white'
                                : b.status === 'Waiting for Farmer Confirmation'
                                  ? 'bg-amber-500 text-white'
                                  : b.status === 'Scheduled'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                          }`}>
                            {b.status}
                          </span>
                          
                          {/* Delete Action (guarded for completed audit history) */}
                          <button
                            type="button"
                            onClick={() => handleDeleteBooking(b)}
                            disabled={deletingId === bookingKey || b.status === 'Completed' || b.status === 'COMPLETED'}
                            className={`px-2.5 py-1 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs ${
                              b.status === 'Completed' || b.status === 'COMPLETED'
                                ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
                                : 'border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                            title={
                              b.status === 'Completed' || b.status === 'COMPLETED'
                                ? 'Completed bookings cannot be deleted (audit history preserved)'
                                : (lang === 'hi' ? 'बुकिंग हटाएं' : 'Delete Booking')
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>{deletingId === bookingKey ? '...' : (lang === 'hi' ? 'हटाएं' : 'Delete')}</span>
                          </button>
                        </div>
                        <span className="font-extrabold text-sm text-gray-900">
                          ₹{b.total_price || b.amount_inr || 0}
                        </span>
                      </div>
                    </div>

                    {/* Distinct Offer Confirmation Panel for Farmer (CHC Approval -> Farmer Confirmation) */}
                    {isOfferPending && (
                      <div className="mt-2 pt-3 border-t border-amber-200/80 bg-white/70 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>CHC Offer: ₹{b.offer_price_per_acre || 600}/acre • Machine: {b.offer_machine_model || 'Tractor'}</span>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            Est. Duration: {b.offer_duration_hours || 2} hrs • Total: ₹{((Number(b.offer_price_per_acre || 600)) * (Number(b.farm_area) || 1)).toLocaleString('en-IN')}. Please accept or reject this offer to finalize dispatch.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRejectOffer(b)}
                            disabled={processingOfferId === bookingKey}
                            className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{lang === 'hi' ? 'अस्वीकार करें' : 'Reject'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcceptOffer(b)}
                            disabled={processingOfferId === bookingKey}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{processingOfferId === bookingKey ? '...' : (lang === 'hi' ? 'प्रस्ताव स्वीकारें' : 'Accept Offer')}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Complaint Display & Action (Keeps complaint status separate from booking status) */}
                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {b.complaint_status ? (
                        <div className="flex items-center gap-1.5 text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Complaint {b.complaint_status}: {b.complaint_category}</span>
                          {b.complaint_text && (
                            <span className="text-[11px] text-gray-500 max-w-xs truncate">
                              "{b.complaint_text}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">Ref ID: {bookingKey}</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenComplaintModal(b)}
                        className="text-[11px] font-bold text-gray-600 hover:text-amber-800 hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3 text-amber-600" />
                        <span>{b.complaint_status ? (lang === 'hi' ? 'शिकायत अपडेट करें' : 'Update Complaint') : (lang === 'hi' ? 'शिकायत दर्ज करें' : 'Raise Complaint')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Real Activity Timeline (5 cols) */}
        <div id="live-updates-section" className="lg:col-span-5 bg-white rounded-3xl p-5 md:p-6 border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-gray-800" />
              <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
                {lang === 'hi' ? 'लाइव अपडेट (Live Updates)' : 'Live Updates'}
              </h2>
            </div>
            <span className="text-xs text-gray-400 font-mono">Real Activity</span>
          </div>

          {bookings.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              {lang === 'hi' ? 'कोई नया स्टेटस इवेंट दर्ज नहीं है।' : 'No activity logged yet.'}
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
              {bookings.slice(0, 4).map((b, idx) => (
                <div key={b.id || idx} className="relative flex items-start justify-between gap-3">
                  <div className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white shadow-xs ${
                    b.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-gray-900">
                      {b.status}: {b.operation}
                    </h4>
                    <p className="text-[11px] md:text-xs text-gray-500 mt-0.5">
                      Ref: {b.booking_reference || b.id} • Scheduled for {b.scheduled_date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Offer Comparison View */}
      {(activeOffersData || activeView === 'compare') && (
        <div className="pt-2 animate-fade-in">
          <OfferComparisonView
            offers={activeOffersData?.offers || []}
            requestDetails={activeOffersData?.requestDetails || { farm_area: 1.19, crop: 'Wheat', operation: 'HARVESTING' }}
            offersData={activeOffersData}
            totalAvailable={activeOffersData?.totalAvailable}
            onSelectOffer={handleSelectOffer}
            onClose={() => {
              setActiveOffersData(null);
              if (onSelectView) onSelectView('dashboard');
            }}
            onBack={() => {
              setActiveOffersData(null);
              if (onSelectView) onSelectView('dashboard');
            }}
            lang={lang}
            t={t}
          />
        </div>
      )}

      {/* Machine Request Modal */}
      <MachineRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          if (activeView === 'request' && onSelectView) {
            onSelectView('dashboard');
          }
        }}
        onOffersFound={handleOffersFound}
        farmerProfile={farmerProfile}
        lang={lang}
        t={t}
      />

      {/* Booking Confirmation Modal */}
      <BookingConfirmationModal
        isOpen={Boolean(selectedOfferForBooking)}
        onClose={() => setSelectedOfferForBooking(null)}
        offer={selectedOfferForBooking}
        requestDetails={activeOffersData?.requestDetails}
        farmerProfile={farmerProfile}
        onBookingSuccess={() => {
          fetchBookings();
          setSelectedOfferForBooking(null);
          setActiveOffersData(null);
          if (onSelectView) onSelectView('bookings');
        }}
        lang={lang}
        t={t}
      />

      {/* Separate Farmer Complaint Modal */}
      {complaintModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    {lang === 'hi' ? 'बुकिंग शिकायत दर्ज करें' : 'Raise Farmer Grievance / Complaint'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Booking Ref: <span className="font-mono font-bold text-gray-800">{complaintModalBooking.booking_reference || complaintModalBooking.booking_id || complaintModalBooking.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComplaintModalBooking(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {lang === 'hi' ? 'शिकायत श्रेणी (Category)' : 'Complaint Category'}
                </label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Machinery Breakdown / Delay">Machinery Breakdown / Delay</option>
                  <option value="Operator Behavior / Absent">Operator Behavior / Absent</option>
                  <option value="Work Quality Issue">Work Quality Issue</option>
                  <option value="Overcharging / Pricing Discrepancy">Overcharging / Pricing Discrepancy</option>
                  <option value="Other Operational Issue">Other Operational Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {lang === 'hi' ? 'समस्या का विवरण (Description)' : 'Complaint Description'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  placeholder={lang === 'hi' ? 'कृपया विस्तार से बताएं कि क्या समस्या हुई...' : 'Provide details of the issue experienced...'}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                ℹ️ <strong>System Note:</strong> Grievance status is preserved independently of booking schedule. Raising a complaint will notify the CHC Manager while retaining your booking record.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setComplaintModalBooking(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingComplaint}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingComplaint ? 'Submitting...' : (lang === 'hi' ? 'शिकायत भेजें' : 'Submit Complaint')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerDashboard;
