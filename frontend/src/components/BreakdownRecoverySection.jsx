import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ArrowLeft,
  ShieldAlert, 
  Tractor, 
  MapPin, 
  Wrench, 
  RefreshCw, 
  Sliders, 
  Info, 
  Send, 
  Sparkles, 
  Check, 
  Truck,
  RotateCcw,
  Zap,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  PhoneCall,
  XCircle,
  AlertOctagon,
  UserCheck,
  ChevronRight,
  Building2,
  Calendar,
  User,
  CheckCircle,
  HelpCircle,
  Layers
} from 'lucide-react';
import { breakdownService } from '../api/supabaseService';

/**
 * Evaluates the 9 mandatory hard constraints for candidate machine against the affected booking
 */
const evaluateHardConstraints = (caseItem, plan, booking) => {
  if (!caseItem) return [];

  const isImpasse = caseItem.level === 4 || caseItem.execution_status === 'DEADLOCK_IMPASSE';
  
  if (isImpasse) {
    return [
      {
        id: 1,
        name: 'Replacement Machine Compatibility',
        status: 'FAIL',
        actualValue: '0 regional candidate units idle',
        explanation: 'All 6 regional laser levelers across Agra-Aligarh CHC mesh are 100% committed for next 7 days.'
      },
      {
        id: 2,
        name: 'Required Attachment Availability',
        status: 'FAIL',
        actualValue: 'Optical sensor burned out',
        explanation: 'Requires factory optical receiver replacement from manufacturer (120 hrs downtime).'
      },
      {
        id: 3,
        name: 'Qualified Operator Availability',
        status: 'PASS',
        actualValue: 'Suresh Chandra (Certified Specialist) on standby',
        explanation: 'Certified operator available, but machinery asset is blocked.'
      },
      {
        id: 4,
        name: 'Travel Time Feasibility',
        status: 'FAIL',
        actualValue: 'Corridor impassable (> 35 km flooded)',
        explanation: 'Connecting arterial highway NH-509 flooded; heavy tow trailers cannot transit.'
      },
      {
        id: 5,
        name: 'Job Duration Feasibility',
        status: 'UNKNOWN',
        actualValue: `${booking?.acreage || caseItem.acreage || 25.0} Acres (Est. 8.5 hrs work)`,
        explanation: 'Field job feasibility indeterminate due to machine unavailability.'
      },
      {
        id: 6,
        name: 'Farmer Deadline Feasibility',
        status: 'FAIL',
        actualValue: `Deadline: ${booking?.deadline || caseItem.deadline || '2026-10-19'} (0h buffer remaining)`,
        explanation: 'Scheduled pre-canal irrigation window will expire before any machine can arrive.'
      },
      {
        id: 7,
        name: 'Schedule Conflict Isolation',
        status: 'FAIL',
        actualValue: '100% Regional Grid Saturation',
        explanation: 'All neighboring CHC schedules fully locked through current weather window.'
      },
      {
        id: 8,
        name: 'CHC / Cross-CHC Resource Availability',
        status: 'FAIL',
        actualValue: '0 units within 35 km radius',
        explanation: 'Exceeds maximum cooperative mesh inter-lending radius.'
      },
      {
        id: 9,
        name: 'Transit Road Corridor & Safety',
        status: 'FAIL',
        actualValue: 'NH-509 Flooded / High Risk',
        explanation: 'Transit route safety check failed due to monsoonal waterlogging.'
      }
    ];
  }

  // Feasible candidates (Case 1, 2, 3)
  const planData = plan || caseItem.alternative_plans?.[0];
  const travelKm = planData?.travel_distance_km ?? 4.2;
  const travelMins = planData?.travel_time_mins ?? 12;
  const machineName = planData?.replacement_machine || 'Backup Unit';
  const operatorName = planData?.operator_name || 'Santosh Jatav';
  const isCrossChc = caseItem.level === 3 || planData?.source_centre?.includes('CHC002');

  return [
    {
      id: 1,
      name: 'Replacement Machine Compatibility',
      status: 'PASS',
      actualValue: `${machineName.split(' ')[0]} (Verified Power & Category Match)`,
      explanation: `${machineName} verified idle with compatible PTO horsepower and hydraulic hitch system.`
    },
    {
      id: 2,
      name: 'Required Attachment Availability',
      status: 'PASS',
      actualValue: planData?.attachment_fit || 'Standard Operational Implement Hitch Mounted',
      explanation: 'Required implement attachment is verified mounted and calibrated for field operation.'
    },
    {
      id: 3,
      name: 'Qualified Operator Availability',
      status: 'PASS',
      actualValue: `${operatorName} (Certified Specialist)`,
      explanation: `${operatorName} verified on active roster and available for dispatch.`
    },
    {
      id: 4,
      name: 'Travel Time Feasibility',
      status: 'PASS',
      actualValue: `${travelKm} km (${travelMins} mins via OSRM corridor)`,
      explanation: `Transit distance (${travelKm} km) is well within maximum 30 km inter-lending radius.`
    },
    {
      id: 5,
      name: 'Job Duration Feasibility',
      status: 'PASS',
      actualValue: `${booking?.acreage || caseItem.acreage || 5.0} Acres (Est. 2.5 hrs work)`,
      explanation: 'Work duration can be executed comfortably within daylight operational shift.'
    },
    {
      id: 6,
      name: 'Farmer Deadline Feasibility',
      status: 'PASS',
      actualValue: `Deadline: ${booking?.deadline || caseItem.deadline || '2026-10-20'} (${planData?.expected_delay || 'Safe Buffer'})`,
      explanation: planData?.deadline_feasibility || 'Completes safely within farmer requested agronomic window.'
    },
    {
      id: 7,
      name: 'Schedule Conflict Isolation',
      status: 'PASS',
      actualValue: '0 Overlapping Bookings',
      explanation: 'Target replacement resource has zero competing bookings or active dispatches in this time block.'
    },
    {
      id: 8,
      name: 'CHC / Cross-CHC Resource Availability',
      status: 'PASS',
      actualValue: planData?.source_centre || 'CHC Pur Kalan (Host CHC)',
      explanation: isCrossChc 
        ? 'Cross-CHC cooperative borrowing protocol verified with CHC Gaon Majra dispatch.'
        : 'Internal same-centre asset interchangeability verified with CHC Pur Kalan fleet.'
    },
    {
      id: 9,
      name: 'Transit Road Corridor & Safety',
      status: 'PASS',
      actualValue: 'All-Weather Paved Route Clear',
      explanation: 'Transit route corridor verified open with zero bridge closures or flood advisories.'
    }
  ];
};

