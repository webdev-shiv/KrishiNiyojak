import React from 'react';
import { X, CheckCircle2, AlertTriangle, Clock, MapPin, Gauge, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FeasibilityModal({ isOpen, onClose, queryData }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-[#0f172a] border border-white/15 rounded-3xl shadow-2xl p-6 sm:p-8 text-white overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold font-display">
                Feasibility Check: Feasible Assignment
              </h3>
              <p className="text-xs text-slate-400">
                Evaluated without database mutations via <code className="text-emerald-300">POST /api/v1/scheduling/feasibility</code>
              </p>
            </div>
          </div>

          {/* Evaluation Details */}
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 bg-slate-900/80 rounded-2xl p-4 border border-white/5">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Selected Hub:</span>
                <span className="font-semibold text-white">{queryData?.hub || 'Mandsaur Central Hub'}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Date & Operation:</span>
                <span className="font-semibold text-white">{queryData?.date || '2026-10-25'} ({queryData?.op || 'SOWING'})</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Machine:</span>
                <span className="font-semibold text-emerald-400">John Deere 5050D (50 HP)</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Implement Power:</span>
                <span className="font-semibold text-emerald-400">45 HP Required (Surplus +5 HP)</span>
              </div>
            </div>

            {/* Travel & Capacity Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <MapPin className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <div className="text-xs text-slate-400">Distance</div>
                <div className="font-bold text-white text-sm">18.4 km</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <div className="text-xs text-slate-400">Est. Transit</div>
                <div className="font-bold text-white text-sm">44 mins</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <Gauge className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <div className="text-xs text-slate-400">Slot Duration</div>
                <div className="font-bold text-white text-sm">Full Day (8h)</div>
              </div>
            </div>

            {/* Advisory Warnings badge */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Acreage Advisory:</strong> {queryData?.acreage || '12'} acres estimated duration is ~6.4 hours. Machine will complete within standard daylight slot.
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                alert('Booking created successfully with Booking Code: #BK-7892 (SCHEDULED)!');
                onClose();
              }}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <span>Confirm & Lock Booking</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
