import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  FileText, 
  Tractor, 
  RotateCcw, 
  User, 
  LogOut, 
  Bell, 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  PhoneCall, 
  Check, 
  CheckCircle2, 
  Clock, 
  Navigation, 
  Plus, 
  Minus, 
  Crosshair, 
  AlertTriangle, 
  Pause, 
  Play, 
  CheckCheck, 
  Wrench, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Car,
  Fuel,
  Star,
  RefreshCw,
  Search,
  Filter,
  CheckCircle
} from 'lucide-react';
import { operatorsService, bookingsService, centresService, operatorDispatchService } from '../api/supabaseService';
import { supabase } from '../api/supabaseClient';
import { SupabaseStatusBanner } from './SupabaseStatusBanner';
import { NitiMap } from './NitiMap';
import { UP_DISTRICT_COORDINATES } from '../services/routingService';

export const OperatorDashboard = ({ onLogout, lang = 'hi', t }) => {
  // Navigation active tab: 'today' | 'my-jobs' | 'machine' | 'history' | 'profile'
  const [activeTab, setActiveTab] = useState('today');

  // Database records
  const [profile, setProfile] = useState(null);
  const [centre, setCentre] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active/selected job in the Right Panel
  const [selectedJobId, setSelectedJobId] = useState(null);

  // Status updating & modals
  const [updatingJobId, setUpdatingJobId] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [issueCategory, setIssueCategory] = useState('Mechanical Breakdown');
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [openJobOffers, setOpenJobOffers] = useState([]);

  // Map zoom level
  const [mapZoom, setMapZoom] = useState(1);

  // Load real data from Supabase
  const loadOperatorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const allOps = await operatorsService.getAllOperators();
      const currentOp = allOps && allOps.length > 0 ? allOps[0] : null;

      if (currentOp) {
        setProfile(currentOp);

        if (currentOp.centre_id) {
          try {
            const centreData = await centresService.getCentreById(currentOp.centre_id);
            setCentre(centreData);
          } catch (cErr) {
            console.warn('[OperatorDashboard] Centre lookup warning:', cErr);
          }
        }

        const assignedBookings = await bookingsService.getOperatorJobs(currentOp.id);
        const bookingList = assignedBookings || [];
        setJobs(bookingList);

        if (bookingList.length > 0 && !selectedJobId) {
          // Select in-progress job first, or the first upcoming job
          const inProgress = bookingList.find(b => b.status === 'In Progress' || b.status === 'Started');
          setSelectedJobId(inProgress ? inProgress.id : bookingList[0].id);
        }
      } else {
        const fallbackBookings = await bookingsService.getAllBookings(20);
        setJobs(fallbackBookings || []);
        if (fallbackBookings && fallbackBookings.length > 0 && !selectedJobId) {
          setSelectedJobId(fallbackBookings[0].id);
        }
      }
    } catch (err) {
      console.error('[OperatorDashboard] Load error from Supabase:', err);
      setError(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperatorData();
    setOpenJobOffers(operatorDispatchService.getOpenJobOffers());

    if (!supabase) return;
    const chName = 'operator-sync-' + Math.random().toString(36).substring(7);
    const channel = supabase.channel(chName);
    
    channel.on('broadcast', { event: 'operator_job_broadcasted' }, (payload) => {
      if (payload && payload.payload) {
        setOpenJobOffers(prev => [payload.payload, ...prev.filter(o => o.offer_id !== payload.payload.offer_id)]);
      } else {
        setOpenJobOffers(operatorDispatchService.getOpenJobOffers());
      }
    });

    channel.on('broadcast', { event: 'operator_job_accepted' }, (payload) => {
      setOpenJobOffers(prev => prev.filter(o => o.offer_id !== payload?.payload?.offer_id));
      loadOperatorData();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle accepting an incoming open job offer (Audio 3)
  const handleAcceptJobOffer = async (offer) => {
    try {
      const res = await operatorDispatchService.acceptJobOffer(
        offer.offer_id,
        profile?.id || 'OP001',
        profile?.name || 'Ramesh Kumar'
      );
      if (res.success) {
        setOpenJobOffers(prev => prev.filter(o => o.offer_id !== offer.offer_id));
        setFeedbackToast({
          type: 'success',
          message: lang === 'hi' 
            ? `कार्य सफलतापूर्वक स्वीकार किया गया! किसान: ${offer.farmer_name}, भुगतान: ₹${offer.payout_inr}`
            : `Job accepted! Farmer: ${offer.farmer_name}, Payout: ₹${offer.payout_inr}. Added to your schedule.`
        });
        setTimeout(() => setFeedbackToast(null), 4000);
        await loadOperatorData();
      }
    } catch (e) {
      console.error('[OperatorDashboard] Accept job error:', e);
    }
  };

  // Update status directly to Supabase bookings table
  const handleStatusChange = async (jobId, newStatus) => {
    setUpdatingJobId(jobId);
    setShowStatusDropdown(false);
    try {
      await bookingsService.updateBookingStatus(jobId, newStatus, `Operator set status to ${newStatus}`);
      
      // Update local state immediately for responsive UI
      setJobs(prevJobs => prevJobs.map(j => {
        if (j.id === jobId || j.booking_id === jobId) {
          return { ...j, status: newStatus };
        }
        return j;
      }));

      setFeedbackToast({
        type: 'success',
        message: lang === 'hi' 
          ? `कार्य स्थिति बदलकर '${newStatus}' कर दी गई है!` 
          : `Job status updated to '${newStatus}' in Supabase!`
      });
      setTimeout(() => setFeedbackToast(null), 4000);

      // Refresh in background to sync any dependent calculations
      loadOperatorData();
    } catch (err) {
      alert(err.message || 'Failed to update job status');
    } finally {
      setUpdatingJobId(null);
    }
  };

  // Submit issue report to CHC
  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueText) return;
    try {
      if (activeJob) {
        await bookingsService.updateBookingStatus(
          activeJob.id, 
          'Under Review', 
          `Issue reported (${issueCategory}): ${issueText}`
        );
      }
      setShowIssueModal(false);
      setIssueText('');
      setFeedbackToast({
        type: 'warning',
        message: lang === 'hi' 
          ? 'समस्या सीएचसी केंद्र प्रबंधक को भेज दी गई है।' 
          : 'Issue reported to CHC Dispatch Manager.'
      });
      setTimeout(() => setFeedbackToast(null), 4000);
      loadOperatorData();
    } catch (err) {
      alert(`Failed to report issue: ${err.message}`);
    }
  };

  // Toggle on-duty status
  const toggleDuty = async () => {
    if (!profile) return;
    try {
      const nextAvailability = !profile.is_available;
      await operatorsService.updateAvailability(profile.id, nextAvailability);
      setProfile(prev => ({ ...prev, is_available: nextAvailability }));
      setFeedbackToast({
        type: 'info',
        message: nextAvailability 
          ? (lang === 'hi' ? 'आप ड्यूटी पर उपलब्ध हैं।' : 'You are now marked On-Duty.')
          : (lang === 'hi' ? 'आप ड्यूटी से बाहर हैं।' : 'You are now marked Off-Duty.')
      });
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  // Build standard schedule data from Supabase jobs
  const scheduleItems = jobs.map((j, idx) => {
    const farmerName = j.farmers?.name || j.farmers?.full_name || j.special_instructions?.replace(/Farmer:\s*([^,]+).*/, '$1') || 'Mohan Singh';
    const farmerPhone = j.farmers?.phone_number || j.special_instructions?.replace(/.*Mobile:\s*([^,]+).*/, '$1') || '+91 98765 43210';
    const village = j.field_location || (j.farmers?.village ? `${j.farmers.village}, Block 1` : (centre?.village ? `${centre.village}, Block 1` : 'Sundarpur, Block 1'));
    const machineName = j.machinery?.machine_type || j.machinery?.name || 'Combine Harvester';
    const acreage = j.farm_area || j.area_worked_acre || 5.0;

    // Standard schedule times matching the 3 jobs in reference image
    const times = [
      { start: '08:00 AM', end: '12:00 PM' },
      { start: '01:00 PM', end: '03:00 PM' },
      { start: '04:00 PM', end: '06:00 PM' }
    ];
    const timeSlot = times[idx % times.length];

    // Assign appropriate image matching the machine operation
    let img = '/assets/harvester.jpg';
    if (idx === 1 || machineName.toLowerCase().includes('tractor') || machineName.toLowerCase().includes('rotavator')) {
      img = '/assets/tractor-rotavator.jpg';
    } else if (idx === 2 || machineName.toLowerCase().includes('spray')) {
      img = '/assets/card-s.jpg';
    }

    return {
      id: j.id || j.booking_id,
      index: idx + 1,
      time: `${timeSlot.start}`,
      timeEnd: `– ${timeSlot.end}`,
      timeFull: `${timeSlot.start} – ${timeSlot.end}`,
      operation: j.operation || (idx === 0 ? 'Wheat Harvesting' : idx === 1 ? 'Field Preparation' : 'Spraying'),
      status: j.status || (idx === 0 ? 'In Progress' : 'Upcoming'),
      farmer: farmerName,
      farmerPhone: farmerPhone,
      village: village.includes('Village:') ? village : `Village: ${village}`,
      rawVillage: village,
      fieldSize: `Field Size: ${acreage} acres`,
      rawAcres: acreage,
      machine: machineName,
      image: img,
      rawJob: j
    };
  });

  // Provide realistic fallback schedule if operator has fewer than 3 assignments
  const displaySchedule = [...scheduleItems];
  if (displaySchedule.length === 0) {
    displaySchedule.push(
      {
        id: 'job-default-1',
        index: 1,
        time: '08:00 AM',
        timeEnd: '– 12:00 PM',
        timeFull: '08:00 AM – 12:00 PM',
        operation: 'Wheat Harvesting',
        status: 'In Progress',
        farmer: 'Mohan Singh',
        farmerPhone: '+91 98765 12098',
        village: 'Village: Sundarpur, Block 1',
        rawVillage: 'Sundarpur, Block 1',
        fieldSize: 'Field Size: 5 acres',
        rawAcres: 5.0,
        machine: 'Dasmesh Combine Harvester 9100',
        image: '/assets/harvester.jpg',
      },
      {
        id: 'job-default-2',
        index: 2,
        time: '01:00 PM',
        timeEnd: '– 03:00 PM',
        timeFull: '01:00 PM – 03:00 PM',
        operation: 'Field Preparation',
        status: 'Upcoming',
        farmer: 'Sita Devi',
        farmerPhone: '+91 98450 88219',
        village: 'Village: Kherli, Block 1',
        rawVillage: 'Kherli, Block 1',
        fieldSize: 'Field Size: 3 acres',
        rawAcres: 3.0,
        machine: 'Mahindra 575 DI (45 HP) + Rotavator',
        image: '/assets/tractor-rotavator.jpg',
      },
      {
        id: 'job-default-3',
        index: 3,
        time: '04:00 PM',
        timeEnd: '– 06:00 PM',
        timeFull: '04:00 PM – 06:00 PM',
        operation: 'Spraying',
        status: 'Upcoming',
        farmer: 'Geeta Bai',
        farmerPhone: '+91 97110 33412',
        village: 'Village: Rampur, Block 2',
        rawVillage: 'Rampur, Block 2',
        fieldSize: 'Field Size: 4 acres',
        rawAcres: 4.0,
        machine: 'Mitra Airotec 600L Boom Sprayer',
        image: '/assets/card-s.jpg',
      }
    );
  }

  // Active focused job
  const activeJob = displaySchedule.find(s => s.id === selectedJobId) || displaySchedule[0];

  // Helper date formatted exactly like reference: "Fri, 15 Apr 2026"
  const formattedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const workerName = profile?.name || 'Ramesh Kumar';
  const workerRole = 'Machine Operator';
  const chcName = centre?.centre_name || centre?.name || (profile?.centre_id ? `CHC ${profile.centre_id}` : 'Sundarpur CHC');

  // Status badge styling helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'In Progress':
      case 'WORKING':
        return (
          <span className="bg-[#fef3c7] text-[#b45309] font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
            In Progress
          </span>
        );
      case 'Completed':
      case 'COMPLETED':
        return (
          <span className="bg-[#dcfce7] text-[#15803d] font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <Check className="w-3 h-3" />
            Completed
          </span>
        );
      case 'En Route':
        return (
          <span className="bg-[#e0e7ff] text-[#4338ca] font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            En Route
          </span>
        );
      case 'Started':
        return (
          <span className="bg-[#ecfdf5] text-[#065f46] font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <Play className="w-3 h-3 fill-current" />
            Started
          </span>
        );
      default:
        return (
          <span className="bg-[#e0f2fe] text-[#0369a1] font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center">
            Upcoming
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f4f8f5] text-gray-800 font-sans select-none antialiased">
      
      {/* =========================================================================
          1. FOREST-GREEN SIDEBAR (EXACT MATCH TO REFERENCE SCREENSHOT)
         ========================================================================= */}
      <aside className="w-60 lg:w-64 bg-[#0d3822] text-white flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none shadow-xl relative overflow-hidden">
        
        {/* Top Logo & Navigation */}
        <div className="p-5 flex flex-col gap-6 z-10">
          
          {/* NITI Machine-Day Composer Brand */}
          <div className="flex items-center gap-2.5 pt-2 px-1">
            <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0 shadow-md">
              <svg className="w-5 h-5 text-[#0d3822] fill-current" viewBox="0 0 24 24">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white block leading-tight">
                NITI
              </span>
              <span className="text-[9px] font-extrabold tracking-widest text-[#86efac] block uppercase leading-none">
                LABOUR & WORKER PORTAL
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5 pt-4">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'today'
                  ? 'bg-[#205c38] text-white shadow-xs'
                  : 'text-[#d1fae5]/80 hover:bg-[#15462c] hover:text-white'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span>Today's Jobs</span>
            </button>

            <button
              onClick={() => setActiveTab('my-jobs')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'my-jobs'
                  ? 'bg-[#205c38] text-white shadow-xs'
                  : 'text-[#d1fae5]/80 hover:bg-[#15462c] hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>My Jobs</span>
            </button>

            <button
              onClick={() => setActiveTab('machine')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'machine'
                  ? 'bg-[#205c38] text-white shadow-xs'
                  : 'text-[#d1fae5]/80 hover:bg-[#15462c] hover:text-white'
              }`}
            >
              <Tractor className="w-5 h-5" />
              <span>My Machine</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-[#205c38] text-white shadow-xs'
                  : 'text-[#d1fae5]/80 hover:bg-[#15462c] hover:text-white'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              <span>Job History</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-[#205c38] text-white shadow-xs'
                  : 'text-[#d1fae5]/80 hover:bg-[#15462c] hover:text-white'
              }`}
            >
              <User className="w-5 h-5" />
              <span>Profile</span>
            </button>
          </nav>
        </div>

        {/* Bottom Agricultural Landscape Art & Logout */}
        <div className="p-5 flex flex-col justify-end z-10 relative">
          
          {/* Subtle Agricultural Hills & Tractor Illustration Vector in bottom corner */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none opacity-20">
            <svg viewBox="0 0 300 120" className="w-full text-emerald-400 fill-current">
              <path d="M0,60 C40,40 100,75 160,50 C220,25 280,60 300,40 L300,120 L0,120 Z" />
              <path d="M0,80 C60,65 140,95 200,70 C250,55 280,75 300,70 L300,120 L0,120 Z" opacity="0.6" />
              {/* Mini Tractor Silhouette */}
              <g transform="translate(45, 65) scale(0.6)">
                <circle cx="20" cy="20" r="10" />
                <circle cx="50" cy="24" r="6" />
                <rect x="20" y="10" width="22" height="10" rx="2" />
                <path d="M22,10 L30,0 L38,10 Z" />
              </g>
            </svg>
          </div>

          <button
            onClick={onLogout || (() => window.location.reload())}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-[#fca5a5] hover:bg-red-950/40 hover:text-red-300 transition-colors z-20"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT AREA (SCROLLABLE DESKTOP LAPTOP CANVAS)
         ========================================================================= */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#f4f8f5]">
        
        {/* =======================================================================
            HEADER BANNER WITH AGRICULTURAL BACKGROUND
           ======================================================================= */}
        <header className="relative w-full bg-linear-to-r from-[#dcfce7] via-[#f0fdf4] to-[#e6f4ea] border-b border-emerald-100/80 px-6 lg:px-8 py-5 shrink-0 overflow-hidden">
          
          {/* Scenic Farm Backdrop Artwork */}
          <div className="absolute right-32 inset-y-0 w-96 opacity-35 pointer-events-none hidden md:block">
            <img 
              src="/assets/farm-header-banner.jpg" 
              alt="Farm landscape" 
              className="w-full h-full object-cover object-center mix-blend-multiply"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4">
            
            {/* Left: Greeting & Worker Role */}
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-[#0d3822] tracking-tight">
                Namaste, {workerName}!
              </h1>
              <p className="text-xs lg:text-sm font-medium text-gray-600 mt-0.5 flex items-center gap-1.5">
                <span>{workerRole}</span>
                <span className="text-emerald-700 font-black">•</span>
                <span className="font-semibold text-emerald-900">{chcName}</span>
              </p>
            </div>

            {/* Right: Notifications & Profile Pill */}
            <div className="flex items-center gap-3">
              
              {/* Notification Bell with Badge */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="w-10 h-10 rounded-full bg-white border border-gray-200/90 shadow-xs flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-emerald-800 transition-all relative"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                </button>

                {/* Notifications Dropdown Popup */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 z-50 animate-fade-in text-xs space-y-2">
                    <div className="font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center justify-between">
                      <span>Dispatch Notifications</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">1 New</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/70 space-y-1">
                      <div className="font-bold text-emerald-900">Assigned Job Scheduled</div>
                      <div className="text-gray-600">Wheat Harvesting at Sundarpur is set for 08:00 AM. Route calculated.</div>
                      <div className="text-[10px] text-gray-400">10 mins ago</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Worker Profile Pill Button */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2.5 bg-white border border-gray-200/90 rounded-full pl-1.5 pr-3 py-1 shadow-xs hover:border-emerald-300 transition-all"
                >
                  <img
                    src="/assets/farmer-portrait.jpg"
                    alt={workerName}
                    className="w-8 h-8 rounded-full object-cover object-top border border-emerald-600/40"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="text-left hidden sm:block">
                    <span className="text-xs font-bold text-gray-900 block leading-tight">
                      {workerName}
                    </span>
                    <span className="text-[10px] text-gray-500 block leading-tight">
                      {workerRole}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {/* Profile Menu Popup */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 z-50 animate-fade-in text-xs space-y-3">
                    <div className="pb-2 border-b border-gray-100">
                      <div className="font-bold text-gray-900">{workerName}</div>
                      <div className="text-gray-500">{chcName}</div>
                      <div className="text-[11px] text-emerald-700 font-medium mt-1">License: UP-DL-88219</div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-gray-600 font-medium">Duty Availability:</span>
                      <button
                        onClick={toggleDuty}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          profile?.is_available !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {profile?.is_available !== false ? '● On Duty' : '○ Off Duty'}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('profile');
                      }}
                      className="w-full text-center py-2 rounded-xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-700"
                    >
                      View Full Profile
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </header>

        {/* Global Feedback Toast */}
        {feedbackToast && (
          <div className="mx-6 lg:mx-8 mt-4 p-3.5 rounded-2xl bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{feedbackToast.message}</span>
          </div>
        )}

        {/* Supabase Error Notice */}
        {error && (
          <div className="mx-6 lg:mx-8 mt-4">
            <SupabaseStatusBanner error={error} onRetry={loadOperatorData} title="Database Connectivity Notice" />
          </div>
        )}

        {/* =======================================================================
            TAB 1: TODAY'S JOBS (THE EXACT DESKTOP REFERENCE VIEW)
           ======================================================================= */}
        {activeTab === 'today' && (
          <div className="p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* On-Demand Open Job Broadcasts (Audio 3 USP) */}
            {openJobOffers.length > 0 && (
              <div className="lg:col-span-12 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-400/80 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                    <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                      <span>🚨 Incoming On-Demand Job Requests ({openJobOffers.length})</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold">Live Dispatch</span>
                    </h3>
                  </div>
                  <span className="text-[11px] text-amber-800 font-medium hidden sm:inline">
                    Click "Accept Job" to claim and lock this machine dispatch
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {openJobOffers.map((offer) => (
                    <div 
                      key={offer.offer_id} 
                      className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-black text-gray-900 block">{offer.farmer_name}</span>
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-700" />
                              {offer.farmer_village}, {offer.farmer_district} ({offer.distance_km || 4.2} km away)
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                            ₹{offer.payout_inr} Payout
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2 rounded-xl">
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Operation & Machine</span>
                            <span className="font-bold text-gray-800 truncate block">{offer.operation} • {offer.machine_type}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase font-bold">Acreage & Time</span>
                            <span className="font-bold text-gray-800">{offer.acreage} Acres • {offer.scheduled_time || 'Morning'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAcceptJobOffer(offer)}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#155e38] text-white font-extrabold text-xs hover:bg-[#0f4428] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Accept Job / कार्य स्वीकार करें</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------------
                LEFT PANEL: TODAY'S SCHEDULE (7 COLS ON DESKTOP)
               ------------------------------------------------------------------- */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-emerald-100/90 shadow-xs flex flex-col gap-6">
              
              {/* Card Header: Calendar Icon + Title + Date Badge */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-emerald-800" />
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    Today's Schedule
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>{formattedDate}</span>
                </div>
              </div>

              {/* Vertical Timeline List */}
              <div className="relative flex flex-col gap-5 pt-2">
                
                {/* Connecting Vertical Timeline Line */}
                <div className="absolute left-3.5 top-5 bottom-8 w-0.5 bg-gray-200 -z-0" />

                {displaySchedule.map((item, idx) => {
                  const isSelected = item.id === activeJob.id;
                  const isGreenNumber = item.status === 'In Progress' || isSelected;

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedJobId(item.id)}
                      className="relative z-10 flex items-start gap-3 sm:gap-4 cursor-pointer group"
                    >
                      {/* 1. Sequence Number Circle (1, 2, 3...) */}
                      <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-3 shadow-xs transition-colors ${
                        isGreenNumber 
                          ? 'bg-[#155e38] text-white ring-4 ring-emerald-50' 
                          : 'bg-slate-500 text-white'
                      }`}>
                        {item.index}
                      </div>

                      {/* 2. Time Column */}
                      <div className="w-20 sm:w-24 shrink-0 pt-2.5 text-left">
                        <div className="text-xs sm:text-sm font-extrabold text-gray-900 leading-tight">
                          {item.time}
                        </div>
                        <div className="text-[11px] text-gray-400 font-medium leading-tight">
                          {item.timeEnd}
                        </div>
                      </div>

                      {/* 3. Job Card Content */}
                      <div className={`flex-1 rounded-2xl p-3 sm:p-4 border transition-all flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-[#f0fdf4] border-emerald-300 shadow-xs' 
                          : 'bg-white border-gray-200/80 hover:border-emerald-200 hover:bg-gray-50/50'
                      }`}>
                        
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Machine Thumbnail */}
                          <img 
                            src={item.image} 
                            alt={item.operation}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 border border-gray-100 shadow-2xs"
                          />

                          {/* Details */}
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-extrabold text-gray-900 truncate">
                                {item.operation}
                              </h3>
                              {renderStatusBadge(item.status)}
                            </div>

                            <div className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{item.farmer}</span>
                            </div>

                            <div className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{item.village}</span>
                            </div>

                            <div className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                              <Tractor className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{item.fieldSize}</span>
                            </div>
                          </div>
                        </div>

                        {/* Chevron Indicator */}
                        <div className="p-1 text-gray-400 group-hover:text-emerald-700 transition-colors shrink-0">
                          <ChevronRight className="w-5 h-5" />
                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>

            </div>

            {/* -------------------------------------------------------------------
                RIGHT PANEL: CURRENT JOB & INTERACTIVE MAP (5 COLS ON DESKTOP)
               ------------------------------------------------------------------- */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-emerald-100/90 shadow-xs flex flex-col gap-5">
              
              {/* Card Header: Pulsing Dot + Title + Status */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    Current Job
                  </h2>
                </div>

                <div>
                  {renderStatusBadge(activeJob.status)}
                </div>
              </div>

              {/* Interactive Real Leaflet Map with OSRM Road Route */}
              <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-emerald-200/70 shadow-xs">
                <NitiMap
                  center={
                    (centre?.district && UP_DISTRICT_COORDINATES[centre.district]) 
                    || { lat: 27.5684, lng: 80.6829 }
                  }
                  routeTo={
                    activeJob?.rawDistrict && UP_DISTRICT_COORDINATES[activeJob.rawDistrict]
                      ? { 
                          lat: UP_DISTRICT_COORDINATES[activeJob.rawDistrict].lat + 0.02, 
                          lng: UP_DISTRICT_COORDINATES[activeJob.rawDistrict].lng + 0.02, 
                          label: `${activeJob.farmer} Farm` 
                        }
                      : { lat: 27.5884, lng: 80.7029, label: `${activeJob.farmer} Farm` }
                  }
                  height="100%"
                  title={chcName}
                />
              </div>

              {/* Active Job Details & Action Buttons Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                
                {/* Machine Thumbnail + Info */}
                <div className="flex items-center gap-3">
                  <img
                    src={activeJob.image}
                    alt={activeJob.operation}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0 shadow-2xs"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                        {activeJob.operation}
                      </h3>
                    </div>
                    <div className="pt-0.5">
                      {renderStatusBadge(activeJob.status)}
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-1 pt-0.5 font-medium">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{activeJob.farmer}</span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{activeJob.rawVillage}</span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Tractor className="w-3.5 h-3.5 text-gray-400" />
                      <span>{activeJob.rawAcres} acres</span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0 self-stretch sm:self-auto">
                  
                  {/* 1. Update Status Dropdown Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      disabled={updatingJobId === activeJob.id}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0d3822] hover:bg-[#15462c] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Update Status</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Status Options Dropdown */}
                    {showStatusDropdown && (
                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-50 animate-fade-in text-xs space-y-1">
                        <div className="px-2 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                          Select Next Status
                        </div>
                        <button
                          onClick={() => handleStatusChange(activeJob.id, 'En Route')}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 font-bold text-indigo-700 flex items-center justify-between"
                        >
                          <span>En Route (रवाना)</span>
                          <Navigation className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(activeJob.id, 'Started')}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 font-bold text-emerald-800 flex items-center justify-between"
                        >
                          <span>Started (पहुंचे)</span>
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(activeJob.id, 'In Progress')}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 font-bold text-amber-700 flex items-center justify-between"
                        >
                          <span>In Progress (कार्यरत)</span>
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(activeJob.id, 'Completed')}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 font-bold text-emerald-600 flex items-center justify-between"
                        >
                          <span>Completed (पूर्ण)</span>
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            setShowStatusDropdown(false);
                            setShowIssueModal(true);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 font-bold text-red-600 flex items-center justify-between"
                        >
                          <span>Report Issue...</span>
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Call Farmer Button */}
                  <button
                    onClick={() => setShowCallModal(true)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white border border-[#0d3822] text-[#0d3822] hover:bg-emerald-50 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Farmer</span>
                  </button>

                </div>

              </div>

              {/* Progress Timeline Stepper */}
              <div className="pt-4 border-t border-gray-100">
                <div className="relative flex items-center justify-between">
                  
                  {/* Connecting Line */}
                  <div className="absolute top-2.5 left-4 right-4 h-0.5 bg-gray-200 -z-0" />
                  <div 
                    className="absolute top-2.5 left-4 h-0.5 bg-emerald-600 -z-0 transition-all duration-500" 
                    style={{ 
                      width: activeJob.status === 'Completed' ? '92%' 
                        : activeJob.status === 'In Progress' ? '65%' 
                        : activeJob.status === 'Started' ? '33%' 
                        : '0%' 
                    }}
                  />

                  {/* Step 1: En Route */}
                  <div className="flex flex-col items-center text-center z-10">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-800 mt-1.5">En Route</span>
                    <span className="text-[10px] text-gray-400 leading-none">7:45 AM</span>
                  </div>

                  {/* Step 2: Started */}
                  <div className="flex flex-col items-center text-center z-10">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                      activeJob.status === 'Started' || activeJob.status === 'In Progress' || activeJob.status === 'Completed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border-2 border-gray-300'
                    }`}>
                      {activeJob.status === 'In Progress' || activeJob.status === 'Completed' ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-gray-800 mt-1.5">Started</span>
                    <span className="text-[10px] text-gray-400 leading-none">8:05 AM</span>
                  </div>

                  {/* Step 3: In Progress */}
                  <div className="flex flex-col items-center text-center z-10">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                      activeJob.status === 'Completed'
                        ? 'bg-emerald-600 text-white'
                        : activeJob.status === 'In Progress'
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : 'bg-white border-2 border-gray-300'
                    }`}>
                      {activeJob.status === 'Completed' ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : activeJob.status === 'In Progress' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      ) : null}
                    </div>
                    <span className="text-[11px] font-bold text-gray-800 mt-1.5">In Progress</span>
                    <span className="text-[10px] text-gray-400 leading-none">
                      {activeJob.status === 'In Progress' ? 'Active' : '—'}
                    </span>
                  </div>

                  {/* Step 4: Completed */}
                  <div className="flex flex-col items-center text-center z-10">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                      activeJob.status === 'Completed'
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                        : 'bg-white border-2 border-gray-300'
                    }`}>
                      {activeJob.status === 'Completed' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[11px] font-bold text-gray-800 mt-1.5">Completed</span>
                    <span className="text-[10px] text-gray-400 leading-none">
                      {activeJob.status === 'Completed' ? 'Done' : '—'}
                    </span>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* =======================================================================
            TAB 2: MY JOBS (SECONDARY PAGE)
           ======================================================================= */}
        {activeTab === 'my-jobs' && (
          <div className="p-6 lg:p-8 flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">All Assigned Jobs</h2>
                <p className="text-xs text-gray-500">Overview of all seasonal field assignments dispatched by your CHC hub</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                {jobs.length} Total Records
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displaySchedule.map((job) => (
                <div key={job.id} className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-400">Time: {job.timeFull}</span>
                    {renderStatusBadge(job.status)}
                  </div>
                  <div className="flex items-center gap-3">
                    <img src={job.image} alt={job.operation} className="w-14 h-14 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm">{job.operation}</h4>
                      <p className="text-xs text-gray-600">{job.farmer}</p>
                      <p className="text-[11px] text-gray-400">{job.rawVillage}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setActiveTab('today');
                    }}
                    className="w-full py-2 rounded-xl bg-gray-50 hover:bg-emerald-50 text-emerald-900 font-bold text-xs border border-gray-200"
                  >
                    View on Route Map →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =======================================================================
            TAB 3: MY MACHINE (SECONDARY PAGE)
           ======================================================================= */}
        {activeTab === 'machine' && (
          <div className="p-6 lg:p-8 flex-1 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Assigned Machine & Implements</h2>
              <p className="text-xs text-gray-500">Real-time status, health check, and specifications of your assigned CHC unit</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <img src="/assets/harvester.jpg" alt="Machine" className="w-full h-52 rounded-2xl object-cover border" />
              </div>

              <div className="space-y-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Verified Active</span>
                  <h3 className="text-xl font-black text-gray-900 mt-1">Dasmesh 9100 Combine Harvester</h3>
                  <p className="text-xs text-gray-500">Registration: UP-32-CH-8821 • Assigned by {chcName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-50 border">
                    <span className="text-gray-400 block text-[10px]">Engine Power</span>
                    <span className="font-bold text-gray-800">101 HP Turbo</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border">
                    <span className="text-gray-400 block text-[10px]">Cutter Bar Width</span>
                    <span className="font-bold text-gray-800">14 Feet Grain Head</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border">
                    <span className="text-gray-400 block text-[10px]">Diesel Tank</span>
                    <span className="font-bold text-emerald-700">78% (140 Liters)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border">
                    <span className="text-gray-400 block text-[10px]">Service Health</span>
                    <span className="font-bold text-emerald-700">100% Ready</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 font-medium">
                  ✓ Pair-checked with operator skills: Certified for Rice & Wheat harvesting.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            TAB 4: JOB HISTORY (SECONDARY PAGE)
           ======================================================================= */}
        {activeTab === 'history' && (
          <div className="p-6 lg:p-8 flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">Job Completion Log</h2>
                <p className="text-xs text-gray-500">Archived record of all successfully completed operations with farmer ratings</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                Past Season Records
              </span>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b">
                    <tr>
                      <th className="py-3 px-4">Booking ID</th>
                      <th className="py-3 px-4">Operation</th>
                      <th className="py-3 px-4">Farmer</th>
                      <th className="py-3 px-4">Area Worked</th>
                      <th className="py-3 px-4">Farmer Rating</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {displaySchedule.map((j, i) => (
                      <tr key={j.id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-900">BK-0{i + 1}88</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{j.operation}</td>
                        <td className="py-3 px-4">{j.farmer}</td>
                        <td className="py-3 px-4">{j.rawAcres} Acres</td>
                        <td className="py-3 px-4 flex items-center gap-1 text-amber-600 font-bold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>5.0</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            TAB 5: PROFILE (SECONDARY PAGE)
           ======================================================================= */}
        {activeTab === 'profile' && (
          <div className="p-6 lg:p-8 flex-1 space-y-6 max-w-3xl">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Worker Profile & Credentials</h2>
              <p className="text-xs text-gray-500">Government certified agricultural machinery operator profile</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-xs space-y-6">
              <div className="flex items-center gap-4">
                <img src="/assets/farmer-portrait.jpg" alt="Avatar" className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{workerName}</h3>
                  <p className="text-xs text-gray-500">Badge ID: OP-UP-2026 • {chcName}</p>
                  <span className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    ✓ Verified Skilled Operator
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-gray-50 border space-y-1">
                  <span className="text-gray-400 block text-[10px]">Driving License Number</span>
                  <span className="font-bold text-gray-800">UP-32-2015-0044120 (Heavy Agri)</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 border space-y-1">
                  <span className="text-gray-400 block text-[10px]">Experience Level</span>
                  <span className="font-bold text-gray-800">8 Years Active Field Operation</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 border space-y-1">
                  <span className="text-gray-400 block text-[10px]">Primary Machine Skills</span>
                  <span className="font-bold text-gray-800">Tractors (45-75 HP), Harvester, Rotavator</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 border space-y-1">
                  <span className="text-gray-400 block text-[10px]">Current Shift Status</span>
                  <span className="font-bold text-emerald-700">● On Duty (Ready for Dispatch)</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={toggleDuty}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs"
                >
                  Toggle Duty Status
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* =========================================================================
          MODALS: CALL FARMER & REPORT ISSUE
         ========================================================================= */}
      
      {/* Call Farmer Modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <PhoneCall className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Call {activeJob.farmer}</h3>
              <p className="text-xs text-gray-500 mt-1">{activeJob.rawVillage}</p>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50 font-mono font-bold text-base text-emerald-900 border">
              {activeJob.farmerPhone}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCallModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <a
                href={`tel:${activeJob.farmerPhone}`}
                onClick={() => setShowCallModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Dial Now</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg text-gray-900">Report Operational Issue</h3>
            </div>
            <p className="text-xs text-gray-500">
              Notify the CHC Dispatch Manager immediately regarding machine trouble, field conditions, or farmer delays.
            </p>

            <form onSubmit={handleReportIssue} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Issue Category</label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                >
                  <option>Mechanical Breakdown</option>
                  <option>Fuel / Diesel Depletion</option>
                  <option>Field Inaccessible / Waterlogged</option>
                  <option>Farmer Unavailable / Postponed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Details & Remarks</label>
                <textarea
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  rows={3}
                  placeholder="Describe the issue observed..."
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  Send Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OperatorDashboard;
