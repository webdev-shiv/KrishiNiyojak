import React, { useState } from 'react';
import { AlertCircle, Wrench, Clock, CheckCircle2, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPreviewSection() {
  const [activeAlert, setActiveAlert] = useState(false);

  return (
    <section id="recovery" className="relative w-full py-24 px-4 sm:px-6 lg:px-8 bg-[#070b12] text-white overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase text-amber-400 bg-amber-950/60 border border-amber-500/30 mb-4">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Verified Task T12: Breakdown Recovery & Customer Priority
          </div>

          <h2 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-white leading-tight">
            Live Central Command Desk & <br />
            <span className="text-emerald-400 font-serif italic font-normal">Automated Recovery Queue</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400">
            When machinery breaks down in the field, KrishiNiyojak instantly identifies dependent jobs and computes transparent customer priority scores (1–100) to protect harvest deadlines.
          </p>
        </div>

        {/* Dashboard Mockup Showcase Window */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-slate-900 group">
          
          {/* Top Window Bar */}
          <div className="px-6 py-4 bg-slate-950/90 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs text-slate-400 font-mono ml-3 hidden sm:inline">
                https://krishiniyojak.internal/dashboard?chc_id=chc-mandsaur-01
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/40 px-3 py-0.5 rounded-full">
                API Status: 200 OK
              </span>
            </div>
          </div>

          {/* Screenshot Image Frame */}
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <img
              src="/assets/ui-dashboard.jpg"
              alt="KrishiNiyojak Central Command Desk"
              className="w-full h-full object-cover"
            />
            {/* Interactive Pulse Marker on the Breakdown Queue */}
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-black/80 backdrop-blur-md border border-amber-500/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    Active Incident: Tractor MH43-AB-4567
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-400 font-mono">Urgency: 92/100</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    Plowing at Village Dewas (12.4 Acres) • Deadline in 24h • Auto-rescheduling recommended.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveAlert(!activeAlert)}
                  className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-md"
                >
                  {activeAlert ? 'Hide Priority Rationales' : 'View Priority Formula'}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Priority Formula Explainer Accordion */}
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 bg-slate-900/90 border border-white/10 rounded-2xl p-6 text-sm text-slate-300"
          >
            <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Customer Priority Scoring Engine Weights (Configured in <code>app/core/config.py</code>)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                <div className="font-bold text-amber-400 text-sm">40% Urgency</div>
                <div className="text-slate-400 mt-1">Days remaining until farmer's deadline (≤0 days: 40 pts).</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                <div className="font-bold text-emerald-400 text-sm">25% Criticality</div>
                <div className="text-slate-400 mt-1">Sowing: 25 pts | Harvesting: 23 pts | Spraying: 20 pts.</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                <div className="font-bold text-sky-400 text-sm">20% Delay Risk</div>
                <div className="text-slate-400 mt-1">Estimated repair duration vs. remaining buffer days.</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                <div className="font-bold text-purple-400 text-sm">15% Acreage Scale</div>
                <div className="text-slate-400 mt-1">≥20 acres: 15 pts | 10–20 acres: 12 pts | &lt;5 acres: 6 pts.</div>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </section>
  );
}