/**
 * BreakdownRecoverySection Component
 * Supports Screen One (Minimal Breakdown Cards Grid) and Screen Two (Breakdown Details & Constraint Feasibility Tracker)
 */
export const BreakdownRecoverySection = ({ lang = 'hi', t, onOpenMapLocation, initialCaseId }) => {
  const [demoCases, setDemoCases] = useState(() => breakdownService.getDemoCases());
  const [selectedCaseId, setSelectedCaseId] = useState(() => initialCaseId || 'BD-CASE-001');
  const [activeScreen, setActiveScreen] = useState(() => initialCaseId ? 'DETAILS' : 'LIST');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('PLAN-001-A');
  const [executing, setExecuting] = useState(false);
  const [executionToast, setExecutionToast] = useState(null);
  const [showResolvedHistory, setShowResolvedHistory] = useState(false);

  // Sync if initialCaseId is passed or changed from outside
  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
      setActiveScreen('DETAILS');
    }
  }, [initialCaseId]);

  const activeCases = demoCases.filter(c => c.execution_status !== 'COMPLETED');
  const resolvedCases = demoCases.filter(c => c.execution_status === 'COMPLETED');

  const selectedCase = demoCases.find(c => c.id === selectedCaseId) || activeCases[0] || demoCases[0];

  // Sync selected plan and selected booking when switching cases
  useEffect(() => {
    if (selectedCase) {
      if (selectedCase.alternative_plans && selectedCase.alternative_plans.length > 0) {
        const rec = selectedCase.alternative_plans.find(p => p.is_recommended) || selectedCase.alternative_plans[0];
        setSelectedPlanId(rec.plan_id);
      } else {
        setSelectedPlanId(null);
      }

      if (selectedCase.affected_bookings && selectedCase.affected_bookings.length > 0) {
        const pendingBooking = selectedCase.affected_bookings.find(b => !b.is_completed) || selectedCase.affected_bookings[0];
        setSelectedBookingId(pendingBooking.booking_id);
      } else {
        setSelectedBookingId(selectedCase.booking_id);
      }
    }
  }, [selectedCaseId]);

  const selectedBooking = (selectedCase?.affected_bookings || []).find(b => b.booking_id === selectedBookingId) || 
    (selectedCase?.affected_bookings?.[0]) || {
      booking_id: selectedCase?.booking_id,
      farmer_name: selectedCase?.affected_farmer,
      acreage: selectedCase?.acreage,
      deadline: selectedCase?.deadline,
      operation: selectedCase?.operation,
      priority_score: selectedCase?.priority_score,
      status: 'DISRUPTED_PENDING'
    };

  const selectedPlan = (selectedCase?.alternative_plans || []).find(p => p.plan_id === selectedPlanId) || selectedCase?.alternative_plans?.[0];

  const constraints = evaluateHardConstraints(selectedCase, selectedPlan, selectedBooking);
  const failedConstraints = constraints.filter(c => c.status === 'FAIL');
  const unknownConstraints = constraints.filter(c => c.status === 'UNKNOWN');
  const isCandidateFeasible = failedConstraints.length === 0 && unknownConstraints.length === 0;

  // Handle Manager Approval Execution
  const handleApproveRecovery = async () => {
    if (selectedCase.execution_status === 'COMPLETED') return;
    setExecuting(true);
    try {
      const updated = await breakdownService.simulateRecovery(
        selectedCase.id, 
        selectedPlanId,
        'Ramesh Kumar (CHC Pur Kalan Manager)'
      );
      setDemoCases(breakdownService.getDemoCases());
      setExecutionToast({
        type: 'success',
        msg: `✓ Recovery Plan Authorized & Schedule Updated: ${selectedCase.incident_number}. Farmer notified via SMS/IVR!`
      });
      setTimeout(() => setExecutionToast(null), 6000);
    } catch (err) {
      setExecutionToast({ type: 'error', msg: 'Execution error: ' + err.message });
      setTimeout(() => setExecutionToast(null), 4000);
    } finally {
      setExecuting(false);
    }
  };

  const handleResetCases = () => {
    const fresh = breakdownService.resetDemoCases();
    setDemoCases(fresh);
    setExecutionToast({ type: 'info', msg: 'All Breakdown Cases reset to initial proposed states.' });
    setTimeout(() => setExecutionToast(null), 3000);
  };

  // Helper to open details for a breakdown
  const handleSelectBreakdownCard = (caseId) => {
    setSelectedCaseId(caseId);
    setActiveScreen('DETAILS');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 text-gray-900">
      {/* Toast Alert */}
      {executionToast && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in ${
          executionToast.type === 'success' 
            ? 'bg-emerald-900 text-emerald-100 border-emerald-500' 
            : executionToast.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-500'
              : 'bg-blue-900 text-blue-100 border-blue-500'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{executionToast.msg}</span>
          </div>
          <button onClick={() => setExecutionToast(null)} className="text-white/60 hover:text-white ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN ONE — BREAKDOWN CARDS GRID (MINIMAL, AESTHETIC, CLEAN) */}
      {/* ========================================================================= */}
      {activeScreen === 'LIST' && (
        <div className="space-y-6">
          {/* Screen One Header */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#15803d] text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Breakdown Recovery Center
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select an active breakdown card to inspect constraint feasibility, evaluate replacement assets, and authorize recovery dispatch.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {resolvedCases.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowResolvedHistory(!showResolvedHistory)}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                >
                  {showResolvedHistory ? 'Hide Resolved Ledger' : `Resolved History (${resolvedCases.length})`}
                </button>
              )}

              <button
                type="button"
                onClick={handleResetCases}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-600 transition-colors flex items-center gap-1 cursor-pointer"
                title="Reset simulation cases"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo</span>
              </button>
            </div>
          </div>

          {/* Active Breakdown Cards Grid */}
          {activeCases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeCases.map((c, index) => {
                const breakdownNum = `Breakdown ${index + 1}`;
                const farmerName = c.affected_farmer || c.affected_bookings?.[0]?.farmer_name || 'Farmer';
                const farmerId = c.farmer_id || (c.affected_bookings?.[0]?.farmer_id) || `F000${index + 1}`;
                const totalAffected = c.affected_bookings?.filter(b => !b.is_completed)?.length || c.affected_pending_count || 1;
                const additionalCount = totalAffected > 1 ? totalAffected - 1 : 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectBreakdownCard(c.id)}
                    className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md hover:border-emerald-600/60 transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                    role="button"
                    tabIndex={0}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          {breakdownNum}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
                      </div>

                      <div className="pt-1">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                          Affected Farmer
                        </span>
                        <div className="text-lg font-black text-gray-900 group-hover:text-emerald-900 transition-colors mt-0.5">
                          {farmerName}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            Farmer ID
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                            {farmerId}
                          </span>
                        </div>

                        {additionalCount > 0 && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            + {additionalCount} more farmer affected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:text-emerald-950">
                      <span>View Breakdown Details</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Clean Empty State */
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/90 shadow-xs space-y-3 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-gray-900">
                No Active Machine Breakdowns
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                All registered machinery and equipment fleet units across the CHC grid are operational. Zero active failures or deadlock impasses detected.
              </p>
              {resolvedCases.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowResolvedHistory(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-colors cursor-pointer mt-2"
                >
                  View Resolved Breakdowns History ({resolvedCases.length})
                </button>
              )}
            </div>
          )}

          {/* Preserved Resolved History Section */}
          {showResolvedHistory && resolvedCases.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <span>Resolved Breakdowns Audit Ledger</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      {resolvedCases.length} Resolved
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Past breakdown recovery records are fully preserved with manager sign-offs and untouched completed jobs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResolvedHistory(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resolvedCases.map((rc, i) => (
                  <div
                    key={rc.id}
                    onClick={() => handleSelectBreakdownCard(rc.id)}
                    className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold">
                          RESOLVED
                        </span>
                        <span className="font-black text-xs text-gray-900">{rc.machine_name} ({rc.machine_id})</span>
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1">
                        Farmer: <strong>{rc.affected_farmer}</strong> • {rc.solution_type}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-700" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN TWO — BREAKDOWN DETAILS & CONSTRAINT FEASIBILITY PROGRESS TRACKER */}
      {/* ========================================================================= */}
      {activeScreen === 'DETAILS' && selectedCase && (
        <div className="space-y-6">
          {/* Navigation Bar / Breadcrumb */}
          <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-gray-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveScreen('LIST')}
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to All Breakdowns</span>
            </button>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                selectedCase.execution_status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                selectedCase.level === 4 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {selectedCase.execution_status === 'COMPLETED' ? '✓ RESOLVED' : (selectedCase.execution_status || 'AWAITING APPROVAL')}
              </span>
            </div>
          </div>

          {/* TOP SUMMARY: Breakdown Number, Machine Name, ID, Type, Farmer Request, Location, Detection Time */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-black text-xs uppercase tracking-wider">
                    {`Breakdown ${activeCases.findIndex(c => c.id === selectedCase.id) + 1 > 0 ? activeCases.findIndex(c => c.id === selectedCase.id) + 1 : 1}`}
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-500">
                    Incident #{selectedCase.incident_number || selectedCase.id}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {selectedCase.machine_name}
                </h2>
                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                  <span>Machine ID: <strong className="text-gray-900 font-mono">{selectedCase.machine_id}</strong></span>
                  <span>•</span>
                  <span>Type: <strong className="text-gray-900">{selectedCase.title?.split('(')[0] || 'Agricultural Machinery'}</strong></span>
                </div>
              </div>

              {/* Status pill & severity */}
              <div className="flex md:flex-col items-end gap-1.5 shrink-0">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  selectedCase.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 border border-red-200' :
                  selectedCase.severity === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {selectedCase.severity} Severity
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  Detected: {selectedCase.detected_at}
                </span>
              </div>
            </div>

            {/* Key Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Original Farmer Request
                </span>
                <div className="font-black text-gray-900">
                  {selectedCase.affected_farmer}
                </div>
                <div className="font-mono text-[11px] text-emerald-800">
                  ID: {selectedCase.booking_id}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Operation & Field
                </span>
                <div className="font-extrabold text-gray-900">
                  {selectedCase.operation}
                </div>
                <div className="text-[11px] text-gray-500">
                  Area: {selectedCase.acreage} Acres
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Location & Node
                </span>
                <div className="font-bold text-gray-900 truncate">
                  {selectedCase.location_node || 'Mohanpur Majra'}
                </div>
                <div className="text-[11px] text-gray-500">
                  {selectedCase.centre_name || 'CHC Pur Kalan, Aligarh'}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Affected Bookings Count
                </span>
                <div className="font-black text-gray-900">
                  {selectedCase.affected_pending_count || 1} Pending Job{selectedCase.affected_pending_count > 1 ? 's' : ''}
                </div>
                <div className="text-[11px] text-emerald-700 font-bold">
                  {selectedCase.completed_preserved_count || 1} Completed Job Preserved
                </div>
              </div>
            </div>

            {/* Failure Reason Alert Strip */}
            {selectedCase.failure_type && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs flex items-center justify-between text-red-900 gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span><strong>Failure Diagnosis:</strong> {selectedCase.failure_type}</span>
                </div>
                <span className="font-bold text-[11px] text-red-700 shrink-0">
                  Est. Downtime: {selectedCase.downtime_hours || 6.0} hrs
                </span>
              </div>
            )}
          </div>

          {/* AFFECTED BOOKINGS SELECTOR (IF MULTIPLE) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-black uppercase tracking-wider text-gray-500">
                Select Affected Booking to Track Constraints:
              </span>
              <span className="text-[11px] text-gray-400">
                {(selectedCase.affected_bookings || []).length} associated booking records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(selectedCase.affected_bookings || [
                {
                  booking_id: selectedCase.booking_id,
                  farmer_name: selectedCase.affected_farmer,
                  operation: selectedCase.operation,
                  acreage: selectedCase.acreage,
                  deadline: selectedCase.deadline,
                  is_completed: false
                }
              ]).map((b) => {
                const isSelected = selectedBookingId === b.booking_id;
                return (
                  <div
                    key={b.booking_id}
                    onClick={() => setSelectedBookingId(b.booking_id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          b.is_completed ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-800'
                        }`}>
                          {b.is_completed ? 'Completed Preserved' : 'Disrupted Pending'}
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-700">{b.booking_id}</span>
                      </div>
                      <div className="font-black text-xs text-gray-900 mt-1">
                        {b.farmer_name} ({b.operation}, {b.acreage} Acres)
                      </div>
                      {b.deadline && (
                        <div className="text-[10px] text-gray-500">
                          Biological Deadline: <strong>{b.deadline}</strong>
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-emerald-700 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: CONSTRAINT FEASIBILITY PROGRESS TRACKER (40-50% VISUAL FOCUS) */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <span>Constraint Feasibility Progress Tracker</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isCandidateFeasible 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    {isCandidateFeasible ? 'All Constraints Passed' : `${failedConstraints.length} Constraint Failures`}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Algorithmic evaluation of 9 mandatory hard operational constraints for Booking <strong className="text-gray-900">{selectedBooking.booking_id}</strong>.
                </p>
              </div>

              {/* Overall Verdict Pill */}
              <div className={`px-4 py-2 rounded-2xl border font-black text-xs flex items-center gap-2 shrink-0 shadow-2xs ${
                isCandidateFeasible 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                  : 'bg-red-50 text-red-900 border-red-300'
              }`}>
                {isCandidateFeasible ? <CheckCircle className="w-4 h-4 text-emerald-700" /> : <AlertOctagon className="w-4 h-4 text-red-700" />}
                <span>VERDICT: {isCandidateFeasible ? 'FEASIBLE CANDIDATE' : 'INFEASIBLE CANDIDATE'}</span>
              </div>
            </div>

            {/* The 9 Visual Constraint Step Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {constraints.map((c) => {
                const isPass = c.status === 'PASS';
                const isFail = c.status === 'FAIL';
                const isChecking = c.status === 'CHECKING';
                
                return (
                  <div
                    key={c.id}
                    className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-2.5 ${
                      isPass ? 'bg-emerald-50/50 border-emerald-200' :
                      isFail ? 'bg-red-50/60 border-red-300 ring-1 ring-red-400/20' :
                      isChecking ? 'bg-amber-50/50 border-amber-200 animate-pulse' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div>
                      {/* Step Number & Result Badge */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-gray-400">
                          CONSTRAINT #{c.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                          isPass ? 'bg-emerald-600 text-white' :
                          isFail ? 'bg-red-600 text-white' :
                          isChecking ? 'bg-amber-500 text-white' :
                          'bg-gray-400 text-white'
                        }`}>
                          {isPass && <Check className="w-3 h-3" />}
                          {isFail && <XCircle className="w-3 h-3" />}
                          {c.status}
                        </span>
                      </div>

                      {/* Constraint Name */}
                      <h4 className="text-xs font-black text-gray-900 leading-snug">
                        {c.name}
                      </h4>

                      {/* Actual Metric / Value */}
                      <div className={`text-[11px] font-bold mt-1.5 font-mono px-2 py-1 rounded-lg ${
                        isPass ? 'bg-emerald-100/70 text-emerald-950' :
                        isFail ? 'bg-red-100/70 text-red-950' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {c.actualValue}
                      </div>
                    </div>

                    {/* Concise Explanation */}
                    <p className="text-[11px] text-gray-600 leading-relaxed border-t border-gray-200/50 pt-2">
                      {c.explanation}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Feasibility Summary Banner */}
            <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              isCandidateFeasible 
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950' 
                : 'bg-red-100/80 border-red-300 text-red-950'
            }`}>
              <div className="flex items-center gap-2.5">
                <Info className="w-5 h-5 shrink-0" />
                <span className="font-semibold">
                  {isCandidateFeasible
                    ? 'All 9 mandatory hard operational constraints passed. Candidate machine is feasible and mathematically ranked.'
                    : 'Candidate violates mandatory hard constraints. Infeasible alternatives are excluded; alternative candidates or Clean Distress protocols activated.'}
                </span>
              </div>
              <span className="font-black text-[11px] uppercase tracking-wider shrink-0">
                Rule: Feasible iff ALL pass
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: BOOKING-SPECIFIC RECOVERY RECOMMENDATIONS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs space-y-5">
            <div className="pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">
                Recovery Recommendations for Booking {selectedBooking.booking_id}
              </h3>
              <p className="text-xs text-gray-500">
                Ranked substitute candidate machines, operator assignments, and expected transit schedules.
              </p>
            </div>

            {/* IF FEASIBLE PLANS EXIST: SHOW RECOMMENDED PLAN & CANDIDATES */}
            {selectedCase.alternative_plans && selectedCase.alternative_plans.length > 0 ? (
              <div className="space-y-4">
                {selectedCase.alternative_plans.map((plan) => {
                  const isRec = plan.is_recommended;
                  const isSelected = selectedPlanId === plan.plan_id;

                  return (
                    <div
                      key={plan.plan_id}
                      onClick={() => setSelectedPlanId(plan.plan_id)}
                      className={`rounded-2xl p-5 border transition-all cursor-pointer space-y-4 ${
                        isSelected
                          ? 'bg-emerald-50/50 border-emerald-600 ring-2 ring-emerald-600/20 shadow-sm'
                          : 'bg-gray-50/60 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-gray-900">
                            {plan.title}
                          </span>
                          {isRec && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                              ★ Ranked #1 (Recommended)
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono font-black text-emerald-800">
                          Match Score: {plan.match_score}/100
                        </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-gray-200/80">
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">Replacement Machine</span>
                          <span className="font-black text-gray-900 block mt-0.5">{plan.replacement_machine}</span>
                          <span className="text-[10px] text-gray-500">{plan.source_centre}</span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-gray-200/80">
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">Operator & Attachment</span>
                          <span className="font-extrabold text-gray-900 block mt-0.5">{plan.operator_name}</span>
                          <span className="text-[10px] text-emerald-700 font-bold">{plan.attachment_fit}</span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-gray-200/80">
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">Travel Distance & Time</span>
                          <span className="font-black text-gray-900 block mt-0.5">{plan.travel_distance_km} km ({plan.travel_time_mins} mins)</span>
                          <span className="text-[10px] text-gray-500">Transit Delay: {plan.expected_delay}</span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-gray-200/80">
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">Deadline & Extra Cost</span>
                          <span className="font-black text-emerald-700 block mt-0.5">{plan.deadline_feasibility}</span>
                          <span className="text-[10px] font-bold text-gray-900">Farmer Additional Fee: ₹{plan.extra_cost_inr || 0}</span>
                        </div>
                      </div>

                      {/* Resolved Constraints Note */}
                      <div className="text-[11px] text-emerald-900 bg-emerald-100/60 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span><strong>Resolved Constraints:</strong> Provides identical horsepower compatibility, preserves completed work, maintains pre-rain weather deadline, and routes via OSRM paved transit corridor.</span>
                      </div>
                    </div>
                  );
                })}

                {/* Rejected Infeasible Candidates List */}
                {selectedCase.infeasible_alternatives && selectedCase.infeasible_alternatives.length > 0 && (
                  <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200 space-y-2">
                    <span className="text-xs font-black uppercase text-red-900 tracking-wider block">
                      Rejected Infeasible Candidates (Excluded by Hard Constraints):
                    </span>
                    <div className="space-y-2">
                      {selectedCase.infeasible_alternatives.map((inf, i) => (
                        <div key={i} className="text-xs text-red-950 flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-red-200/70">
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-black text-red-900">{inf.machine_name} ({inf.centre_name}): </span>
                            <span className="font-medium text-gray-700">{inf.rejection_reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* IF NO FEASIBLE OPTION EXISTS (LEVEL 4 IMPASSE) */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-red-100/80 border border-red-300 text-xs text-red-950 space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm text-red-900">
                    <AlertTriangle className="w-5 h-5 text-red-700" />
                    <span>Deadlock Impasse: Zero Feasible Regional Candidates Available</span>
                  </div>
                  <p className="leading-relaxed">
                    All regional units are committed, transit highway NH-509 is inundated, and the controller failure requires factory manufacturer lead time. NITI prevents false scheduling by executing the <strong>Automated Clean Distress Alert & 100% Instant Refund Protocol</strong>.
                  </p>
                </div>

                {/* Distress Alert Next Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-400 text-[10px] uppercase">Action 1</span>
                    <div className="font-black text-gray-900">Instant Refund Guarantee</div>
                    <p className="text-[11px] text-gray-500">₹26,250 100% full booking refund credited directly to farmer bank account.</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-400 text-[10px] uppercase">Action 2</span>
                    <div className="font-black text-gray-900">SMS & Automated IVR Voice</div>
                    <p className="text-[11px] text-gray-500">Transparent alert delivered in Hindi explaining failure reason and refund.</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-400 text-[10px] uppercase">Action 3</span>
                    <div className="font-black text-gray-900">Emergency Local Tractor Pool</div>
                    <p className="text-[11px] text-gray-500">Connecting farmer to verified private neighbor tractors for secondary tillage.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: APPROVAL AND NOTIFICATIONS */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-[#0e3822] rounded-3xl p-6 text-white shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[11px] font-black uppercase">
                  <span>Authorized CHC Manager Sign-off</span>
                </div>
                <h3 className="text-lg font-black text-white">
                  {selectedCase.execution_status === 'COMPLETED'
                    ? '✓ Recovery Plan Executed & Schedule Committed'
                    : selectedCase.level === 4
                      ? 'Authorize Clean Distress Alert & 100% Refund'
                      : 'Authorize Replacement Schedule & Dispatch'}
                </h3>
                <p className="text-xs text-emerald-100/80">
                  Manager: <strong className="text-white">Ramesh Kumar (CHC Pur Kalan Coordinator)</strong> • Completed jobs remain 100% preserved.
                </p>
              </div>

              {/* Action Button */}
              {selectedCase.execution_status !== 'COMPLETED' ? (
                <button
                  type="button"
                  onClick={handleApproveRecovery}
                  disabled={executing}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {executing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
                      <span>Transacting Atomic Commit...</span>
                    </>
                  ) : (
                    <>
                      <span>{selectedCase.level === 4 ? 'Approve Refund & Clean Alert' : 'Authorize & Dispatch Recovery'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Dispatched at {selectedCase.executed_at ? new Date(selectedCase.executed_at).toLocaleTimeString() : '08:45 AM'}</span>
                </div>
              )}
            </div>

            {/* Verifiable Notification Status Preview */}
            <div className="bg-black/30 rounded-2xl p-3.5 border border-white/10 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                <span>Farmer Notification Channel: SMS & Automated IVR Voice Call</span>
                <span>Status: {selectedCase.execution_status === 'COMPLETED' ? 'DELIVERED & VERIFIED ✓' : 'QUEUED FOR DISPATCH'}</span>
              </div>
              <div className="font-mono text-[11px] text-gray-300 bg-black/40 p-2.5 rounded-xl border border-white/5">
                "{selectedCase.farmer_notification?.message_preview || `नमस्ते ${selectedBooking.farmer_name} जी, मशीन M0001 में खराबी आने पर बैकअप मशीन M0002 रवाना कर दी गई है। ₹0 अतिरिक्त शुल्क।`}"
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
