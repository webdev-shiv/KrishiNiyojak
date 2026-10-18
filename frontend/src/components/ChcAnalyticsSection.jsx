import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  DollarSign, 
  PieChart as PieIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Calendar, 
  ArrowUpRight,
  AlertCircle,
  Activity,
  Layers
} from 'lucide-react';

/**
 * ChcAnalyticsSection
 * Provides:
 * 1. Status Breakdown Pie/Donut Chart (Approved vs Pending vs Cancelled)
 * 2. Revenue Waveform Spline Chart with [Today | This Week | This Month | This Year] tabs
 * 3. Strict authentic data validation (displays "Data Not Found / No Revenue Recorded" when period revenue is 0)
 */
export function ChcAnalyticsSection({ bookings = [], currentCentre = null }) {
  const [timeframe, setTimeframe] = useState('month'); // 'today' | 'week' | 'month' | 'year'

  // ==========================================
  // 1. STATUS DISTRIBUTION CALCULATIONS
  // ==========================================
  const statusStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let cancelled = 0;

    (bookings || []).forEach(b => {
      const st = (b.status || '').toLowerCase();
      if (st.includes('cancel') || st.includes('reject') || st.includes('impasse')) {
        cancelled++;
      } else if (st.includes('pend') || st.includes('review') || b.hours === 0 || b.hours == null) {
        pending++;
      } else if (st.includes('approv') || st.includes('complet') || st.includes('schedul') || (b.hours && b.hours >= 1)) {
        approved++;
      } else {
        pending++;
      }
    });

    const total = approved + pending + cancelled;
    const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
    const cancelledPct = total > 0 ? Math.max(0, 100 - approvedPct - pendingPct) : 0;

    return { approved, pending, cancelled, total, approvedPct, pendingPct, cancelledPct };
  }, [bookings]);

  // Donut SVG circumference math (r = 54 -> circumference ~ 339.29)
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // 339.29
  const approvedStroke = (statusStats.approvedPct / 100) * circumference;
  const pendingStroke = (statusStats.pendingPct / 100) * circumference;
  const cancelledStroke = (statusStats.cancelledPct / 100) * circumference;

  const approvedOffset = 0;
  const pendingOffset = -approvedStroke;
  const cancelledOffset = -(approvedStroke + pendingStroke);

  // ==========================================
  // 2. TIMEFRAME REVENUE CALCULATIONS
  // ==========================================
  const revenueData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Filter bookings belonging to the selected timeframe
    const periodBookings = (bookings || []).filter(b => {
      const bDate = b.scheduled_date || b.booking_date || b.created_at;
      if (!bDate) return false;
      const bDateStr = typeof bDate === 'string' ? bDate.split('T')[0] : '';

      if (timeframe === 'today') {
        return bDateStr === todayStr;
      }
      if (timeframe === 'week') {
        const d = new Date(bDate);
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (timeframe === 'month') {
        return bDateStr.startsWith(currentMonthStr);
      }
      if (timeframe === 'year') {
        return bDateStr.startsWith(String(currentYear));
      }
      return true;
    });

    // Sum revenue strictly from amount_inr or total_price
    let totalRevenue = 0;
    let paidCount = 0;

    periodBookings.forEach(b => {
      const val = Number(b.amount_inr || b.total_price || 0);
      if (val > 0) {
        totalRevenue += val;
        paidCount++;
      }
    });

    // If total revenue is 0 or no bookings, return empty state flags
    if (totalRevenue === 0 || paidCount === 0) {
      return {
        hasData: false,
        totalRevenue: 0,
        paidCount: 0,
        averagePerJob: 0,
        wavePoints: [],
        labels: []
      };
    }

    // Generate accurate wave points based on timeframe
    let labels = [];
    let buckets = [];

    if (timeframe === 'today') {
      labels = ['08:00 AM', '11:00 AM', '02:00 PM', '05:00 PM', '08:00 PM'];
      buckets = [0, 0, 0, 0, 0];
      periodBookings.forEach(b => {
        const val = Number(b.amount_inr || b.total_price || 0);
        const time = b.scheduled_time || b.time || '10:00';
        const hour = parseInt(time) || 10;
        if (hour < 10) buckets[0] += val;
        else if (hour < 13) buckets[1] += val;
        else if (hour < 16) buckets[2] += val;
        else if (hour < 19) buckets[3] += val;
        else buckets[4] += val;
      });
    } else if (timeframe === 'week') {
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      buckets = [0, 0, 0, 0, 0, 0, 0];
      periodBookings.forEach(b => {
        const val = Number(b.amount_inr || b.total_price || 0);
        const dayIdx = (new Date(b.scheduled_date || b.booking_date).getDay() + 6) % 7;
        buckets[dayIdx] += val;
      });
    } else if (timeframe === 'month') {
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      buckets = [0, 0, 0, 0];
      periodBookings.forEach(b => {
        const val = Number(b.amount_inr || b.total_price || 0);
        const dateNum = new Date(b.scheduled_date || b.booking_date).getDate();
        const wIdx = Math.min(3, Math.floor((dateNum - 1) / 7));
        buckets[wIdx] += val;
      });
    } else {
      labels = ['Q1 Jan-Mar', 'Q2 Apr-Jun', 'Q3 Jul-Sep', 'Q4 Oct-Dec'];
      buckets = [0, 0, 0, 0];
      periodBookings.forEach(b => {
        const val = Number(b.amount_inr || b.total_price || 0);
        const m = new Date(b.scheduled_date || b.booking_date).getMonth();
        const qIdx = Math.min(3, Math.floor(m / 3));
        buckets[qIdx] += val;
      });
    }

    // If all buckets ended up 0 but totalRevenue was > 0, distribute to active point
    if (buckets.every(v => v === 0)) {
      buckets[buckets.length - 1] = totalRevenue;
    }

    const maxVal = Math.max(...buckets, 1);
    const wavePoints = buckets.map(v => ({
      amount: v,
      pct: (v / maxVal) * 100
    }));

    return {
      hasData: true,
      totalRevenue,
      paidCount,
      averagePerJob: Math.round(totalRevenue / paidCount),
      wavePoints,
      labels
    };
  }, [bookings, timeframe]);

  // Construct SVG smooth bezier curve for waveform
  const svgWavePath = useMemo(() => {
    if (!revenueData.hasData || revenueData.wavePoints.length === 0) return '';
    const width = 500;
    const height = 140;
    const padding = 20;
    const pts = revenueData.wavePoints.map((p, idx) => {
      const x = padding + (idx / (revenueData.wavePoints.length - 1)) * (width - 2 * padding);
      const y = height - padding - (p.pct / 100) * (height - 2 * padding);
      return { x, y };
    });

    if (pts.length < 2) return '';

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    const fillPath = `${path} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
    return { linePath: path, areaPath: fillPath, pts };
  }, [revenueData]);

  const timeframeLabel = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year'
  }[timeframe];

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
            <BarChart2 className="w-5 h-5 text-emerald-800" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>CHC Operational Analytics & Revenue Dynamics</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black uppercase">
                Live Single Source
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live status distribution pie chart and waveform periodic revenue metrics based on Supabase booking ledger.
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium self-start sm:self-auto px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
          Centre: <span className="font-bold text-gray-800">{currentCentre?.name || currentCentre?.centre_name || 'CHC Pur Kalan'}</span>
        </div>
      </div>

      {/* Analytics Grid: Left (Pie Chart) + Right (Waveform Revenue Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* ===================================================================
            1. PIE / DONUT CHART: DISPATCH STATUS DISTRIBUTION (5 COLS)
           =================================================================== */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-800" />
              <h3 className="text-sm font-extrabold text-gray-900">
                Booking Status Distribution
              </h3>
            </div>
            <span className="text-[11px] font-bold text-gray-500">
              {statusStats.total} Total Requests
            </span>
          </div>

          {/* Donut Chart SVG */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto">
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 140 140">
                {/* Background Ring */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="16"
                />

                {/* Approved / Active Segment (Green) */}
                {statusStats.approvedPct > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="16"
                    strokeDasharray={`${approvedStroke} ${circumference}`}
                    strokeDashoffset={approvedOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}

                {/* Pending Segment (Amber) */}
                {statusStats.pendingPct > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="16"
                    strokeDasharray={`${pendingStroke} ${circumference}`}
                    strokeDashoffset={pendingOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}

                {/* Cancelled / Impasse Segment (Rose) */}
                {statusStats.cancelledPct > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="16"
                    strokeDasharray={`${cancelledStroke} ${circumference}`}
                    strokeDashoffset={cancelledOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}
              </svg>

              {/* Center Metrics */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 leading-none">
                  {statusStats.total}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Bookings
                </span>
              </div>
            </div>

            {/* Legend Cards */}
            <div className="space-y-2.5 flex-1 w-full text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-bold text-gray-800">Approved & Active</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-900 block">{statusStats.approved}</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">{statusStats.approvedPct}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-bold text-gray-800">Pending Review</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-amber-900 block">{statusStats.pending}</span>
                  <span className="text-[10px] text-amber-700 font-semibold">{statusStats.pendingPct}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="font-bold text-gray-800">Cancelled / Impasse</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-rose-900 block">{statusStats.cancelled}</span>
                  <span className="text-[10px] text-rose-700 font-semibold">{statusStats.cancelledPct}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Acceptance Rate: <strong className="text-emerald-800">{statusStats.approvedPct}%</strong></span>
            <span>Pending Ratio: <strong className="text-amber-800">{statusStats.pendingPct}%</strong></span>
          </div>
        </div>

        {/* ===================================================================
            2. WAVEFORM REVENUE GRAPH (7 COLS)
           =================================================================== */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs flex flex-col justify-between gap-5">
          
          {/* Header & Sliding Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-extrabold text-gray-900">
                  Revenue Wave Dynamics
                </h3>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Waveform revenue spline across selectable temporal horizons
              </p>
            </div>

            {/* Sliding Toggle Tabs */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-gray-100/90 border border-gray-200">
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'year', label: 'Year' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeframe(tab.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    timeframe === tab.id
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content: Waveform OR Data Not Found */}
          {revenueData.hasData ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total {timeframeLabel}</span>
                  <span className="text-lg font-black text-emerald-950 mt-0.5 block">
                    ₹{revenueData.totalRevenue.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Avg. Per Job</span>
                  <span className="text-lg font-black text-gray-900 mt-0.5 block">
                    ₹{revenueData.averagePerJob.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Paid Bookings</span>
                  <span className="text-lg font-black text-gray-900 mt-0.5 block">
                    {revenueData.paidCount} Units
                  </span>
                </div>
              </div>

              {/* Smooth Spline Waveform SVG */}
              <div className="relative pt-2">
                <div className="w-full h-36 overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50/30 to-white border border-emerald-100/60 p-2">
                  <svg className="w-full h-full" viewBox="0 0 500 140" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revenueWaveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                        <stop offset="70%" stopColor="#10b981" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* Wave Area Fill */}
                    {svgWavePath && (
                      <path
                        d={svgWavePath.areaPath}
                        fill="url(#revenueWaveGrad)"
                      />
                    )}

                    {/* Wave Stroke Line */}
                    {svgWavePath && (
                      <path
                        d={svgWavePath.linePath}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Data Points on Peaks */}
                    {svgWavePath && svgWavePath.pts.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="5"
                          fill="#ffffff"
                          stroke="#059669"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="2.5"
                          fill="#059669"
                        />
                      </g>
                    ))}
                  </svg>
                </div>

                {/* X-Axis Labels */}
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 px-2 mt-1.5">
                  {revenueData.labels.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Strict Authentic Empty State (No Hallucination) */
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-gray-900">
                  Data Not Found / No Revenue Recorded ({timeframeLabel})
                </h4>
                <p className="text-xs text-gray-500 max-w-md mt-1 leading-relaxed">
                  No verified completed or paid booking revenue found in database for <strong>{timeframeLabel}</strong>. NITI adheres to strict data integrity without synthesizing unverified revenue metrics.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-bold text-gray-600">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Real revenue will chart automatically upon job completion & settlement.</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>Currency: Indian Rupee (INR ₹)</span>
            <span>Dynamic Supabase Synchronization</span>
          </div>
        </div>

      </div>
    </div>
  );
}
