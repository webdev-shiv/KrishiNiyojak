import React, { useState, useEffect } from 'react';
import { 
  Leaf, 
  ArrowRight, 
  Play, 
  Target, 
  Users, 
  ShieldCheck, 
  Calendar, 
  Tractor, 
  MapPin, 
  FileText, 
  Bell, 
  CheckCircle2,
  Clock,
  Navigation,
  Check,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';

export function NitiLandingPage({ onOpenLogin, onDemoLogin }) {
  const [activeTab, setActiveTab] = useState('home');

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'who-we-are', 'how-we-work', 'features'];
      const scrollPos = window.scrollY + 200;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveTab(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#86efac] selection:text-[#0b331c]">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (Exact match to top of reference panels)            */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo: Green Leaf + NITI + MACHINE-DAY COMPOSER */}
          <div 
            onClick={() => scrollTo('home')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-full bg-[#1b6b3e]/10 flex items-center justify-center text-[#1b6b3e]">
              <svg className="w-6 h-6 text-[#1b6b3e] fill-current" viewBox="0 0 24 24">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-[#0f3d23] block leading-none">
                NITI
              </span>
              <span className="text-[9px] font-bold tracking-[0.18em] text-[#1b6b3e] uppercase block mt-1">
                MACHINE-DAY COMPOSER
              </span>
            </div>
          </div>

          {/* Navigation Links with Active Underline Indicator */}
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-semibold text-slate-600">
            {[
              { id: 'home', label: 'Home' },
              { id: 'who-we-are', label: 'Who We Are' },
              { id: 'how-we-work', label: 'How We Work' },
              { id: 'features', label: 'Features' },
            ].map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`relative py-2 transition-colors ${
                  activeTab === link.id ? 'text-[#0f3d23] font-bold' : 'hover:text-[#0f3d23]'
                }`}
              >
                {link.label}
                {activeTab === link.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1b6b3e] rounded-full animate-fade-in" />
                )}
              </button>
            ))}
          </nav>

          {/* Right Action: Login Button & 1-Click Quick Demo Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenLogin('FARMER')}
              className="bg-[#0f3d23] hover:bg-[#165a34] text-white px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-sm hover:shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. SECTION 1: HOME / HERO (Exact match to Panel 1)                       */}
      {/* ========================================================================= */}
      <section id="home" className="pt-8 pb-20 lg:pt-14 lg:pb-28 overflow-hidden bg-gradient-to-b from-white via-[#f7fcf9] to-[#edf9f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-7">
              {/* Mint Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#dcfce7] border border-[#bbf7d0] text-[#15803d] text-xs font-bold tracking-wide">
                <span>Smart Scheduling for a Stronger Tomorrow</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-[#0f3d23] leading-[1.12] tracking-tight">
                Connecting <br />
                Farmers, Machines <br />
                and People
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal">
                NITI is a smart platform that makes agricultural machinery accessible, organized and efficient for everyone in the farming ecosystem.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onOpenLogin('FARMER')}
                  className="bg-[#0f3d23] hover:bg-[#165a34] text-white px-7 py-3.5 rounded-xl font-bold text-base shadow-lg shadow-[#0f3d23]/15 transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => scrollTo('who-we-are')}
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-6 py-3.5 rounded-xl font-bold text-base transition-all flex items-center gap-2.5 shadow-sm"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                  </div>
                  <span>Learn More</span>
                </button>
              </div>

              {/* 3 Metric Counters */}
              <div className="pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-6">
                <div>
                  <div className="text-3xl lg:text-4xl font-extrabold text-[#0f3d23] tracking-tight">3+</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Roles Connected</div>
                </div>
                <div>
                  <div className="text-3xl lg:text-4xl font-extrabold text-[#0f3d23] tracking-tight">100%</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Transparent Process</div>
                </div>
                <div>
                  <div className="text-3xl lg:text-4xl font-extrabold text-[#0f3d23] tracking-tight">Better</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Farm Operations</div>
                </div>
              </div>
            </div>

            {/* Right Visual: Laptop Mockup Displaying NITI Dashboard */}
            <div className="lg:col-span-6 relative">
              
              {/* Laptop Shell */}
              <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
                
                {/* Laptop Body & Screen Frame */}
                <div className="rounded-2xl lg:rounded-3xl bg-[#1e293b] p-2.5 sm:p-3.5 shadow-2xl border-4 border-slate-700/80 ring-1 ring-black/20">
                  
                  {/* Laptop Screen Header / Camera Dot */}
                  <div className="flex items-center justify-center pb-2">
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  </div>

                  {/* Inside Laptop: NITI Central Command Dashboard */}
                  <div className="bg-white rounded-xl overflow-hidden shadow-inner flex flex-col h-[340px] sm:h-[380px] text-xs">
                    
                    {/* Top Inside Bar */}
                    <div className="bg-[#f8fafc] border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-[#1b6b3e] flex items-center justify-center text-white">
                          <Leaf className="w-3 h-3 fill-current" />
                        </div>
                        <span className="font-extrabold text-[#0f3d23] text-xs tracking-wide">NITI</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">CHC Hub Central</div>
                    </div>

                    {/* Dashboard Layout: Mini Sidebar + Today's Schedule + Current Job Map */}
                    <div className="flex-1 flex overflow-hidden">
                      
                      {/* Mini Dark Forest-Green Sidebar */}
                      <div className="w-24 sm:w-28 bg-[#0f3d23] text-white p-2.5 flex flex-col justify-between shrink-0">
                        <div className="space-y-1">
                          <div className="bg-[#1b6b3e] text-white font-bold px-2 py-1 rounded text-[10px] flex items-center gap-1.5">
                            <Layers className="w-3 h-3" />
                            <span>Dashboard</span>
                          </div>
                          <div className="text-slate-300 hover:text-white px-2 py-1 text-[10px] flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-emerald-400" />
                            <span>Requests</span>
                          </div>
                          <div className="text-slate-300 hover:text-white px-2 py-1 text-[10px] flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-emerald-400" />
                            <span>Schedule</span>
                          </div>
                          <div className="text-slate-300 hover:text-white px-2 py-1 text-[10px] flex items-center gap-1.5">
                            <Tractor className="w-3 h-3 text-emerald-400" />
                            <span>Machines</span>
                          </div>
                          <div className="text-slate-300 hover:text-white px-2 py-1 text-[10px] flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>Operators</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Workspace Inside Laptop */}
                      <div className="flex-1 p-3 bg-slate-50/70 overflow-hidden flex flex-col gap-2.5">
                        
                        {/* Header of Workspace */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">Today's Schedule</span>
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                            Fri, 18 Oct 2026
                          </span>
                        </div>

                        {/* Split: Schedule items & Current Job Map */}
                        <div className="grid grid-cols-12 gap-2 flex-1">
                          
                          {/* Schedule List */}
                          <div className="col-span-7 space-y-1.5">
                            {/* Job 1 */}
                            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
                              <div>
                                <div className="text-[10px] text-slate-400 font-semibold">08:00 AM – 12:00 PM</div>
                                <div className="font-bold text-slate-800 text-[11px]">Wheat Harvesting</div>
                                <div className="text-[9px] text-slate-500">Mohan Singh • Sunderpur</div>
                              </div>
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                In Progress
                              </span>
                            </div>

                            {/* Job 2 */}
                            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
                              <div>
                                <div className="text-[10px] text-slate-400 font-semibold">01:00 PM – 03:00 PM</div>
                                <div className="font-bold text-slate-800 text-[11px]">Field Preparation</div>
                                <div className="text-[9px] text-slate-500">Sita Devi • Kherli</div>
                              </div>
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                Upcoming
                              </span>
                            </div>

                            {/* Job 3 */}
                            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
                              <div>
                                <div className="text-[10px] text-slate-400 font-semibold">04:00 PM – 06:00 PM</div>
                                <div className="font-bold text-slate-800 text-[11px]">Spraying Operation</div>
                                <div className="text-[9px] text-slate-500">Geeta Bai • Rampur</div>
                              </div>
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                Upcoming
                              </span>
                            </div>
                          </div>

                          {/* Current Job & Map Preview */}
                          <div className="col-span-5 bg-white p-2 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-[10px]">Current Job</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[9px] text-slate-600">
                                <span>2.8 km to Dest</span>
                                <span className="font-bold text-slate-800">12 min ETA</span>
                              </div>
                            </div>

                            {/* Stylized Mini Map Graphic */}
                            <div className="relative h-20 rounded bg-emerald-50/60 border border-emerald-100 overflow-hidden my-1 flex items-center justify-center">
                              {/* Route Path SVG */}
                              <svg className="w-full h-full text-emerald-600" viewBox="0 0 100 60" fill="none">
                                <path d="M 15 50 Q 40 20 50 35 T 85 15" stroke="#16a34a" strokeWidth="3" strokeDasharray="4 2" />
                                <circle cx="15" cy="50" r="4" fill="#0f3d23" />
                                <circle cx="85" cy="15" r="4" fill="#dc2626" />
                              </svg>
                              <div className="absolute top-1 left-2 text-[8px] font-bold text-[#0f3d23]">Farm Route</div>
                            </div>

                            <button className="bg-[#1b6b3e] text-white text-[9px] font-bold py-1 px-2 rounded flex items-center justify-center gap-1 w-full">
                              <Navigation className="w-2.5 h-2.5" />
                              <span>Navigate</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {/* Laptop Base Stand */}
                <div className="h-3.5 bg-slate-700 rounded-b-xl max-w-[85%] mx-auto shadow-md" />

                {/* Agricultural Scenery Illustration Strip Under Laptop */}
                <div className="mt-4 rounded-2xl overflow-hidden border border-emerald-200 shadow-md aspect-[16/6] relative">
                  <img
                    src="/assets/niti-hero-field.jpg"
                    alt="Green Agricultural Tractor Field"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d23]/40 to-transparent" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SECTION 2: WHO WE ARE (Exact match to Panel 2)                        */}
      {/* ========================================================================= */}
      <section id="who-we-are" className="py-20 lg:py-28 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Banner: Text + Rural Farmhouse Scene Graphic */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-16">
            
            {/* Left Narrative */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#dcfce7] border border-[#bbf7d0] text-[#15803d] text-xs font-bold tracking-wide">
                <span>About NITI</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0f3d23] tracking-tight">
                Who We Are
              </h2>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                NITI is a technology platform built to bridge the gap between farmers, agricultural machines and the people who operate and manage them. We make farm operations more organized, efficient and accessible through smart scheduling and real-time coordination.
              </p>
            </div>

            {/* Right Graphic: Rural Farmhouse & Tractor Illustration */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg aspect-[16/10] relative group">
                <img
                  src="/assets/niti-farmhouse.jpg"
                  alt="Rural Farmhouse and Green Tractor"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              </div>
            </div>
          </div>

          {/* 4 Cards: Our Vision, Our Mission, Our Impact, Our Values */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Our Vision */}
            <div className="bg-[#f0fdf4] rounded-2xl p-6 border border-[#bbf7d0] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-white text-[#16a34a] flex items-center justify-center shadow-xs mb-4">
                <Leaf className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Our Vision</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                To make agricultural machinery accessible and efficient for every farmer.
              </p>
            </div>

            {/* Card 2: Our Mission */}
            <div className="bg-[#fffbeb] rounded-2xl p-6 border border-[#fde68a] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-white text-[#d97706] flex items-center justify-center shadow-xs mb-4">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Our Mission</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                To connect people, machines and fields through smart coordination.
              </p>
            </div>

            {/* Card 3: Our Impact */}
            <div className="bg-[#eff6ff] rounded-2xl p-6 border border-[#bfdbfe] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-white text-[#2563eb] flex items-center justify-center shadow-xs mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Our Impact</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Better access, organized operations and higher productivity for farmers.
              </p>
            </div>

            {/* Card 4: Our Values */}
            <div className="bg-[#f0fdf4] rounded-2xl p-6 border border-[#bbf7d0] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-white text-[#059669] flex items-center justify-center shadow-xs mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Our Values</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Transparency, efficiency, inclusivity and technology for rural growth.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION 3: HOW WE WORK (Exact match to Panel 3)                       */}
      {/* ========================================================================= */}
      <section id="how-we-work" className="py-20 lg:py-28 bg-[#f8faf8] border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#dcfce7] border border-[#bbf7d0] text-[#15803d] text-xs font-bold tracking-wide">
              <span>Simple Process, Better Farming</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0f3d23] tracking-tight">
              How NITI Works
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              A simple and transparent workflow from request to completed work.
            </p>
          </div>

          {/* 4 Step Workflow Grid with Connecting Arrows */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 relative">
            
            {/* Step 1: Farmer Requests */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative">
              <div>
                {/* Visual Graphic Representation */}
                <div className="h-40 rounded-xl bg-[#f0fdf4] border border-[#dcfce7] p-3 flex flex-col justify-center items-center relative overflow-hidden mb-4">
                  {/* Miniature Request Machine Card */}
                  <div className="w-full bg-white rounded-lg p-2.5 shadow-sm border border-slate-200 space-y-1.5 text-[10px]">
                    <div className="font-bold text-[#0f3d23] border-b border-slate-100 pb-1 flex items-center justify-between">
                      <span>Request Machine</span>
                      <Tractor className="w-3.5 h-3.5 text-[#1b6b3e]" />
                    </div>
                    <div className="text-slate-600 flex items-center justify-between">
                      <span>Operation:</span>
                      <span className="font-bold text-slate-800">Harvesting</span>
                    </div>
                    <div className="text-slate-600 flex items-center justify-between">
                      <span>Area:</span>
                      <span className="font-bold text-slate-800">5 Acres</span>
                    </div>
                    <div className="text-slate-600 flex items-center justify-between">
                      <span>Location:</span>
                      <span className="font-bold text-slate-800">Sunderpur</span>
                    </div>
                    <div className="w-full bg-[#0f3d23] text-white py-1 rounded text-center font-bold text-[9px] mt-1">
                      Submit Request
                    </div>
                  </div>
                </div>

                {/* Number Badge & Title */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#0f3d23] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <h3 className="text-base font-bold text-[#0f3d23]">Farmer Requests</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Farmer submits a machine request with operation type, field area, preferred date and location.
                </p>
              </div>

              {/* Arrow Indicator for Desktop */}
              <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Step 2: CHC Manager Plans */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative">
              <div>
                {/* Visual Graphic Representation: Desktop Manager Screen */}
                <div className="h-40 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] p-3 flex flex-col justify-center items-center relative overflow-hidden mb-4">
                  <div className="w-full bg-slate-900 rounded-lg p-2.5 shadow-sm text-white space-y-1 text-[10px]">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                      <span className="font-bold text-emerald-400">CHC Dispatch Desk</span>
                      <span className="text-[8px] bg-emerald-950 text-emerald-300 px-1 rounded">Online</span>
                    </div>
                    <div className="text-[9px] text-slate-300 pt-1">
                      <div>• Harvester M0001 (Available)</div>
                      <div>• Operator Virendra (Assigned)</div>
                    </div>
                    <div className="bg-[#1b6b3e] text-center text-white py-0.5 rounded text-[8px] font-bold mt-1">
                      Confirm & Create Offer
                    </div>
                  </div>
                </div>

                {/* Number Badge & Title */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#0f3d23] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <h3 className="text-base font-bold text-[#0f3d23]">CHC Manager Plans</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  CHC Manager reviews requests, checks availability and creates offers with suitable machines and operators.
                </p>
              </div>

              {/* Arrow Indicator for Desktop */}
              <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Step 3: Operator Executes */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative">
              <div>
                {/* Visual Graphic Representation: Operator in Field with Tractor */}
                <div className="h-40 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-3 flex flex-col justify-center items-center relative overflow-hidden mb-4">
                  <div className="w-full bg-white rounded-lg p-2.5 shadow-sm border border-slate-200 space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                        VP
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Virendra Patel</div>
                        <div className="text-[8px] text-slate-400">On-field Operator</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] pt-1 border-t border-slate-100">
                      <span>Status:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">En Route / Active</span>
                    </div>
                  </div>
                </div>

                {/* Number Badge & Title */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#0f3d23] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <h3 className="text-base font-bold text-[#0f3d23]">Operator Executes</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Assigned operator reaches the farm, starts the work, updates job status and completes the task.
                </p>
              </div>

              {/* Arrow Indicator for Desktop */}
              <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Step 4: Work Completed */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                {/* Visual Graphic Representation: Job Completed Certificate */}
                <div className="h-40 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] p-3 flex flex-col justify-center items-center relative overflow-hidden mb-4">
                  <div className="w-full bg-white rounded-lg p-2.5 shadow-sm border border-emerald-300 text-center space-y-1 text-[10px]">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                    <div className="font-black text-[#0f3d23] text-xs">Job Completed</div>
                    <div className="text-[9px] text-slate-500">5.0 Acres Harvested</div>
                    <div className="text-[8px] text-emerald-700 font-bold bg-emerald-50 py-0.5 rounded">
                      Sync Verified • 100%
                    </div>
                  </div>
                </div>

                {/* Number Badge & Title */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#0f3d23] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <h3 className="text-base font-bold text-[#0f3d23]">Work Completed</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  All updates are synchronized in real time, keeping farmers, CHC managers and operators on the same page.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECTION 4: FEATURES (Exact match to Panel 4)                          */}
      {/* ========================================================================= */}
      <section id="features" className="py-20 lg:py-28 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="max-w-2xl mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#dcfce7] border border-[#bbf7d0] text-[#15803d] text-xs font-bold tracking-wide">
              <span>Platform Features</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0f3d23] tracking-tight">
              Features
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Everything you need for smooth and efficient farm operations.
            </p>
          </div>

          {/* 6 Feature Cards in 3x2 Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Smart Scheduling */}
            <div className="bg-[#f0fdf4] rounded-2xl p-7 border border-[#bbf7d0] hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white text-[#15803d] flex items-center justify-center shadow-xs mb-5 group-hover:scale-105 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Smart Scheduling</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Automatically plan and assign machines and operators based on availability, location and deadlines.
              </p>
            </div>

            {/* Card 2: Multiple Machines */}
            <div className="bg-[#fffbeb] rounded-2xl p-7 border border-[#fde68a] hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white text-[#d97706] flex items-center justify-center shadow-xs mb-5 group-hover:scale-105 transition-transform">
                <Tractor className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Multiple Machines</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Tractor, harvester, rotavator, sprayer and more — all in one platform.
              </p>
            </div>

            {/* Card 3: Live Tracking */}
            <div className="bg-[#eff6ff] rounded-2xl p-7 border border-[#bfdbfe] hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white text-[#2563eb] flex items-center justify-center shadow-xs mb-5 group-hover:scale-105 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Live Tracking</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Real-time location and job progress for better transparency and coordination.
              </p>
            </div>

            {/* Card 4: Easy Requests */}
            <div className="bg-[#eff6ff] rounded-2xl p-7 border border-[#bfdbfe] hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white text-[#2563eb] flex items-center justify-center shadow-xs mb-5 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Easy Requests</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Simple and quick machine request process for farmers.
              </p>
            </div>

            {/* Card 5: Role-Based Access */}
            <div className="bg-[#f0fdf4] rounded-2xl p-7 border border-[#bbf7d0] hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white text-[#15803d] flex items-center justify-center shadow-xs mb-5 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Role-Based Access</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Dedicated dashboards for Farmers, CHC Managers and Operators.
              </p>
            </div>

            {/* Card 6: Real-Time Updates */}
            <div className="bg-[#fffbeb] rounded-2xl p-7 border border-[#fde68a] hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white text-[#d97706] flex items-center justify-center shadow-xs mb-5 group-hover:scale-105 transition-transform">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0f3d23] mb-2">Real-Time Updates</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Instant notifications at every stage of the job.
              </p>
            </div>

          </div>

          {/* Quick Demo Access Bar at Bottom of Landing Page */}
          <div className="mt-16 p-6 sm:p-8 rounded-3xl bg-[#0f3d23] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Instant Interactive Exploration</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold">Ready to see NITI in action?</h3>
              <p className="text-xs sm:text-sm text-slate-300">
                Experience the live platform end-to-end with one-click demo logins for all three roles.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onDemoLogin('FARMER')}
                className="bg-emerald-500 hover:bg-emerald-400 text-[#0f3d23] px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>Farmer Demo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onDemoLogin('CHC_MANAGER')}
                className="bg-white hover:bg-slate-100 text-[#0f3d23] px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>CHC Manager Demo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onDemoLogin('OPERATOR')}
                className="bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/50 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>Worker Demo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. CLEAN MINIMAL FOOTER                                                   */}
      {/* ========================================================================= */}
      <footer className="bg-[#0b2918] text-slate-400 py-10 border-t border-[#134428]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-white font-bold">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <span>NITI — MACHINE-DAY COMPOSER</span>
          </div>
          <div>
            © {new Date().getFullYear()} NITI. Agricultural Machinery Scheduling & Management. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="text-emerald-400 font-semibold">100% Transparent Process</span>
            <span>•</span>
            <span>English</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
