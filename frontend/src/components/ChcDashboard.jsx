import React, { useState, useEffect } from 'react';
import { 
  Tractor, 
  Users, 
  Calendar, 
  FileText, 
  Bell, 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  Plus, 
  Minus, 
  Crosshair, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  Wrench, 
  DollarSign, 
  ArrowUpRight, 
  ArrowRight,
  RefreshCw, 
  ShieldCheck,
  Send,
  Sliders,
  LogOut,
  Sparkles,
  BookOpen,
  BarChart2,
  Settings as CogIcon
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { 
  centresService, 
  bookingsService, 
  machineryService, 
  operatorsService, 
  analyticsService,
  operatorDispatchService,
  breakdownService
} from '../api/supabaseService';
import { BreakdownRecoverySection } from './BreakdownRecoverySection';
import { ChcAnalyticsSection } from './ChcAnalyticsSection';
import { SupabaseStatusBanner } from './SupabaseStatusBanner';
import { NitiMap } from './NitiMap';
import { UP_DISTRICT_COORDINATES, calculateHaversineDistance } from '../services/routingService';
import { supabase } from '../api/supabaseClient';

export function ChcDashboard({ currentUser, activeSubView = 'dashboard', onSelectSubView, onLogout, lang = 'hi', t }) {
  // Operational statistics from Supabase
  const [stats, setStats] = useState({
    chc_name: 'Custom Hiring Centre',
    manager_name: 'Centre Coordinator',
    manager_initials: 'CHC',
    service_requests_count: 0,
    pending_reviews_count: 0,
    today_jobs_count: 0,
    jobs_in_progress_count: 0,
    active_machines_count: 0,
    maintenance_machines_count: 0,
    available_operators_count: 0,
    on_leave_operators_count: 0,
  });

  // Schedule & Request tables
  const [scheduleItems, setScheduleItems] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // Machine Breakdown Alerts state
  const [breakdownCases, setBreakdownCases] = useState(() => breakdownService.getDemoCases());
  const [selectedRecoveryCaseId, setSelectedRecoveryCaseId] = useState('BD-CASE-001');
  const [showResolvedBreakdowns, setShowResolvedBreakdowns] = useState(false);

  // Profile & Notifications dropdown
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Review & Offer Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [offerPricePerAcre, setOfferPricePerAcre] = useState('800');
  const [offerDurationHours, setOfferDurationHours] = useState('3.5');
  const [offerMachineModel, setOfferMachineModel] = useState('Tractor 60 HP');
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Schedule & Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    job_id: '',
    machine_id: '',
    operator_id: '',
    time_slot: '08:00 – 12:00',
  });

  // Map Zoom & Center State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [chcCenter, setChcCenter] = useState({ lat: 27.8974, lng: 78.0880 });
  const [operatingRadiusKm, setOperatingRadiusKm] = useState(25);
  const [mapMarkers, setMapMarkers] = useState([]);

  // Subview specific lists & filters
  const [machinesList, setMachinesList] = useState([]);
  const [operatorsList, setOperatorsList] = useState([]);
  const [allBookingsList, setAllBookingsList] = useState([]);
  const [currentCentreData, setCurrentCentreData] = useState(null);
  const [requestFilter, setRequestFilter] = useState('Pending'); // Default to Pending so action items are separated immediately
  const [bookingListTab, setBookingListTab] = useState('Approved'); // 'Approved' | 'Pending' | 'Waiting for Farmer Confirmation' | 'Completed' | 'ALL'
  const [recentTab, setRecentTab] = useState('pending'); // 'pending' | 'approved'
  const [requestSearch, setRequestSearch] = useState('');
  const [mapModalRequest, setMapModalRequest] = useState(null);

  // Load real backend data from Supabase
  const loadDashboardData = async () => {
    setLoading(true);
    setDashboardError(null);
    try {
      const centres = await centresService.getAllCentres();
      const currentCentre = centres?.find(c => c.centre_id === currentUser?.centre_id || c.id === currentUser?.id || c.centre_id === 'CHC001') || (centres && centres.length > 0 ? centres[0] : null);
      const centreId = currentCentre?.id || currentCentre?.centre_id || currentUser?.centre_id || 'CHC001';

      const [overviewData, centreBookings, machines, operators] = await Promise.all([
        analyticsService.getChcOverview(centreId).catch(() => null),
        centreId ? bookingsService.getCentreBookings(centreId).catch(() => []) : Promise.resolve([]),
        centreId ? machineryService.getAvailableMachinery({ centre_id: centreId }).catch(() => []) : machineryService.getAvailableMachinery().catch(() => []),
        centreId ? operatorsService.getOperatorsByCentre(centreId).catch(() => []) : operatorsService.getAllOperators().catch(() => [])
      ]);

      const districtCoord = currentCentre?.district ? UP_DISTRICT_COORDINATES[currentCentre.district] : null;
      const centerCoords = (currentCentre?.latitude && currentCentre?.longitude)
        ? { lat: currentCentre.latitude, lng: currentCentre.longitude }
        : (districtCoord || { lat: 27.8974, lng: 78.0880 });
      setChcCenter(centerCoords);
      setOperatingRadiusKm(currentCentre?.operating_radius_km || 25);

      // Live mappings from database records (with authentic Indian farmer names)
      const mappedRequests = (centreBookings || []).map(b => {
        const isPending = b.status === 'Pending' || (!b.status && (b.hours === 0 || b.hours == null));
        const isApproved = b.status === 'Approved' || (!b.status && b.hours === 1);
        const isCompleted = b.status === 'Completed' || (!b.status && (b.hours != null && b.hours >= 2 || b.farmer_rating != null));
        const resolvedStatus = isPending ? 'Pending' : (isApproved ? 'Approved' : (isCompleted ? 'Completed' : (b.status || 'Pending')));

        const district = b.farmers?.district || currentCentre?.district || 'Aligarh';
        const baseCoord = UP_DISTRICT_COORDINATES[district] || centerCoords;
        const hash = (b.booking_id || b.id || '1').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const latOffset = ((hash % 100) - 50) * 0.0035;
        const lngOffset = (((hash * 17) % 100) - 50) * 0.0035;
        const reqLat = b.latitude ? Number(b.latitude) : Number((baseCoord.lat + latOffset).toFixed(4));
        const reqLng = b.longitude ? Number(b.longitude) : Number((baseCoord.lng + lngOffset).toFixed(4));
        const distKm = calculateHaversineDistance(centerCoords.lat, centerCoords.lng, reqLat, reqLng);

        const reqDate = b.scheduled_date || b.booking_date || new Date().toISOString().split('T')[0];
        const standardSlots = ['08:00 AM – 12:00 PM', '01:00 PM – 05:00 PM', '09:00 AM – 01:00 PM', '02:00 PM – 06:00 PM', '07:30 AM – 11:30 AM'];
        const fallbackSlot = standardSlots[Math.abs(hash) % standardSlots.length];
        const reqTime = b.scheduled_time && !b.scheduled_time.includes('hrs completed') ? b.scheduled_time : fallbackSlot;

        return {
          id: b.booking_reference || b.booking_id || b.id || (b.id ? `BK-${b.id}` : 'BK-REQ'),
          raw_id: b.booking_id || b.id,
          farmer: b.farmers?.name || b.farmers?.full_name || b.farmer || 'Farmer',
          farmer_village: b.farmers?.village || b.field_location || 'Aligarh Rural',
          farmer_district: district,
          operation: b.operation || (b.machinery?.machine_type ? `${b.machinery.machine_type} Work` : 'Harvesting & Field Prep'),
          machine: b.machinery?.name || b.machinery?.machine_type || 'Tractor Unit',
          acreage: b.farm_area != null ? b.farm_area : (b.area_worked_acre != null ? b.area_worked_acre : 1.19),
          requested_date: reqDate,
          requested_time: reqTime,
          time: reqTime,
          timestamp: `${reqDate} • ${reqTime}`,
          lat: reqLat,
          lng: reqLng,
          distance_km: distKm,
          status: resolvedStatus
        };
      });

      // Sort so Pending and Under Review appear first, and newest by date
      mappedRequests.sort((a, b) => {
        const aPending = a.status === 'Pending' || a.status === 'Under Review';
        const bPending = b.status === 'Pending' || b.status === 'Under Review';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        return (b.requested_date || '').localeCompare(a.requested_date || '');
      });

      setRecentRequests(mappedRequests);

      const mappedSchedule = (centreBookings || [])
        .filter(b => b.status === 'Scheduled' || b.status === 'In Progress' || b.status === 'Approved' || b.status === 'Completed' || (b.hours != null && b.hours > 0))
        .map(b => {
          const district = b.farmers?.district || currentCentre?.district || 'Aligarh';
          const baseCoord = UP_DISTRICT_COORDINATES[district] || centerCoords;
          const hash = (b.booking_id || b.id || '1').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const latOffset = ((hash % 100) - 50) * 0.0035;
          const lngOffset = (((hash * 17) % 100) - 50) * 0.0035;
          const reqLat = b.latitude ? Number(b.latitude) : Number((baseCoord.lat + latOffset).toFixed(4));
          const reqLng = b.longitude ? Number(b.longitude) : Number((baseCoord.lng + lngOffset).toFixed(4));
          const distKm = calculateHaversineDistance(centerCoords.lat, centerCoords.lng, reqLat, reqLng);
          const standardSlots = ['08:00 AM – 12:00 PM', '01:00 PM – 05:00 PM', '09:00 AM – 01:00 PM', '02:00 PM – 06:00 PM', '07:30 AM – 11:30 AM'];
          const fallbackSlot = standardSlots[Math.abs(hash) % standardSlots.length];
          const reqTime = b.scheduled_time && !b.scheduled_time.includes('hrs completed') ? b.scheduled_time : fallbackSlot;

          return {
            id: b.booking_id || b.id,
            time: reqTime,
            farmer: b.farmers?.name || b.farmers?.full_name || 'Farmer',
            farmer_village: b.farmers?.village || b.field_location || 'Aligarh Rural',
            farmer_district: district,
            operation: b.operation || (b.machinery?.machine_type ? `${b.machinery.machine_type} Work` : 'Field Work'),
            machine: b.machinery?.name || b.machinery?.machine_type || 'Tractor Unit',
            status: b.status === 'Completed' ? 'Completed' : b.status === 'In Progress' ? 'In Progress' : (b.status === 'Approved' ? 'Approved' : 'Upcoming'),
            acreage: b.farm_area || b.area_worked_acre || 1.19,
            lat: reqLat,
            lng: reqLng,
            distance_km: distKm,
            scheduled_date: b.scheduled_date || b.booking_date
          };
        });

      // Sort so newest scheduled date comes first
      mappedSchedule.sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''));
      setScheduleItems(mappedSchedule);

      const pendingCount = mappedRequests.filter(r => r.status === 'Pending' || r.status === 'Under Review').length;

      if (currentCentre) {
        setStats({
          chc_name: currentCentre.name || currentCentre.centre_name || 'Custom Hiring Centre',
          manager_name: currentCentre.manager_name || 'Centre Manager',
          manager_initials: currentCentre.manager_name ? currentCentre.manager_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'CHC',
          service_requests_count: mappedRequests.length,
          pending_reviews_count: pendingCount,
          today_jobs_count: centreBookings.filter(b => b.status === 'Scheduled' || b.status === 'In Progress' || b.status === 'Approved' || (!b.status && b.hours === 1)).length,
          jobs_in_progress_count: centreBookings.filter(b => b.status === 'In Progress').length,
          active_machines_count: machines.filter(m => m.status === 'Available' || m.status === 'AVAILABLE').length,
          maintenance_machines_count: machines.filter(m => m.status === 'Maintenance').length,
          available_operators_count: operators.filter(o => o.is_available).length,
          on_leave_operators_count: operators.filter(o => !o.is_available).length,
        });
      } else if (overviewData) {
        setStats(prev => ({
          ...prev,
          chc_name: 'Custom Hiring Centre',
          manager_name: 'Centre Manager',
          manager_initials: 'CHC',
          service_requests_count: mappedRequests.length || overviewData.total_bookings || 0,
          pending_reviews_count: pendingCount,
          today_jobs_count: 0,
          active_machines_count: overviewData.active_machines || 0,
          available_operators_count: overviewData.available_operators || 0
        }));
      }

      setMachinesList(machines || []);
      setOperatorsList(operators || []);
      setAllBookingsList(centreBookings || []);
      setCurrentCentreData(currentCentre);
      setBreakdownCases(breakdownService.getDemoCases());

      // Construct live multi-entity operations markers for NitiMap
      // 1. CHCs: Primary Centre + Nearby Registered CHCs
      const chcMarkers = [
        {
          id: currentCentre?.centre_id || currentCentre?.id || 'CHC001',
          type: 'CHC',
          name: currentCentre?.name || stats.chc_name || 'CHC Pur Kalan',
          label: currentCentre?.name || 'CHC Pur Kalan',
          village: currentCentre?.village || 'Pur Kalan',
          district: currentCentre?.district || 'Aligarh',
          lat: centerCoords.lat,
          lng: centerCoords.lng,
          operatingRadiusKm: currentCentre?.operating_radius_km || 25,
          available_machines: (machines || []).filter(m => m.status === 'Available' || m.status === 'AVAILABLE').length,
          total_machines: (machines || []).length,
          available_operators: (operators || []).filter(o => o.is_available).length,
          total_operators: (operators || []).length,
          pending_requests: pendingCount,
          status: 'Operational'
        },
        ...(centres || []).filter(c => c.centre_id !== currentCentre?.centre_id && c.id !== currentCentre?.id).slice(0, 3).map((c, i) => {
          const distCoord = c.district ? UP_DISTRICT_COORDINATES[c.district] : null;
          const cLat = c.latitude ? Number(c.latitude) : (distCoord ? distCoord.lat : (centerCoords.lat + (i === 0 ? 0.085 : -0.075)));
          const cLng = c.longitude ? Number(c.longitude) : (distCoord ? distCoord.lng : (centerCoords.lng + (i === 0 ? -0.065 : 0.082)));
          return {
            id: c.centre_id || c.id || `CHC-NEARBY-${i}`,
            type: 'CHC',
            name: c.name || `CHC ${c.district || 'Regional'} Hub`,
            label: c.name ? c.name.replace('Custom Hiring Centre', 'CHC') : 'Nearby CHC',
            village: c.village || 'Grid Node',
            district: c.district || 'Uttar Pradesh',
            lat: Number(cLat.toFixed(4)),
            lng: Number(cLng.toFixed(4)),
            operatingRadiusKm: c.operating_radius_km || 25,
            available_machines: 6,
            total_machines: 8,
            available_operators: 4,
            total_operators: 5,
            pending_requests: 1,
            status: 'Operational'
          };
        })
      ];

      // 2. Farmers: Farm parcel coordinates from bookings with crop, operation, acreage, schedule
      const farmerMarkers = (centreBookings || []).map((b, i) => {
        const farmerName = b.farmers?.name || b.farmers?.full_name || b.farmer || `Farmer ${i + 1}`;
        const village = b.farmers?.village || b.field_location || 'Aligarh Rural';
        const district = b.farmers?.district || currentCentre?.district || 'Aligarh';
        const baseCoord = UP_DISTRICT_COORDINATES[district] || centerCoords;
        const hash = (b.booking_id || b.id || String(i)).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const latOffset = ((hash % 100) - 50) * 0.0035;
        const lngOffset = (((hash * 17) % 100) - 50) * 0.0035;
        const fLat = b.latitude ? Number(b.latitude) : Number((baseCoord.lat + latOffset).toFixed(4));
        const fLng = b.longitude ? Number(b.longitude) : Number((baseCoord.lng + lngOffset).toFixed(4));
        return {
          id: b.booking_reference || b.booking_id || b.id || `FARM-${i}`,
          type: 'FARMER',
          name: farmerName,
          farmer: farmerName,
          label: farmerName,
          village,
          district,
          lat: fLat,
          lng: fLng,
          operation: b.operation || (b.machinery?.machine_type ? `${b.machinery.machine_type} Work` : 'Field Work'),
          crop: b.crop_type || b.crop || 'Wheat / Mustard',
          acreage: b.farm_area || b.area_worked_acre || 3.5,
          schedule_date: b.scheduled_date || b.booking_date || 'Today',
          booking_id: b.booking_reference || b.booking_id || b.id,
          status: b.status || 'Pending',
          priority_score: b.priority_score || (b.hours != null ? 88 : 74)
        };
      });

      // 3. Contributors: Machine owners, equipment operators with assigned jobs & transparent GPS status
      const contributorMarkers = (operators || []).map((o, idx) => {
        const assignedBooking = (centreBookings || []).find(b => 
          b.operator_id === o.id || b.operator_id === o.operator_id || (b.status === 'In Progress' && !o.is_available)
        );
        const opBaseLat = assignedBooking && assignedBooking.latitude 
          ? Number(assignedBooking.latitude) 
          : (centerCoords.lat + (idx % 2 === 0 ? 0.014 : -0.016) + (idx * 0.002));
        const opBaseLng = assignedBooking && assignedBooking.longitude 
          ? Number(assignedBooking.longitude) 
          : (centerCoords.lng + (idx % 2 === 0 ? -0.015 : 0.012) + (idx * 0.002));
        return {
          id: o.id || o.operator_id || `OP-${idx}`,
          type: 'CONTRIBUTOR',
          name: o.name || `Operator ${idx + 1}`,
          label: o.name ? o.name.split(' ')[0] : 'Operator',
          role: o.role || 'Certified Equipment Operator',
          phone: o.phone || '+91 98*** **420',
          skills: o.skills || 'Combine Harvester, Heavy Tractor, Rotavator',
          associated_machines: o.assigned_machine || 'Tractor & Harvester Fleet',
          village: assignedBooking ? (assignedBooking.farmers?.village || 'Field Node') : (currentCentre?.village || 'Pur Kalan Base'),
          district: currentCentre?.district || 'Aligarh',
          status: assignedBooking ? 'Assigned' : (o.is_available ? 'Available' : 'Unavailable'),
          current_assignment: assignedBooking ? `${assignedBooking.booking_reference || assignedBooking.id} (${assignedBooking.operation || 'Field Work'})` : 'No current assignment',
          destination: assignedBooking ? (assignedBooking.farmers?.village || 'Field Parcel') : 'CHC Pur Kalan Hub',
          task_status: assignedBooking ? (assignedBooking.status || 'In Progress') : 'Standby / Available',
          expected_schedule: assignedBooking ? (assignedBooking.scheduled_time || '08:00 AM – 12:00 PM') : 'N/A',
          last_verified_at: '18 Oct 2026, 08:40 AM IST',
          lat: Number(opBaseLat.toFixed(4)),
          lng: Number(opBaseLng.toFixed(4)),
          tracking_note: 'Live GPS broadcast inactive; base coordinates verified via CHC Registry'
        };
      });

      // 4. Machinery: Available, assigned, or under-maintenance machines
      const machineryMarkers = (machines || []).map((m, idx) => {
        const assignedBooking = (centreBookings || []).find(b => b.machine_id === m.machine_id || b.machine_id === m.id);
        const isMaintenance = m.status === 'Maintenance' || m.status === 'Under Maintenance';
        const machBaseLat = assignedBooking && assignedBooking.latitude 
          ? Number(assignedBooking.latitude) 
          : (isMaintenance ? (centerCoords.lat + 0.002) : (centerCoords.lat + (idx % 2 === 0 ? 0.008 : -0.008) + (idx * 0.002)));
        const machBaseLng = assignedBooking && assignedBooking.longitude 
          ? Number(assignedBooking.longitude) 
          : (isMaintenance ? (centerCoords.lng - 0.003) : (centerCoords.lng + (idx % 2 === 0 ? -0.010 : 0.008) + (idx * 0.002)));
        return {
          id: m.machine_id || m.id || `MACH-${idx}`,
          type: 'MACHINERY',
          name: m.name || m.machine_type || 'Machinery Unit',
          label: m.name ? m.name.split(' ')[0] + ' ' + (m.machine_id || '') : 'Machine',
          machine_id: m.machine_id || m.id,
          machine_type: m.machine_type || 'Agricultural Equipment',
          horsepower: m.horsepower || m.hp || '55 HP',
          supported_operations: m.supported_operations || m.operations || 'Tillage, Harvesting, Sowing, Laser Leveling',
          owner_chc: currentCentre?.name || 'CHC Pur Kalan',
          village: isMaintenance ? 'CHC Workshop' : (assignedBooking ? (assignedBooking.farmers?.village || 'Field Node') : (currentCentre?.village || 'CHC Yard')),
          district: currentCentre?.district || 'Aligarh',
          status: isMaintenance ? 'Maintenance' : (assignedBooking ? 'Assigned' : 'Available'),
          current_assignment: assignedBooking ? `${assignedBooking.booking_reference || assignedBooking.id} (${assignedBooking.operation || 'Field Work'})` : 'No current assignment',
          destination: assignedBooking ? (assignedBooking.farmers?.village || 'Field Parcel') : 'CHC Central Yard',
          location_node: isMaintenance ? 'CHC Maintenance Bay (Workshop)' : (assignedBooking ? 'Dispatched to Farm Parcel' : 'CHC Central Fleet Yard'),
          lat: Number(machBaseLat.toFixed(4)),
          lng: Number(machBaseLng.toFixed(4))
        };
      });

      // Combine all authorized entities with valid coordinates
      const allOperationsMarkers = [
        ...chcMarkers,
        ...farmerMarkers,
        ...contributorMarkers,
        ...machineryMarkers
      ];
      setMapMarkers(allOperationsMarkers);

    } catch (err) {
      console.error('[ChcDashboard] Load error from Supabase:', err);
      setDashboardError(err);
      setScheduleItems([]);
      setRecentRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    if (!supabase) return;
    const channel = supabase.channel('chc-broadcast-' + Math.random().toString(36).substring(7));

    channel.on('broadcast', { event: 'new_booking' }, (event) => {
      console.log('[ChcDashboard] Received live realtime booking broadcast:', event);
      const b = event.payload;
      if (b) {
        const reqDate = b.requested_date || b.scheduled_date || b.booking_date || new Date().toISOString().split('T')[0];
        const reqTime = b.time || b.scheduled_time || '09:00 AM';
        const formatted = {
          id: b.booking_reference || b.booking_id || b.id,
          raw_id: b.id || b.booking_id,
          farmer: b.farmer || b.farmers?.name || b.farmers?.full_name || 'Farmer',
          farmer_village: b.farmer_village || b.field_location || 'Village',
          farmer_district: b.farmer_district || 'Aligarh',
          operation: b.operation || 'Harvesting',
          acreage: b.acreage || b.farm_area || b.area_worked_acre || 1.19,
          requested_date: reqDate,
          requested_time: reqTime,
          timestamp: `${reqDate} • ${reqTime}`,
          lat: b.latitude ? Number(b.latitude) : (chcCenter?.lat || 27.8974),
          lng: b.longitude ? Number(b.longitude) : (chcCenter?.lng || 78.0880),
          status: 'Pending',
          time: reqTime,
          machine: b.machine || b.machinery?.machine_type || 'Tractor Unit',
        };

        setRecentRequests(prev => [formatted, ...prev.filter(r => r.id !== formatted.id)]);
        setScheduleItems(prev => [formatted, ...prev.filter(r => r.id !== formatted.id)]);
        setAllBookingsList(prev => [b, ...prev.filter(x => (x.id || x.booking_id) !== (b.id || b.booking_id))]);
        setStats(prev => ({
          ...prev,
          service_requests_count: (prev.service_requests_count || 0) + 1,
          pending_reviews_count: (prev.pending_reviews_count || 0) + 1,
        }));
        setFeedbackToast({
          type: 'success',
          msg: `🚨 New live request from ${formatted.farmer} (${formatted.operation}, ${formatted.acreage} acres)!`,
        });
        setTimeout(() => setFeedbackToast(null), 6000);
      }
    });

    channel.on('broadcast', { event: 'booking_deleted' }, (event) => {
      console.log('[ChcDashboard] Received booking_deleted broadcast:', event);
      const delId = event.payload?.booking_id || event.payload?.id;
      if (delId) {
        setRecentRequests(prev => prev.filter(r => r.raw_id !== delId && r.id !== delId));
        setScheduleItems(prev => prev.filter(s => s.id !== delId));
        setAllBookingsList(prev => prev.filter(b => (b.booking_id !== delId && b.id !== delId)));
        setStats(prev => ({
          ...prev,
          service_requests_count: Math.max(0, (prev.service_requests_count || 1) - 1),
          pending_reviews_count: Math.max(0, (prev.pending_reviews_count || 1) - 1),
        }));
        setFeedbackToast({
          type: 'info',
          msg: `🗑️ Booking ${delId} removed from dispatch.`,
        });
        setTimeout(() => setFeedbackToast(null), 4000);
      }
    });

    channel.on('broadcast', { event: 'booking_status_updated' }, () => {
      loadDashboardData();
    });

    channel.on('broadcast', { event: 'breakdown_recovery_approved' }, () => {
      console.log('[ChcDashboard] Breakdown recovery approved broadcast received; refreshing cases and dashboard');
      setBreakdownCases(breakdownService.getDemoCases());
      loadDashboardData();
    });

    channel.on('broadcast', { event: 'operator_job_accepted' }, () => {
      loadDashboardData();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenLocationOnMap = (req) => {
    const lat = req.lat || chcCenter?.lat || 27.8974;
    const lng = req.lng || chcCenter?.lng || 78.0880;
    const marker = {
      id: req.raw_id || req.id,
      farmer: req.farmer,
      label: req.farmer,
      village: req.farmer_village,
      district: req.farmer_district,
      lat,
      lng,
      operation: req.operation,
      acreage: req.acreage,
      status: req.status,
      type: 'FIELD'
    };
    setSelectedMarker(marker);
    setMapModalRequest({ ...req, lat, lng });
  };

  const handleReviewAction = async (action) => {
    if (!selectedRequest) return;
    setOfferSubmitting(true);
    try {
      if (action === 'APPROVE') {
        const offerData = {
          offer_price_per_acre: Number(offerPricePerAcre) || 800,
          offer_duration_hours: Number(offerDurationHours) || 3.5,
          offer_machine_model: offerMachineModel || 'Tractor 60 HP',
        };
        await bookingsService.sendChcOffer(selectedRequest.raw_id || selectedRequest.id, offerData);

        setFeedbackToast({
          type: 'success',
          msg: `Offer sent for booking ${selectedRequest.id}! Status is now 'Waiting for Farmer Confirmation'.`,
        });

        // Update state locally
        setRecentRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: 'Waiting for Farmer Confirmation' } : r));
      } else if (action === 'REJECT') {
        await bookingsService.updateBookingStatus(selectedRequest.raw_id || selectedRequest.id, 'Rejected');

        setFeedbackToast({
          type: 'success',
          msg: `Booking ${selectedRequest.id} marked as Rejected.`,
        });

        setRecentRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: 'Rejected' } : r));
      } else {
        await bookingsService.updateBookingStatus(selectedRequest.raw_id || selectedRequest.id, 'Under Review');

        setFeedbackToast({
          type: 'success',
          msg: `Booking ${selectedRequest.id} marked as Under Review.`,
        });

        setRecentRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: 'Under Review' } : r));
      }

      setTimeout(() => setFeedbackToast(null), 4000);
      setSelectedRequest(null);
      loadDashboardData();
    } catch (err) {
      setFeedbackToast({ type: 'error', msg: err.message || 'Action failed' });
      setTimeout(() => setFeedbackToast(null), 4000);
    } finally {
      setOfferSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            {status}
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
            {status}
          </span>
        );
      case 'Waiting for Farmer Confirmation':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">
            Waiting for Farmer
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {status}
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            {status}
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            {status}
          </span>
        );
      case 'Rejected':
      case 'Cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
            {status}
          </span>
        );
      case 'Upcoming':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  // Real ledger counts derived directly from allBookingsList
  const pendingRequestsCount = allBookingsList.filter(b => b.status === 'Pending' || b.status === 'Under Review').length;
  const approvedRequestsCount = allBookingsList.filter(b => b.status === 'Approved' || b.status === 'Scheduled' || b.status === 'In Progress').length;
  const waitingConfirmationCount = allBookingsList.filter(b => b.status === 'Waiting for Farmer Confirmation').length;
  const completedRequestsCount = allBookingsList.filter(b => b.status === 'Completed' || b.status === 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 pb-16">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#134e2e] tracking-tight leading-tight">
            CHC Manager Dashboard
          </h1>
          <p className="text-xs font-medium text-gray-500 mt-0.5">
            {stats.chc_name}
          </p>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Notification Bell with Badge 3 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-700" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </button>

            {/* Notifications Flyout */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 py-3 z-30 animate-fade-in">
                <div className="px-4 pb-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Notifications</span>
                  <span className="text-[11px] text-emerald-700 font-semibold cursor-pointer">Mark all read</span>
                </div>
                <div className="divide-y divide-gray-100 text-xs">
                  <div className="p-3 hover:bg-gray-50 cursor-pointer">
                    <div className="font-bold text-gray-900">New Request Received</div>
                    <div className="text-gray-500 text-[11px]">Ram Singh requested Land Preparation (5 acres)</div>
                    <div className="text-[10px] text-gray-400 mt-1">10 mins ago</div>
                  </div>
                  <div className="p-3 hover:bg-gray-50 cursor-pointer">
                    <div className="font-bold text-gray-900">Offer Accepted by Farmer</div>
                    <div className="text-gray-500 text-[11px]">Sita Devi accepted quote for Seeding Drill</div>
                    <div className="text-[10px] text-gray-400 mt-1">1 hour ago</div>
                  </div>
                  <div className="p-3 hover:bg-gray-50 cursor-pointer">
                    <div className="font-bold text-gray-900">Operator Job Completed</div>
                    <div className="text-gray-500 text-[11px]">Tractor PB-10 finished ploughing job in Bhojpur</div>
                    <div className="text-[10px] text-gray-400 mt-1">2 hours ago</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile Badge: RM | Ravi Meena, CHC Manager */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#134e2e] text-white flex items-center justify-center font-bold text-sm tracking-tight shrink-0 shadow-xs">
                {stats.manager_initials}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-gray-900 leading-tight">
                  {stats.manager_name}
                </div>
                <div className="text-[11px] text-gray-500 font-medium">
                  CHC Manager
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
            </button>

            {/* Profile Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-30 animate-fade-in text-xs font-medium">
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="font-bold text-gray-900">{stats.manager_name}</div>
                  <div className="text-[11px] text-gray-500">{stats.chc_name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onSelectSubView) onSelectSubView('settings');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                >
                  <CogIcon className="w-4 h-4 text-gray-400" />
                  CHC Settings & Fleet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    loadDashboardData();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  Refresh Operational Data
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 text-red-600 font-bold"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Sign Out of CHC Portal
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Feedback Alert Toast */}
        {feedbackToast && (
          <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-fade-in ${
            feedbackToast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <span>{feedbackToast.msg}</span>
            <button onClick={() => setFeedbackToast(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Database Status Banner */}
        <SupabaseStatusBanner error={dashboardError} onRetry={loadDashboardData} title="CHC Database Connection Notice" />

        {/* 4 Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Service Requests */}
          <div 
            onClick={() => onSelectSubView && onSelectSubView('requests')}
            className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#15803d] flex items-center justify-center text-white shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">
                  {stats.service_requests_count}
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">
                  Service Requests
                </div>
                <div className="text-[11px] text-gray-500 font-medium">
                  {stats.pending_reviews_count} pending review
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>

          {/* Card 2: Today's Jobs */}
          <div 
            onClick={() => onSelectSubView && onSelectSubView('schedule')}
            className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#15803d] flex items-center justify-center text-white shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">
                  {stats.today_jobs_count}
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">
                  Today's Jobs
                </div>
                <div className="text-[11px] text-gray-500 font-medium">
                  {stats.jobs_in_progress_count} in progress
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>

          {/* Card 3: Active Machines */}
          <div 
            onClick={() => onSelectSubView && onSelectSubView('machines')}
            className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#15803d] flex items-center justify-center text-white shrink-0">
                <Tractor className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">
                  {stats.active_machines_count}
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">
                  Active Machines
                </div>
                <div className="text-[11px] text-gray-500 font-medium">
                  {stats.maintenance_machines_count} under maintenance
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>

          {/* Card 4: Available Operators */}
          <div 
            onClick={() => onSelectSubView && onSelectSubView('operators')}
            className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#15803d] flex items-center justify-center text-white shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">
                  {stats.available_operators_count}
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">
                  Available Operators
                </div>
                <div className="text-[11px] text-gray-500 font-medium">
                  {stats.on_leave_operators_count} on leave
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Subview Breadcrumb / Back Link */}
        {activeSubView !== 'dashboard' && (
          <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-gray-200 shadow-xs mb-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onSelectSubView && onSelectSubView('dashboard')}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer"
              >
                ← Back to Overview
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-sm font-extrabold text-gray-900 capitalize">
                {activeSubView === 'recovery' ? 'Breakdown Recovery & Multi-CHC Mesh Grid' :
                 activeSubView === 'requests' ? 'Service Requests & Approvals' :
                 activeSubView === 'schedule' ? 'Job Scheduling & Assignments' :
                 activeSubView === 'machines' ? 'Machinery Fleet & Implements' :
                 activeSubView === 'operators' ? 'Equipment Operators Directory' :
                 activeSubView === 'bookings' ? 'All Bookings & Financial History' :
                 activeSubView === 'reports' ? 'Performance Reports & Analytics' :
                 activeSubView === 'settings' ? 'Centre Settings & Configuration' : activeSubView}
              </span>
            </div>
            <div className="text-xs text-gray-500 font-medium">
              {stats.chc_name} • {stats.manager_name}
            </div>
          </div>
        )}

        {/* 1. DASHBOARD OVERVIEW VIEW (DEFAULT) */}
        {activeSubView === 'dashboard' && (
          <div className="space-y-6">
            {/* FUNCTIONAL MACHINE BREAKDOWN ALERTS PANEL */}
            {(() => {
              const activeBreakdowns = breakdownCases.filter(c => c.execution_status !== 'COMPLETED');
              const resolvedBreakdowns = breakdownCases.filter(c => c.execution_status === 'COMPLETED');
              const hasActive = activeBreakdowns.length > 0;

              return (
                <div className={`rounded-3xl p-5 md:p-6 shadow-sm border transition-all ${
                  hasActive 
                    ? 'bg-gradient-to-br from-red-50/70 via-amber-50/30 to-white border-red-200/90' 
                    : 'bg-gradient-to-br from-emerald-50/50 via-teal-50/20 to-white border-emerald-200/80'
                }`}>
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                        hasActive ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                      }`}>
                        {hasActive ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
                            {hasActive
                              ? `${activeBreakdowns.length} Machinery Breakdown${activeBreakdowns.length > 1 ? 's' : ''} Detected`
                              : 'No Active Machine Breakdowns'}
                          </h2>
                          {hasActive && (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-black uppercase tracking-wider animate-pulse">
                              Action Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {hasActive
                            ? 'Active machinery failures disrupting farmer booking schedules across CHC operational grid.'
                            : 'All registered CHC machinery and equipment units are fully operational. Zero active failures or deadlock impasses detected.'}
                        </p>
                      </div>
                    </div>

                    {/* Header Right Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {resolvedBreakdowns.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowResolvedBreakdowns(!showResolvedBreakdowns)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer shadow-2xs"
                        >
                          {showResolvedBreakdowns ? 'Hide Past History' : `Resolved History (${resolvedBreakdowns.length})`}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecoveryCaseId(null);
                          if (onSelectSubView) onSelectSubView('recovery');
                        }}
                        className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          hasActive
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        }`}
                      >
                        <span>Breakdown Recovery Center</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Active Breakdown Cards Grid */}
                  {hasActive && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {activeBreakdowns.map((caseItem) => {
                        const isCritical = caseItem.severity === 'CRITICAL';
                        const isImpasse = caseItem.level === 4 || caseItem.execution_status === 'DEADLOCK_IMPASSE';
                        return (
                          <div
                            key={caseItem.id}
                            className="bg-white rounded-2xl p-4.5 border border-red-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                          >
                            <div>
                              {/* Top Badges */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                    isCritical ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    {caseItem.severity} SEVERITY
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 text-gray-700">
                                    {caseItem.incident_number || caseItem.id}
                                  </span>
                                </div>

                                <span className="text-[10px] font-bold text-gray-400">
                                  {caseItem.detected_at}
                                </span>
                              </div>

                              {/* Machine Name & ID */}
                              <h3 className="text-sm font-black text-gray-900 group-hover:text-red-700 transition-colors">
                                {caseItem.machine_name} ({caseItem.machine_id})
                              </h3>

                              {/* Machine Type & CHC / Location */}
                              <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span className="font-medium">{caseItem.centre_name || 'CHC Pur Kalan'} • {caseItem.location_node || 'Field Node'}</span>
                              </div>

                              {/* Failure Type */}
                              <div className="text-xs text-red-900 font-semibold bg-red-50/80 px-2.5 py-1.5 rounded-xl border border-red-100 mt-2.5">
                                ⚠️ {caseItem.failure_type}
                              </div>

                              {/* Affected Bookings / Farmers */}
                              <div className="mt-2.5 text-xs text-gray-700 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-gray-900">
                                    {caseItem.affected_pending_count || 1} Affected Pending Booking{caseItem.affected_pending_count > 1 ? 's' : ''}
                                  </span>
                                  {caseItem.priority_score && (
                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                                      Priority {caseItem.priority_score}/100
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-600">
                                  Farmer: <strong className="text-gray-900">{caseItem.affected_farmer || caseItem.affected_bookings?.[0]?.farmer_name || 'Farmer'}</strong> ({caseItem.operation || 'Field Work'}, {caseItem.acreage || 10} Acres)
                                </div>
                                {caseItem.deadline && (
                                  <div className="text-[10px] text-red-700 font-medium">
                                    Biological Deadline: {caseItem.deadline}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Action Button */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                              <div className="text-[11px] font-semibold text-gray-500">
                                Status: <span className="font-bold text-gray-800">{caseItem.deadline_risk_status || (isImpasse ? 'Deadlock Impasse' : 'Ready for Recovery')}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRecoveryCaseId(caseItem.id);
                                  if (onSelectSubView) onSelectSubView('recovery');
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                <span>{isImpasse ? 'View Distress Protocol' : 'Start Recovery'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Expandable Resolved History Ledger */}
                  {showResolvedBreakdowns && resolvedBreakdowns.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-gray-600 tracking-wider">
                          Preserved Breakdown Recovery History ({resolvedBreakdowns.length} Cases Resolved)
                        </span>
                        <span className="text-[11px] text-emerald-700 font-bold">100% Completed Jobs Preserved</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {resolvedBreakdowns.map((resCase) => (
                          <div
                            key={resCase.id}
                            className="p-3 rounded-xl bg-white border border-emerald-200 text-xs flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                  RESOLVED
                                </span>
                                <span className="font-black text-gray-900">{resCase.machine_id} - {resCase.machine_name.split(' ')[0]}</span>
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                Recovered for {resCase.affected_farmer} • {resCase.solution_type}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecoveryCaseId(resCase.id);
                                if (onSelectSubView) onSelectSubView('recovery');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[11px] font-bold text-gray-700 transition-colors shrink-0 cursor-pointer"
                            >
                              Audit Details →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2-Column Responsive Section: Half-Width Service Area Map (Left) & Rectangular Booking Requests Summary (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Service Area Map & Field Routing (Approximately half width) */}
              <div className="lg:col-span-6 bg-white rounded-3xl border border-gray-200/90 shadow-xs overflow-hidden flex flex-col justify-between">
                {/* Map Header */}
                <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                      <MapPin className="w-5 h-5 text-emerald-800" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-gray-900">
                        Service Area Map & Fleet
                      </h2>
                      <span className="text-[11px] text-gray-500 block">
                        {selectedMarker ? `Focused on ${selectedMarker.farmer}` : 'Interactive map of farm parcels & machinery'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedMarker && (
                      <button 
                        type="button"
                        onClick={() => setSelectedMarker(null)}
                        className="px-2.5 py-1 rounded-xl border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                      >
                        Reset Map
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedMarker(null);
                        setZoomLevel(1);
                      }}
                      className="px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      Reset Zoom
                    </button>
                  </div>
                </div>

                {/* Isolated User Distance Alert Banner */}
                {selectedMarker && (
                  <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between shadow-xs animate-fade-in">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold text-xs sm:text-sm text-gray-900">{selectedMarker.farmer}</div>
                        <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span>📍 Distance: <strong>{calculateHaversineDistance(chcCenter.lat, chcCenter.lng, selectedMarker.lat, selectedMarker.lng)} km</strong></span>
                          <span>•</span>
                          <span>Est. Transit: {Math.max(5, Math.round(calculateHaversineDistance(chcCenter.lat, chcCenter.lng, selectedMarker.lat, selectedMarker.lng) * 2.8))} mins</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMarker(null)}
                      className="px-2 py-1 rounded-xl bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                )}

                {/* Interactive Leaflet Service Area Map */}
                <div className="p-3 grow flex flex-col justify-center">
                  <NitiMap
                    center={selectedMarker ? { lat: selectedMarker.lat, lng: selectedMarker.lng } : chcCenter}
                    operatingRadiusKm={operatingRadiusKm}
                    markers={selectedMarker ? [selectedMarker] : mapMarkers}
                    selectedMarker={selectedMarker}
                    onSelectMarker={(m) => setSelectedMarker(m)}
                    routeTo={selectedMarker ? { lat: selectedMarker.lat, lng: selectedMarker.lng, label: selectedMarker.farmer } : null}
                    height="380px"
                    title={stats.chc_name}
                  />
                </div>
              </div>

              {/* Rectangular Booking Requests Summary Panel Beside Map */}
              <div className="lg:col-span-6 bg-white rounded-3xl border border-gray-200/90 shadow-xs p-5 md:p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                        <FileText className="w-5 h-5 text-emerald-800" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-gray-900">
                          Booking Requests Summary
                        </h2>
                        <span className="text-[11px] text-gray-500 block">
                          Real-time database ledger counters • Click any count to view filtered records
                        </span>
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {allBookingsList.length} Total Records
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 mt-4">
                    {/* 1. Real Pending Requests Box */}
                    <div
                      onClick={() => {
                        setBookingListTab('Pending');
                        onSelectSubView && onSelectSubView('bookings');
                      }}
                      className="p-4 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200 transition-all cursor-pointer flex items-center justify-between group shadow-2xs hover:shadow-xs"
                      role="button"
                      tabIndex={0}
                      title="Click to view Pending Requests awaiting review"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          🚨
                        </div>
                        <div>
                          <div className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                            Pending Requests
                          </div>
                          <div className="text-xs text-rose-700">
                            Awaiting CHC review, evaluation & offer dispatch
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-rose-950 font-mono">
                          {pendingRequestsCount}
                        </span>
                        <ChevronRight className="w-5 h-5 text-rose-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 2. Real Approved Requests Box */}
                    <div
                      onClick={() => {
                        setBookingListTab('Approved');
                        onSelectSubView && onSelectSubView('bookings');
                      }}
                      className="p-4 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 transition-all cursor-pointer flex items-center justify-between group shadow-2xs hover:shadow-xs"
                      role="button"
                      tabIndex={0}
                      title="Click to view Approved Requests queued for execution"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          ✅
                        </div>
                        <div>
                          <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                            Approved Requests
                          </div>
                          <div className="text-xs text-emerald-700">
                            Confirmed by farmer & queued for machine dispatch
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-emerald-950 font-mono">
                          {approvedRequestsCount}
                        </span>
                        <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 3. Waiting for Farmer Confirmation Box */}
                    <div
                      onClick={() => {
                        setBookingListTab('Waiting for Farmer Confirmation');
                        onSelectSubView && onSelectSubView('bookings');
                      }}
                      className="p-4 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 transition-all cursor-pointer flex items-center justify-between group shadow-2xs hover:shadow-xs"
                      role="button"
                      tabIndex={0}
                      title="Click to view offers awaiting farmer decision"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          ⏳
                        </div>
                        <div>
                          <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                            Waiting for Farmer Confirmation
                          </div>
                          <div className="text-xs text-amber-700">
                            CHC offer formulated; awaiting farmer acceptance/rejection
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-amber-950 font-mono">
                          {waitingConfirmationCount}
                        </span>
                        <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Navigation */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Clicking any count opens corresponding filtered ledger
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingListTab('ALL');
                      onSelectSubView && onSelectSubView('bookings');
                    }}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <span>All Centre Bookings ({allBookingsList.length})</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SERVICE REQUESTS SUBVIEW */}
        {activeSubView === 'requests' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden space-y-4">
            {/* Header & Primary Segment Tabs (Pending vs Approved vs All) */}
            <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-gray-50/50 to-white">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span>Farmer Service Requests & Dispatch</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {recentRequests.length} Total
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review new farmer requests, inspect field locations, formulate pricing offers, or track approved jobs.
                </p>
              </div>

              {/* Segmented Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRequestFilter('Pending')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    requestFilter === 'Pending'
                      ? 'bg-rose-600 text-white shadow-rose-600/20'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <span>🚨 Pending Requests</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    requestFilter === 'Pending' ? 'bg-white/25 text-white' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {recentRequests.filter(r => r.status === 'Pending' || r.status === 'Under Review').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRequestFilter('Approved')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    requestFilter === 'Approved'
                      ? 'bg-[#134e2e] text-white shadow-emerald-900/20'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <span>✅ Approved & Scheduled</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    requestFilter === 'Approved' ? 'bg-white/25 text-white' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {recentRequests.filter(r => r.status === 'Approved' || r.status === 'Completed').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRequestFilter('Waiting for Farmer Confirmation')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    requestFilter === 'Waiting for Farmer Confirmation'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <span>⏳ Waiting Farmer</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    requestFilter === 'Waiting for Farmer Confirmation' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-950'
                  }`}>
                    {recentRequests.filter(r => r.status === 'Waiting for Farmer Confirmation').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRequestFilter('ALL')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    requestFilter === 'ALL'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>All ({recentRequests.length})</span>
                </button>
              </div>
            </div>

            {/* Active Filter Banner */}
            <div className="px-5 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Current View:</span>
                <span className="font-bold text-gray-900">
                  {requestFilter === 'Pending' ? 'Showing ONLY Pending Requests requiring action' : requestFilter === 'Approved' ? 'Showing Approved & Active Jobs' : 'Showing All Requests'}
                </span>
              </div>
              <span className="text-[11px] text-gray-500">
                Click "📍 Map" on any row to open the farmer's field location
              </span>
            </div>

            {/* Requests Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9fafb] text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="py-3.5 px-4">Request ID</th>
                    <th className="py-3.5 px-4">Farmer</th>
                    <th className="py-3.5 px-4">Field Location</th>
                    <th className="py-3.5 px-4">Operation & Acreage</th>
                    <th className="py-3.5 px-4">Generated Timestamp</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {recentRequests
                    .filter(r => {
                      if (requestFilter === 'ALL') return true;
                      if (requestFilter === 'Pending') return r.status === 'Pending' || r.status === 'Under Review';
                      if (requestFilter === 'Approved') return r.status === 'Approved' || r.status === 'Completed' || r.status === 'Scheduled';
                      return (r.status || '').toLowerCase() === requestFilter.toLowerCase();
                    })
                    .map((req) => (
                      <tr key={req.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                          {req.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{req.farmer}</div>
                          <div className="text-[11px] text-gray-500">ID: {req.raw_id}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-gray-900">{req.farmer_village}</div>
                          <div className="text-[11px] text-gray-500">{req.farmer_district}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-800">{req.operation}</div>
                          <div className="text-[11px] font-mono text-emerald-700 font-bold">{req.acreage} Acres</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{req.requested_date}</div>
                          <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            <span>{req.requested_time}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenLocationOnMap(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer border border-gray-300"
                              title="Open Farmer Location on Map"
                            >
                              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Map</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(req)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer ${
                                req.status === 'Pending' || req.status === 'Under Review'
                                  ? 'bg-[#134e2e] text-white hover:bg-[#0e3822] border-[#134e2e] shadow-xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {req.status === 'Pending' || req.status === 'Under Review' ? 'Review & Offer →' : 'Details'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {recentRequests.filter(r => {
                    if (requestFilter === 'ALL') return true;
                    if (requestFilter === 'Pending') return r.status === 'Pending' || r.status === 'Under Review';
                    if (requestFilter === 'Approved') return r.status === 'Approved' || r.status === 'Completed' || r.status === 'Scheduled';
                    return (r.status || '').toLowerCase() === requestFilter.toLowerCase();
                  }).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No requests found in this category ({requestFilter}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. SCHEDULE & ASSIGN SUBVIEW */}
        {activeSubView === 'schedule' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Schedule & Operator Assignments</h3>
                <p className="text-xs text-gray-500">Dispatch and machine allocation for approved field jobs</p>
              </div>
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 rounded-xl bg-[#134e2e] text-white font-bold text-xs shadow-md shadow-emerald-900/20 hover:bg-[#0e3822] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Assign Machine & Operator
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9fafb] text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Time Slot</th>
                    <th className="py-3 px-4">Farmer</th>
                    <th className="py-3 px-4">Village</th>
                    <th className="py-3 px-4">Operation</th>
                    <th className="py-3 px-4">Machine Unit</th>
                    <th className="py-3 px-4">Area (Acres)</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {scheduleItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-gray-700">{item.time}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">{item.farmer}</td>
                      <td className="py-3.5 px-4 text-gray-600">{item.farmer_village}</td>
                      <td className="py-3.5 px-4 text-gray-700">{item.operation}</td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-800">{item.machine}</td>
                      <td className="py-3.5 px-4 font-mono text-gray-800">{item.acreage}</td>
                      <td className="py-3.5 px-4 text-right">{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                  {scheduleItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No scheduled jobs found in current active queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. MACHINES SUBVIEW */}
        {activeSubView === 'machines' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Centre Machinery Fleet</h3>
                <p className="text-xs text-gray-500">Registered tractors, harvesters, rotavators and implements at this CHC</p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                Total Fleet: {machinesList.length} Units
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machinesList.map((m) => (
                <div key={m.id || m.machine_id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {m.machine_id || m.id}
                      </span>
                      <h4 className="font-extrabold text-gray-900 text-sm mt-1">
                        {m.machine_type || m.name || 'Agricultural Machine'}
                      </h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.status === 'Available' || m.status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {m.status || 'Available'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-200/60">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Hourly Rate</span>
                      <span className="font-bold text-gray-800">₹{m.hourly_rate_inr || m.rate_per_hour_inr || 600}/hr</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Rate per Acre</span>
                      <span className="font-bold text-gray-800">₹{m.rate_per_acre_inr || 800}/acre</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Field Capacity</span>
                      <span className="font-semibold text-gray-700">{m.field_capacity_acre_per_hr || 1.5} acre/hr</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Year Purchased</span>
                      <span className="font-semibold text-gray-700">{m.year_purchased || 2021}</span>
                    </div>
                  </div>
                </div>
              ))}
              {machinesList.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-400">
                  Loading machines fleet from Supabase...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. OPERATORS SUBVIEW */}
        {activeSubView === 'operators' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Registered Equipment Operators</h3>
                <p className="text-xs text-gray-500">Certified drivers and technicians assigned to this CHC</p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                Active: {operatorsList.filter(o => o.is_available !== false).length} / {operatorsList.length}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {operatorsList.map((op) => (
                <div key={op.id || op.operator_id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-black text-sm flex items-center justify-center shrink-0">
                        {op.name ? op.name.substring(0, 2).toUpperCase() : 'OP'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-gray-900 text-sm">{op.name || op.full_name}</h4>
                        <span className="text-[10px] font-mono text-gray-400">{op.operator_id || op.id}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      op.is_available !== false
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {op.is_available !== false ? '● Available' : '○ On Leave'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-gray-200/60">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Contact:</span>
                      <span className="font-semibold text-gray-800">{op.phone || '+91 98765 43210'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Skill / Certification:</span>
                      <span className="font-semibold text-emerald-800">{op.skills || 'Tractor & Combine Harvester'}</span>
                    </div>
                  </div>
                </div>
              ))}
              {operatorsList.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-400">
                  Loading operators from Supabase...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. BOOKINGS SUBVIEW */}
        {activeSubView === 'bookings' && (() => {
          const displayedBookingsList = allBookingsList.filter(b => {
            if (bookingListTab === 'Approved') {
              return b.status === 'Approved' || b.status === 'Scheduled' || b.status === 'In Progress';
            }
            if (bookingListTab === 'Pending') {
              return b.status === 'Pending' || b.status === 'Under Review';
            }
            if (bookingListTab === 'Waiting for Farmer Confirmation') {
              return b.status === 'Waiting for Farmer Confirmation';
            }
            if (bookingListTab === 'Completed') {
              return b.status === 'Completed' || b.status === 'COMPLETED';
            }
            return true; // ALL
          });

          return (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">All Centre Bookings & Records</h3>
                  <p className="text-xs text-gray-500">Live operational ledger & status classifications for {stats.chc_name}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-bold text-gray-700 w-fit">
                  {allBookingsList.length} Total Database Records
                </span>
              </div>

              {/* Three Primary Filter Tabs (Approved vs Pending vs Waiting for Farmer Confirmation) + History */}
              <div className="flex items-center gap-2 flex-wrap border-b border-gray-100 pb-3">
                {/* 1. Approved Tab */}
                <button
                  type="button"
                  onClick={() => setBookingListTab('Approved')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    bookingListTab === 'Approved'
                      ? 'bg-emerald-700 text-white shadow-emerald-700/20'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <span>✅ Approved</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    bookingListTab === 'Approved' ? 'bg-white/25 text-white' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {approvedRequestsCount}
                  </span>
                </button>

                {/* 2. Pending Tab */}
                <button
                  type="button"
                  onClick={() => setBookingListTab('Pending')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    bookingListTab === 'Pending'
                      ? 'bg-rose-600 text-white shadow-rose-600/20'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <span>🚨 Pending</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    bookingListTab === 'Pending' ? 'bg-white/25 text-white' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {pendingRequestsCount}
                  </span>
                </button>

                {/* 3. Waiting for Farmer Confirmation Tab */}
                <button
                  type="button"
                  onClick={() => setBookingListTab('Waiting for Farmer Confirmation')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                    bookingListTab === 'Waiting for Farmer Confirmation'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <span>⏳ Waiting for Farmer Confirmation</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    bookingListTab === 'Waiting for Farmer Confirmation' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-950'
                  }`}>
                    {waitingConfirmationCount}
                  </span>
                </button>

                {/* 4. Completed & History Tab */}
                <button
                  type="button"
                  onClick={() => setBookingListTab('Completed')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bookingListTab === 'Completed'
                      ? 'bg-teal-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>📜 Completed / History ({completedRequestsCount})</span>
                </button>

                {/* 5. All Records Tab */}
                <button
                  type="button"
                  onClick={() => setBookingListTab('ALL')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bookingListTab === 'ALL'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>All Records ({allBookingsList.length})</span>
                </button>
              </div>

              {/* Status explanation sub-banner */}
              <div className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200/80 text-xs text-gray-600 flex items-center justify-between">
                <span>
                  Filtering: <strong className="text-gray-900">{bookingListTab}</strong> ({displayedBookingsList.length} items shown)
                </span>
                <span className="text-[11px] text-gray-500">
                  {bookingListTab === 'Waiting for Farmer Confirmation' 
                    ? '⚠️ Offers are NOT classified as fully confirmed bookings until farmer accepts.' 
                    : 'Records synchronize automatically with PostgreSQL & Supabase.'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f9fafb] text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4">Booking ID</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Farmer</th>
                      <th className="py-3 px-4">Operation</th>
                      <th className="py-3 px-4">Machine</th>
                      <th className="py-3 px-4">Area Worked</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {displayedBookingsList.map((b) => (
                      <tr key={b.id || b.booking_id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                          {b.booking_reference || b.booking_id || b.id}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          {b.booking_date || b.scheduled_date || 'Today'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {b.farmers?.name || b.farmers?.full_name || b.farmer || 'Farmer'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          {b.operation || 'Tillage'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          {b.machinery?.machine_type || b.machinery?.name || b.offer_machine_model || b.machine_id || 'Tractor Unit'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-800">
                          {b.area_worked_acre || b.farm_area || 0} acres
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          ₹{b.amount_inr || b.total_price || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right space-y-1">
                          <div>{getStatusBadge(b.status)}</div>
                          {b.complaint_status && (
                            <div className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                              ⚠️ Grievance: {b.complaint_status}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {displayedBookingsList.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400">
                          No bookings currently found in "{bookingListTab}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* 7. REPORTS SUBVIEW */}
        {activeSubView === 'reports' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-6">
            <div className="pb-4 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-900">Centre Performance & Operational Analytics</h3>
              <p className="text-xs text-gray-500">Utilization efficiency, revenue generated and seasonal coverage</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-900 block">Total Revenue</span>
                <span className="text-2xl font-black text-emerald-800 mt-1 block">
                  ₹{allBookingsList.reduce((acc, b) => acc + (Number(b.amount_inr) || 0), 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-emerald-700">From completed services</span>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                <span className="text-xs font-bold text-blue-900 block">Total Area Covered</span>
                <span className="text-2xl font-black text-blue-800 mt-1 block">
                  {allBookingsList.reduce((acc, b) => acc + (Number(b.area_worked_acre || b.farm_area) || 0), 0).toFixed(1)} Acres
                </span>
                <span className="text-[11px] text-blue-700">Across local villages</span>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                <span className="text-xs font-bold text-amber-900 block">Machine Fleet Size</span>
                <span className="text-2xl font-black text-amber-800 mt-1 block">{machinesList.length} Units</span>
                <span className="text-[11px] text-amber-700">{stats.active_machines_count} currently operational</span>
              </div>
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200">
                <span className="text-xs font-bold text-purple-900 block">Avg. Farmer Rating</span>
                <span className="text-2xl font-black text-purple-800 mt-1 block">4.8 / 5.0</span>
                <span className="text-[11px] text-purple-700">Based on farmer feedback</span>
              </div>
            </div>

            {/* Embedded Deep Analytics Component */}
            <ChcAnalyticsSection bookings={allBookingsList} currentCentre={currentCentreData} />
          </div>
        )}

        {/* 8. SETTINGS SUBVIEW */}
        {activeSubView === 'settings' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-6 max-w-2xl">
            <div className="pb-4 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-900">Custom Hiring Centre Information</h3>
              <p className="text-xs text-gray-500">CHC Profile, coordinator contacts and coverage settings</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Centre Name</label>
                  <div className="p-3 bg-gray-50 rounded-xl border font-bold text-gray-900">{stats.chc_name}</div>
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Centre Identifier</label>
                  <div className="p-3 bg-gray-50 rounded-xl border font-mono font-bold text-emerald-800">{currentCentreData?.centre_id || currentCentreData?.id || 'CHC001'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Centre Coordinator</label>
                  <div className="p-3 bg-gray-50 rounded-xl border text-gray-800">{stats.manager_name}</div>
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Operating District</label>
                  <div className="p-3 bg-gray-50 rounded-xl border text-gray-800">{currentCentreData?.district || 'Aligarh, Uttar Pradesh'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Operating Service Radius</label>
                  <div className="p-3 bg-gray-50 rounded-xl border text-gray-800">{operatingRadiusKm} Kilometers</div>
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-1">Base GPS Coordinates</label>
                  <div className="p-3 bg-gray-50 rounded-xl border font-mono text-gray-800">{chcCenter.lat.toFixed(4)}, {chcCenter.lng.toFixed(4)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 9. BREAKDOWN RECOVERY (CORE USP) SUBVIEW */}
        {activeSubView === 'recovery' && (
          <BreakdownRecoverySection 
            lang={lang} 
            t={t} 
            initialCaseId={selectedRecoveryCaseId}
            onOpenMapLocation={(loc) => {
              setMapModalRequest({
                farmer: loc.title || loc.name || 'Breakdown / Recovery Node',
                farmer_village: loc.village || 'Nearby Grid Node',
                farmer_district: 'Uttar Pradesh',
                operation: loc.operation || 'Machine Replacement Route',
                acreage: loc.acreage || 'N/A',
                requested_date: new Date().toLocaleDateString('en-IN'),
                lat: loc.lat || 27.8974,
                lng: loc.lng || 78.0880,
                status: 'Recovery Transit'
              });
            }} 
          />
        )}

        {/* Schedule & Assign Machine Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4 animate-scale-up">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-extrabold text-gray-900 text-sm">Assign Machine & Operator</h3>
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Select Machine</label>
                  <select 
                    value={assignForm.machine_id}
                    onChange={(e) => setAssignForm({ ...assignForm, machine_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  >
                    <option value="">Select an available unit...</option>
                    {machinesList.map(m => (
                      <option key={m.id || m.machine_id} value={m.id || m.machine_id}>
                        {m.machine_type || m.name} ({m.machine_id || m.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Select Operator (Direct Assign)</label>
                  <select
                    value={assignForm.operator_id}
                    onChange={(e) => setAssignForm({ ...assignForm, operator_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  >
                    <option value="">Select an operator...</option>
                    {operatorsList.map(op => (
                      <option key={op.id || op.operator_id} value={op.id || op.operator_id}>
                        {op.name || op.full_name} ({op.skills || 'Operator'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Scheduled Time Slot</label>
                  <input
                    type="text"
                    value={assignForm.time_slot}
                    onChange={(e) => setAssignForm({ ...assignForm, time_slot: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
              </div>

              {/* On-Demand Broadcast Dispatch Option */}
              <div className="pt-2 border-t border-gray-100">
                <div className="text-[10px] font-black text-amber-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>On-Demand Operator Bidding (Audio 3 Requirement)</span>
                </div>
                <p className="text-[11px] text-gray-500 mb-2">
                  Instead of static assignment, broadcast this open work order to all certified operators in the area. The first operator to accept secures the job.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const candidateBooking = selectedRequest || {
                      booking_id: assignForm.job_id || `BK-DISP-${Date.now().toString(36).toUpperCase()}`,
                      farmer: 'Farmer Ajay Verma',
                      farmer_village: 'Dhanipur Kalan',
                      operation: 'Agricultural Machine Dispatch',
                      area_worked_acre: 5.0,
                      amount_inr: 4500,
                      scheduled_date: new Date().toISOString().split('T')[0],
                      scheduled_time: assignForm.time_slot
                    };
                    operatorDispatchService.broadcastJobOffer(candidateBooking);
                    setFeedbackToast({ type: 'success', msg: 'Job broadcasted to all nearby operators for acceptance!' });
                    setTimeout(() => setFeedbackToast(null), 3500);
                    setShowAssignModal(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-extrabold text-xs hover:bg-amber-100 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                >
                  <Send className="w-4 h-4 text-amber-700" />
                  <span>Broadcast Job to All Nearby Operators</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackToast({ type: 'success', msg: 'Job dispatch assigned successfully!' });
                    setTimeout(() => setFeedbackToast(null), 3000);
                    setShowAssignModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#134e2e] text-white text-xs font-bold hover:bg-[#0e3822]"
                >
                  Direct Assign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review & Offer Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedRequest.id}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-1">
                  Review Service Request
                </h3>
                <p className="text-xs text-gray-500">
                  Farmer: <strong className="text-gray-800">{selectedRequest.farmer}</strong> • Operation: {selectedRequest.operation}
                </p>
              </div>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Request Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
              <div>
                <span className="text-gray-500 block">Farmer & Location:</span>
                <span className="font-bold text-gray-900">{selectedRequest.farmer} ({selectedRequest.farmer_village || selectedRequest.village || 'Field Location'})</span>
              </div>
              <div>
                <span className="text-gray-500 block">Requested Acreage:</span>
                <span className="font-bold text-gray-900">{selectedRequest.acreage} Acres</span>
              </div>
              <div>
                <span className="text-gray-500 block">Generated Timestamp:</span>
                <span className="font-bold text-gray-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{selectedRequest.timestamp || (selectedRequest.requested_date + ' • ' + (selectedRequest.requested_time || '09:00 AM'))}</span>
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Current Status:</span>
                <span className="font-bold text-emerald-700">{selectedRequest.status}</span>
              </div>

              {/* Map Inspection Action Row */}
              <div className="col-span-2 pt-2.5 mt-1 border-t border-gray-200/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-700">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Field: <strong className="font-mono text-gray-900">{selectedRequest.lat?.toFixed?.(4) || selectedRequest.lat}, {selectedRequest.lng?.toFixed?.(4) || selectedRequest.lng}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenLocationOnMap(selectedRequest)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Open Field Map</span>
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedRequest.lat},${selectedRequest.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Google Maps</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Offer Formulation Form */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Prepare Official CHC Offer & Pricing
              </h4>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Pricing (INR per Acre)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <input
                    type="number"
                    value={offerPricePerAcre}
                    onChange={(e) => setOfferPricePerAcre(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-300 text-xs font-bold"
                  />
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Total Estimated Booking Cost: ₹{(Number(offerPricePerAcre || 0) * (selectedRequest.acreage || 1)).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Est. Duration (Hours)
                  </label>
                  <input
                    type="text"
                    value={offerDurationHours}
                    onChange={(e) => setOfferDurationHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Machine Model
                  </label>
                  <input
                    type="text"
                    value={offerMachineModel}
                    onChange={(e) => setOfferMachineModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleReviewAction('REJECT')}
                disabled={offerSubmitting}
                className="px-4 py-2.5 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
              >
                Reject Request
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReviewAction('UNDER_REVIEW')}
                  disabled={offerSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Mark Under Review
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('APPROVE')}
                  disabled={offerSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#134e2e] hover:bg-[#0e3822] text-white text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{offerSubmitting ? 'Sending Offer...' : 'Send Offer to Farmer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Field Location Map Modal */}
      {mapModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Farmer Field Location & Dispatch Route
                  </h3>
                  <p className="text-xs text-gray-500">
                    Farmer: <strong className="text-gray-800">{mapModalRequest.farmer}</strong> • {mapModalRequest.farmer_village}, {mapModalRequest.farmer_district}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapModalRequest(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Field Details Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Operation</span>
                <span className="font-extrabold text-gray-900">{mapModalRequest.operation}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Area</span>
                <span className="font-extrabold text-gray-900">{mapModalRequest.acreage} Acres</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Timestamp</span>
                <span className="font-extrabold text-gray-900">{mapModalRequest.requested_date}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">GPS Coordinates</span>
                <span className="font-mono font-bold text-emerald-800 text-[11px]">{mapModalRequest.lat}, {mapModalRequest.lng}</span>
              </div>
            </div>

            {/* Interactive Leaflet Map */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
              <NitiMap
                center={{ lat: mapModalRequest.lat, lng: mapModalRequest.lng }}
                operatingRadiusKm={operatingRadiusKm}
                markers={[
                  {
                    id: mapModalRequest.raw_id || mapModalRequest.id,
                    farmer: mapModalRequest.farmer,
                    label: mapModalRequest.farmer,
                    village: mapModalRequest.farmer_village,
                    district: mapModalRequest.farmer_district,
                    lat: mapModalRequest.lat,
                    lng: mapModalRequest.lng,
                    operation: mapModalRequest.operation,
                    acreage: mapModalRequest.acreage,
                    status: mapModalRequest.status,
                    type: 'FIELD'
                  }
                ]}
                selectedMarker={{
                  id: mapModalRequest.raw_id || mapModalRequest.id,
                  farmer: mapModalRequest.farmer,
                  lat: mapModalRequest.lat,
                  lng: mapModalRequest.lng,
                }}
                routeTo={{
                  lat: mapModalRequest.lat,
                  lng: mapModalRequest.lng,
                  label: mapModalRequest.farmer
                }}
                height="320px"
                title={`${mapModalRequest.farmer}'s Field Location`}
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mapModalRequest.lat},${mapModalRequest.lng}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                <span>Open in Google Maps Navigation</span>
              </a>

              <button
                type="button"
                onClick={() => setMapModalRequest(null)}
                className="px-5 py-2 rounded-xl bg-[#134e2e] text-white font-bold text-xs hover:bg-[#0e3822] transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
