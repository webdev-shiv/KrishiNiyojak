import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Zap, TrendingUp, AlertTriangle, CheckCircle, BarChart3, Clock, MapPin } from 'lucide-react';

export default function AgrotonMetricsSection() {
  const [simulationState, setSimulationState] = useState(null);
  const [loading, setLoading] = useState(false);

  const runSimulatedFeasibility = () => {
    setLoading(true);
    setTimeout(() => {
      setSimulationState({
        is_feasible: true,
        machine_name: 'Mahindra 575 DI (45 HP)',
        implement: 'Rotavator 7-Feet (Requires 40 HP)',
        travel_distance_km: 14.2,
        estimated_travel_time_minutes: 34,
        operational_status: 'PASS - Within 25km radius',
        warnings: ['Heavy soil condition: Estimated work duration increased to 5.2 hours.'],
      });
      setLoading(false);
    }, 600);
  };

  return (
    <section id="about" className="relative w-full py-24 px-4 sm:px-6 lg:px-8 bg-white text-slate-900 border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        
        {/* ========================================================================= */}
        {/* TOP SECTION: EDITORIAL HEADLINE & STATS (INSPIRED BY REFERENCE PHOTO 2)   */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-16">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase text-emerald-800 bg-emerald-100/70 mb-4">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              Operational Leadership & Scale
            </div>

            <h2 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-slate-900 leading-tight">
              One of the largest decentralized <br />
              <span className="text-emerald-700 font-serif italic font-normal">agricultural machinery networks</span> in the region
            </h2>

            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              KrishiNiyojak bridges the gap between smallholder farmer seasonal demand and centralized machinery fleets.
              Through automated EDF scheduling algorithms and geodesic transit modeling, we protect vulnerable crop windows from seasonal machinery deficits.
            </p>

            {/* Pill KPI Badges (Direct match to Photo 2: 100%, 50+, 10+) */}
            <div className="flex flex-wrap gap-4 mt-8">
              <div className="bg-[#f6f7f3] rounded-2xl p-5 border border-slate-200/80 min-w-[130px]">
                <div className="text-3xl font-black font-display text-emerald-800">100%</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Verified Fleet Status</div>
              </div>

              <div className="bg-[#f6f7f3] rounded-2xl p-5 border border-slate-200/80 min-w-[130px]">
                <div className="text-3xl font-black font-display text-emerald-800">50+</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Modern Agricultural Implements</div>
              </div>

              <div className="bg-[#f6f7f3] rounded-2xl p-5 border border-slate-200/80 min-w-[130px]">
                <div className="text-3xl font-black font-display text-emerald-800">10+</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Connected CHC Hubs</div>
              </div>
            </div>
          </div>

          {/* Right Image: Farmer in Golden Wheat Field (Direct match to Photo 2) */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <img
                src="/assets/card-t.jpg"
                alt="Farmer in Wheat Field"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="px-3 py-1 bg-amber-500/90 text-slate-900 font-bold text-xs rounded-full inline-block mb-2">
                  Verified Producer Partner
                </span>
                <h4 className="text-xl font-bold font-display">Shri Rameshwar Patel</h4>
                <p className="text-xs text-slate-200 mt-1">
                  "Saved 48 hours of sowing time during unseasonal rains thanks to KrishiNiyojak's instant tractor reassignment."
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DARK ANALYTICS & SCHEDULING FEASIBILITY DESK (DIRECT MATCH TO PHOTO 2)    */}
        {/* ========================================================================= */}
        <div id="scheduling" className="bg-[#0b1120] rounded-[32px] p-6 sm:p-10 lg:p-12 text-white shadow-2xl border border-white/10 mt-12">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-8 mb-8 border-b border-white/10 gap-4">
            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Live Engine Verification
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-display">
                Automated Scheduling & Feasibility Engine
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Zero-side-effect multi-constraint validation powered by <code className="text-emerald-300">app/services/feasibility.py</code>
              </p>
            </div>

            <button
              onClick={runSimulatedFeasibility}
              disabled={loading}
              className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 transition-all shadow-lg hover:shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-2 shrink-0"
            >
              <Activity className="w-4 h-4 animate-spin-slow" />
              <span>{loading ? 'Evaluating Rules...' : 'Run Feasibility Check (Dry Run)'}</span>
            </button>
          </div>

          {/* 3 Metric Progress Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Fleet Utilization Today
              </div>
              <div className="text-3xl font-extrabold text-white mt-2 font-display">89.4%</div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full w-[89.4%]" />
              </div>
              <div className="text-[11px] text-slate-400 mt-2">102 out of 114 machines deployed</div>
            </div>

            <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Acreage Covered
              </div>
              <div className="text-3xl font-extrabold text-white mt-2 font-display">1,245.8 <span className="text-sm font-normal text-slate-400">Acres</span></div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full w-[72%]" />
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Plowing: 620 ac | Sowing: 480 ac | Spraying: 145 ac</div>
            </div>

            <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Breakdown Recovery SLA
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-2 font-display">&lt; 45 <span className="text-sm font-normal text-slate-400">min</span></div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[94%]" />
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Urgency score computed in 0.04s</div>
            </div>
          </div>

          {/* Simulated API Output View */}
          {simulationState && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-6 text-sm text-emerald-200 mt-6"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3">
                <CheckCircle className="w-5 h-5" />
                <span>Assignment Verified Feasible by Backend Rules Engine</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Assigned Machine:</span>
                  <span className="font-semibold text-white">{simulationState.machine_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Required Implement:</span>
                  <span className="font-semibold text-white">{simulationState.implement}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Geodesic Transit:</span>
                  <span className="font-semibold text-white">{simulationState.travel_distance_km} km ({simulationState.estimated_travel_time_minutes} min)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Radius Compliance:</span>
                  <span className="font-semibold text-emerald-400">{simulationState.operational_status}</span>
                </div>
              </div>
            </motion.div>
          )}

        </div>

      </div>
    </section>
  );
}
