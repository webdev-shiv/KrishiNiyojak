import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Compass, ShieldCheck, Tractor, Wrench, ChevronDown, Sparkles } from 'lucide-react';

export default function CinematicHero({ onExploreClick }) {
  const containerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [activeHeadline, setActiveHeadline] = useState('Harvest.');

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Hero Card Animations
  const heroScale = useTransform(scrollYProgress, [0, 0.4], shouldReduceMotion ? [1, 1] : [1, 0.94]);
  const heroTranslateY = useTransform(scrollYProgress, [0, 0.4], shouldReduceMotion ? ['0%', '0%'] : ['0%', '-8%']);
  const heroImageZoom = useTransform(scrollYProgress, [0, 0.4], shouldReduceMotion ? [1, 1] : [1, 1.15]);
  const heroContentOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroHeadlineY = useTransform(scrollYProgress, [0, 0.25], shouldReduceMotion ? [0, 0] : [0, -60]);

  // Dark Section Reveal Animation (Sweeps up from bottom to cover the viewport)
  const darkSectionY = useTransform(scrollYProgress, [0.12, 0.55], shouldReduceMotion ? ['105%', '0%'] : ['105%', '0%']);
  const darkSectionScale = useTransform(scrollYProgress, [0.15, 0.55], shouldReduceMotion ? [1, 1] : [0.94, 1]);
  const darkSectionOpacity = useTransform(scrollYProgress, [0.10, 0.18], [0, 1]);

  // Staggered Image Cards Entrance
  const cardsOpacity = useTransform(scrollYProgress, [0.35, 0.6], [0, 1]);
  const cardsScale = useTransform(scrollYProgress, [0.35, 0.6], shouldReduceMotion ? [1, 1] : [0.9, 1]);
  const textDescOpacity = useTransform(scrollYProgress, [0.45, 0.7], [0, 1]);
  const textDescY = useTransform(scrollYProgress, [0.45, 0.7], shouldReduceMotion ? [0, 0] : [30, 0]);

  const cardsData = [
    {
      letter: 'W',
      word: 'WINDOW',
      title: 'Seasonal Crop Window',
      subtitle: 'Critical sowing & harvest timing',
      image: '/assets/card-w.jpg',
      staggerY: -28, // Higher
      tag: '01 / Sowing',
    },
    {
      letter: 'E',
      word: 'EQUIP',
      title: 'High-HP Machinery',
      subtitle: 'Tractors, seeders & harvesters',
      image: '/assets/card-e.jpg',
      staggerY: 18, // Lower
      tag: '02 / Fleet',
    },
    {
      letter: 'S',
      word: 'SCALE',
      title: 'Terrace & Acreage GIS',
      subtitle: 'Geodesic rural route planning',
      image: '/assets/card-s.jpg',
      staggerY: 34, // Lowest
      tag: '03 / Routes',
    },
    {
      letter: 'T',
      word: 'TRUST',
      title: 'Breakdown Recovery',
      subtitle: 'Priority score dispatching',
      image: '/assets/card-t.jpg',
      staggerY: -8, // Centered
      tag: '04 / Resilient',
    },
  ];

  return (
    <div ref={containerRef} className="relative w-full h-[260vh] bg-[#05080e]">
      {/* Sticky Viewport Shell */}
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center p-3 md:p-6 lg:p-8">
        
        {/* ========================================================================= */}
        {/* 1. INITIAL HERO CARD (FULL-BLEED CINEMATIC CARD WITH ROUNDED CORNERS)     */}
        {/* ========================================================================= */}
        <motion.div
          style={{
            scale: heroScale,
            y: heroTranslateY,
          }}
          className="relative w-full h-full max-w-[1720px] rounded-[24px] md:rounded-[36px] overflow-hidden shadow-2xl border border-white/10 select-none"
        >
          {/* Panoramic Hero Image Background with Subtle Parallax Zoom */}
          <motion.div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url('/assets/hero-landscape.jpg')`,
              scale: heroImageZoom,
            }}
          >
            {/* Cinematic Film Vignette & Contrast Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />
            <div className="absolute inset-0 bg-radial-gradient pointer-events-none" style={{
              background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.6) 100%)'
            }} />
          </motion.div>

          {/* Hero Inner Content Layer */}
          <motion.div
            style={{ opacity: heroContentOpacity, y: heroHeadlineY }}
            className="relative z-10 w-full h-full flex flex-col justify-between p-6 md:p-10 lg:p-14 text-white"
          >
            {/* Top Bar: Brand, Navigation & Pill CTA */}
            <header className="flex items-center justify-between w-full">
              {/* Minimal Brand Logo (Top-Left) */}
              <div className="flex items-center gap-3">
                <span className="text-xl md:text-2xl font-bold tracking-tight font-display flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  _farmlife
                </span>
                <span className="hidden sm:inline-block px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 rounded-full">
                  KrishiNiyojak
                </span>
              </div>

              {/* Minimal Editorial Links (Center - Hidden on Mobile) */}
              <nav className="hidden md:flex items-center gap-8 text-xs lg:text-sm font-medium tracking-wide text-white/80">
                <a href="#about" className="hover:text-emerald-400 transition-colors">About</a>
                <a href="#fleet" className="hover:text-emerald-400 transition-colors">Fleet Hub</a>
                <a href="#scheduling" className="hover:text-emerald-400 transition-colors">Scheduling</a>
                <a href="#recovery" className="hover:text-emerald-400 transition-colors">Recovery Queue</a>
              </nav>

              {/* Pill-shaped CTA Button (Top-Right) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onExploreClick}
                  className="group relative inline-flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 rounded-full text-xs md:text-sm font-semibold tracking-wide text-white bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/25 hover:border-emerald-400/50 shadow-lg transition-all duration-300 hover:shadow-emerald-950/50 hover:scale-105 active:scale-95"
                >
                  <span>Get the experience +</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </header>

            {/* Centered Large Bold Headline */}
            <div className="text-center my-auto flex flex-col items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-4xl"
              >
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] md:text-xs font-semibold tracking-widest uppercase text-emerald-300 bg-black/35 backdrop-blur-md border border-emerald-500/30 mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Mandsaur Hub • Dewas District • 24.1° N
                </div>

                <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tight font-display text-white drop-shadow-2xl leading-[0.95] mb-3">
                  {activeHeadline}
                </h1>

                <p className="font-serif italic text-lg sm:text-xl md:text-2xl text-emerald-100/90 font-light tracking-wide max-w-xl mx-auto drop-shadow">
                  Farmer's seasonal companion & machinery-day resilience.
                </p>

                {/* Subtitle Headline switcher (Subtle interactive touch) */}
                <div className="flex items-center justify-center gap-2 mt-6">
                  {['Harvest.', 'Nature.', 'Mechanize.'].map((h) => (
                    <button
                      key={h}
                      onClick={() => setActiveHeadline(h)}
                      className={`text-xs px-3 py-1 rounded-full transition-all ${
                        activeHeadline === h
                          ? 'bg-white text-slate-900 font-bold shadow'
                          : 'bg-black/30 text-white/70 hover:bg-black/50 hover:text-white border border-white/10'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Bottom Bar: Slide Counter & Context Links */}
            <footer className="flex items-end justify-between w-full pt-4">
              {/* Slide Counter (Bottom-Left) */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-white tracking-tight">
                  04
                </span>
                <span className="text-base sm:text-lg font-light text-white/50 tracking-wider">
                  / 09
                </span>
              </div>

              {/* Scroll Down Indicator */}
              <div className="hidden sm:flex flex-col items-center gap-1.5 text-white/70 text-xs uppercase tracking-widest animate-bounce">
                <span>Scroll to unveil</span>
                <ChevronDown className="w-4 h-4 text-emerald-400" />
              </div>

              {/* Contextual / Social Links (Bottom-Right) */}
              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium tracking-wide text-white/70">
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Instagram
                </a>
                <a href="https://facebook.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Facebook
                </a>
                <a href="https://dribbble.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Dribbble
                </a>
                <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Twitter
                </a>
              </div>
            </footer>
          </motion.div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 2. CINEMATIC DARK CONTENT SECTION (EMERGES FROM BELOW ON SCROLL)          */}
        {/* ========================================================================= */}
        <motion.div
          style={{
            y: darkSectionY,
            scale: darkSectionScale,
            opacity: darkSectionOpacity,
          }}
          className="absolute inset-0 z-30 w-full h-full p-3 md:p-6 lg:p-8 pointer-events-auto"
        >
          <div
            style={{ backgroundColor: '#080d14' }}
            className="relative w-full h-full max-w-[1720px] mx-auto rounded-[24px] md:rounded-[36px] bg-[#080d14] border border-white/10 shadow-2xl overflow-hidden flex flex-col justify-between p-6 md:p-10 lg:p-14 text-white"
          >
            
            {/* Top Glimpse: Peek of Mountain Horizon with Pinned Counter & Nav */}
            <div className="relative z-10 flex items-center justify-between w-full pb-4 border-b border-white/10">
              {/* Pinned Slide Counter (Top-Left) */}
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
                    04
                  </span>
                  <span className="text-sm font-light text-white/50 tracking-wider">
                    / 09
                  </span>
                </div>
                <span className="text-xs text-emerald-400 tracking-wider uppercase font-semibold pl-3 border-l border-white/15 hidden sm:inline">
                  Cinematic Field Dispatch
                </span>
              </div>

              {/* Minimal Brand Identifier */}
              <div className="text-sm font-semibold tracking-wider font-display text-white/90">
                KrishiNiyojak Fleet Architecture
              </div>

              {/* Social / Direct Action Links (Top-Right) */}
              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium tracking-wide text-white/70">
                <a href="#about" className="hover:text-white transition-colors">Instagram</a>
                <a href="#fleet" className="hover:text-white transition-colors">Facebook</a>
                <a href="#docs" className="hover:text-white transition-colors">Dribbble</a>
                <a href="#contact" className="hover:text-white transition-colors">Twitter</a>
              </div>
            </div>

            {/* Main Stage: Row of 4 Vertically Oriented Staggered Image Cards */}
            <motion.div
              style={{
                opacity: cardsOpacity,
                scale: cardsScale,
              }}
              className="my-auto py-4"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 max-w-6xl mx-auto items-center">
                {cardsData.map((card, idx) => (
                  <motion.div
                    key={card.letter}
                    style={{
                      y: shouldReduceMotion ? 0 : card.staggerY,
                    }}
                    whileHover={{ scale: 1.04, y: shouldReduceMotion ? 0 : card.staggerY - 8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="group relative flex flex-col items-center text-center cursor-pointer"
                  >
                    {/* Vertical Portrait Image Card */}
                    <div className="relative w-full aspect-[9/14] sm:aspect-[9/13] rounded-2xl overflow-hidden border border-white/15 group-hover:border-emerald-400/60 shadow-xl transition-all duration-300">
                      <img
                        src={card.image}
                        alt={card.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                        loading="lazy"
                      />
                      {/* Subtle Gradient & Tag Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                      
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase text-white/90 bg-black/50 backdrop-blur-sm border border-white/20">
                        {card.tag}
                      </div>

                      <div className="absolute bottom-3 inset-x-3 text-left">
                        <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {card.title}
                        </div>
                        <div className="text-[10px] text-white/70 line-clamp-1">
                          {card.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Bold Capital Letter Directly Under the Card */}
                    <div className="mt-4 flex flex-col items-center">
                      <span className="text-3xl sm:text-4xl lg:text-5xl font-black font-display text-white tracking-widest group-hover:text-emerald-400 transition-colors">
                        {card.letter}
                      </span>
                      <span className="text-[10px] tracking-widest font-semibold uppercase text-emerald-400/80 -mt-1">
                        {card.word}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Bottom Descriptive Paragraph & Smooth Scroll Cue */}
            <motion.div
              style={{
                opacity: textDescOpacity,
                y: textDescY,
              }}
              className="max-w-2xl mx-auto text-center pt-2"
            >
              <p className="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed font-light">
                KrishiNiyojak custom hiring coordination represents the gold standard for regional farm mechanization.
                Engineered to eliminate crop window vulnerabilities across seasonal sowing, harvest cycles, and unexpected in-field machinery disruptions.
              </p>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={onExploreClick}
                  className="px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 shadow-md hover:shadow-emerald-500/20 transition-all"
                >
                  Explore Hub Inventory
                </button>
                <a
                  href="#dashboard-preview"
                  className="px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 transition-all"
                >
                  View Live Command Desk
                </a>
              </div>
            </motion.div>

          </div>
        </motion.div>

      </div>
    </div>
  );
}
