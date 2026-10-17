import React, { useState } from 'react';
import { Search, MapPin, Calendar, Sparkles, Tractor, CheckCircle2, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EcoSearchSection({ onFeasibilityClick }) {
  const [selectedHub, setSelectedHub] = useState('Mandsaur Central Hub (25km)');
  const [selectedOperation, setSelectedOperation] = useState('SOWING');
  const [acreage, setAcreage] = useState('12');
  const [date, setDate] = useState('2026-10-25');

  const hubs = [
    'Mandsaur Central Hub (25km)',
    'Dewas Agricultural Centre (30km)',
    'Ujjain Regional Hub (40km)',
    'Indore North CHC (50km)'
  ];

  const operations = [
    { id: 'PLOWING', label: 'Plowing / Tillage', hp: '45+ HP' },
    { id: 'SOWING', label: 'Sowing / Seed Drill', hp: '50+ HP' },
    { id: 'SPRAYING', label: 'Boom Spraying', hp: '35+ HP' },
    { id: 'HARVESTING', label: 'Combine Harvesting', hp: '75+ HP' },
  ];

  return (
    <section id="fleet" className="relative w-full py-24 px-4 sm:px-6 lg:px-8 bg-[#f6f7f3] text-slate-900 overflow-hidden">
      {/* Decorative ambient backdrop blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      <div className="relative max-w-7xl mx-auto">
        
        {/* Header Title (Inspired by Reference Photo 1: "Find Eco-Friendly Homes Easily") */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 border border-emerald-300 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Custom Hiring Centre (CHC) Network
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-display text-slate-900 leading-tight">
            Find Modern Agricultural <br />
            <span className="text-emerald-700 font-serif italic font-medium">Equipment Easily</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Book certified tractors, seed drills, and combine harvesters within your regional agro-climatic zone. Guaranteed on-time field arrival.
          </p>
        </div>

        {/* Floating Pill Search Bar (Direct visual match to Reference Photo 1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-4xl mx-auto bg-white rounded-full shadow-2xl p-2 sm:p-3 border border-slate-200/80 mb-16 flex flex-col md:flex-row items-center gap-2"
        >
          {/* Input 1: CHC Hub Selection */}
          <div className="flex-1 w-full px-4 py-2 flex items-center gap-3 border-b md:border-b-0 md:border-r border-slate-100">
            <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="w-full text-left">
              <label className="block text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Regional Hub
              </label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {hubs.map((hub) => (
                  <option key={hub} value={hub}>{hub}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Input 2: Operation Type */}
          <div className="flex-1 w-full px-4 py-2 flex items-center gap-3 border-b md:border-b-0 md:border-r border-slate-100">
            <Tractor className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="w-full text-left">
              <label className="block text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Operation Type
              </label>
              <select
                value={selectedOperation}
                onChange={(e) => setSelectedOperation(e.target.value)}
                className="w-full text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {operations.map((op) => (
                  <option key={op.id} value={op.id}>{op.label} ({op.hp})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Input 3: Acreage & Date */}
          <div className="flex-1 w-full px-4 py-2 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="w-full text-left">
              <label className="block text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Target Date & Acreage
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs sm:text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
                />
                <span className="text-slate-300">|</span>
                <input
                  type="number"
                  value={acreage}
                  onChange={(e) => setAcreage(e.target.value)}
                  placeholder="Acres"
                  className="w-16 text-xs sm:text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
                />
                <span className="text-xs text-slate-400">ac</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button (Pill Button) */}
          <button
            onClick={() => onFeasibilityClick({ hub: selectedHub, op: selectedOperation, acreage, date })}
            className="w-full md:w-auto px-7 py-3.5 rounded-full text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md hover:shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
          >
            <Search className="w-4 h-4" />
            <span>Check Feasibility</span>
          </button>
        </motion.div>

        {/* 3 Featured Machinery Category Cards (Inspired by Reference Photo 1 Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Card 1: Heavy Duty Tractors */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col justify-between group hover:-translate-y-1 transition-transform">
            <div>
              <div className="relative aspect-[16/11] rounded-2xl overflow-hidden mb-5">
                <img
                  src="/assets/card-e.jpg"
                  alt="High Power Tractors"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-3 py-1 bg-emerald-800/80 backdrop-blur-sm text-white text-[11px] font-bold rounded-full">
                  55 HP – 75 HP
                </span>
              </div>

              <h3 className="text-xl font-bold font-display text-slate-900 mb-2">
                Heavy Tillage Tractors
              </h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Dual-clutch utility tractors compatible with rotavators, disc harrows, and deep subsoilers.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">₹850 / Hour</span>
              <button
                onClick={() => onFeasibilityClick({ hub: selectedHub, op: 'PLOWING', acreage, date })}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
              >
                Schedule Unit →
              </button>
            </div>
          </div>

          {/* Card 2: Precision Seeders */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col justify-between group hover:-translate-y-1 transition-transform">
            <div>
              <div className="relative aspect-[16/11] rounded-2xl overflow-hidden mb-5">
                <img
                  src="/assets/card-s.jpg"
                  alt="Precision Seed Drills"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-3 py-1 bg-amber-700/80 backdrop-blur-sm text-white text-[11px] font-bold rounded-full">
                  Zero-Till Seeders
                </span>
              </div>

              <h3 className="text-xl font-bold font-display text-slate-900 mb-2">
                Multi-Crop Seed Drills
              </h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Pneumatic seed metering with automated depth control for soybean, wheat, and pulses.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">₹1,100 / Hour</span>
              <button
                onClick={() => onFeasibilityClick({ hub: selectedHub, op: 'SOWING', acreage, date })}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
              >
                Schedule Unit →
              </button>
            </div>
          </div>

          {/* Card 3: Combine Harvesters */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col justify-between group hover:-translate-y-1 transition-transform">
            <div>
              <div className="relative aspect-[16/11] rounded-2xl overflow-hidden mb-5">
                <img
                  src="/assets/card-t.jpg"
                  alt="Combine Harvesters"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-3 py-1 bg-emerald-800/80 backdrop-blur-sm text-white text-[11px] font-bold rounded-full">
                  Grain & Paddy
                </span>
              </div>

              <h3 className="text-xl font-bold font-display text-slate-900 mb-2">
                Paddy & Grain Harvesters
              </h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Tracked and wheeled combine harvesters engineered for tight seasonal windows and zero grain loss.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">₹2,400 / Acre</span>
              <button
                onClick={() => onFeasibilityClick({ hub: selectedHub, op: 'HARVESTING', acreage, date })}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
              >
                Schedule Unit →
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
