import React, { useState } from 'react';
import { 
  Tractor, 
  Globe, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Phone, 
  Sparkles, 
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

export default function Navbar({ 
  lang = 'hi', 
  setLang, 
  currentUser, 
  currentRole, 
  onOpenAuth, 
  onLogout, 
  onSelectView, 
  activeView 
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const toggleLanguage = () => {
    setLang(prev => (prev === 'en' ? 'hi' : 'en'));
  };

  return (
    <>
      {/* Top Kisan Helpline Ribbon */}
      <div className="bg-niti-forest text-white py-1.5 px-4 text-xs font-medium border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-niti-forest font-black px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
              {lang === 'hi' ? 'आवाज़-आधारित कृषि मंच' : 'VOICE-FIRST PLATFORM'}
            </span>
            <span className="hidden sm:inline text-white/90">
              {lang === 'hi' ? 'नीति (NITI) — किसान, सीएचसी एवं ऑपरेटर का साझा नेटवर्क' : 'NITI — Unified Agricultural Machinery Scheduling'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="tel:18001206484" 
              className="flex items-center gap-1.5 text-white/90 hover:text-white font-semibold transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-amber-300" />
              <span>1800-120-NITI (6484)</span>
            </a>

            {/* Language Switcher Button */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              title="Toggle English / हिंदी"
            >
              <Globe className="w-3.5 h-3.5 text-amber-300" />
              <span>{lang === 'en' ? 'हिन्दी में देखें' : 'English'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Sticky Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-niti-forest/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-18">
          {/* Logo & Brand */}
          <div 
            onClick={() => onSelectView('dashboard')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-11 h-11 rounded-2xl bg-niti-forest flex items-center justify-center text-white shadow-md shadow-niti-forest/20">
              <Tractor className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-niti-forest tracking-tight">
                  NITI
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-niti-mint text-niti-forest font-extrabold border border-niti-forest/20">
                  {lang === 'hi' ? 'नीति' : 'AGRI'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">
                {lang === 'hi' ? 'बोलकर मशीन बुक करें' : 'Voice-First Machinery Scheduling'}
              </p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onSelectView('dashboard')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                activeView === 'dashboard' 
                  ? 'bg-niti-mint text-niti-forest' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {lang === 'hi' ? 'डैशबोर्ड' : 'Dashboard'}
            </button>

            {currentRole === 'FARMER' && (
              <>
                <button
                  onClick={() => onSelectView('request')}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                    activeView === 'request' 
                      ? 'bg-niti-mint text-niti-forest' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {lang === 'hi' ? 'मशीन अनुरोध' : 'Request Machine'}
                </button>
                <button
                  onClick={() => onSelectView('bookings')}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                    activeView === 'bookings' 
                      ? 'bg-niti-mint text-niti-forest' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {lang === 'hi' ? 'मेरी बुकिंग्स' : 'My Bookings'}
                </button>
              </>
            )}

            <button
              onClick={() => onSelectView('catalog')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                activeView === 'catalog' 
                  ? 'bg-niti-mint text-niti-forest' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {lang === 'hi' ? 'मशीनरी कैटलॉग' : 'Equipment Catalog'}
            </button>

            <button
              onClick={() => onSelectView('admin')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                activeView === 'admin' 
                  ? 'bg-niti-mint text-niti-forest' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {lang === 'hi' ? 'प्रशासन (Admin)' : 'Admin'}
            </button>
          </nav>

          {/* Right Role / Auth controls */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div 
                  onClick={() => onSelectView('settings')}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-niti-forest text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.full_name ? currentUser.full_name[0] : 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="text-xs font-bold text-gray-900 block truncate max-w-[120px]">
                      {currentUser.full_name || 'User'}
                    </span>
                    <span className="text-[10px] text-niti-forest font-semibold block">
                      {currentRole === 'FARMER' && (lang === 'hi' ? 'किसान (Farmer)' : 'Farmer')}
                      {currentRole === 'CHC_MANAGER' && 'CHC Centre'}
                      {currentRole === 'OPERATOR' && (lang === 'hi' ? 'चालक (Operator)' : 'Operator')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('FARMER')}
                  className="px-4 py-2.5 rounded-xl bg-niti-forest hover:bg-niti-moss text-white text-xs md:text-sm font-bold shadow-md shadow-niti-forest/20 transition-all flex items-center gap-1.5"
                >
                  <User className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'लॉगिन / प्रवेश' : 'Sign In / Roles'}</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2 animate-fade-in shadow-xl">
            <button
              onClick={() => { onSelectView('dashboard'); setMobileMenuOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50"
            >
              {lang === 'hi' ? 'डैशबोर्ड' : 'Dashboard'}
            </button>
            <button
              onClick={() => { onSelectView('catalog'); setMobileMenuOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50"
            >
              {lang === 'hi' ? 'मशीनरी कैटलॉग' : 'Equipment Catalog'}
            </button>
            <button
              onClick={() => { onSelectView('admin'); setMobileMenuOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50"
            >
              {lang === 'hi' ? 'प्रशासन (Admin)' : 'Admin Dashboard'}
            </button>

            {currentUser ? (
              <>
                <button
                  onClick={() => { onSelectView('settings'); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50"
                >
                  {lang === 'hi' ? 'खाता सेटिंग्स' : 'Account Settings'}
                </button>
                <button
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  {lang === 'hi' ? 'लॉगआउट' : 'Logout'}
                </button>
              </>
            ) : (
              <div className="pt-2 border-t border-gray-100 space-y-1.5">
                <button
                  onClick={() => { onOpenAuth('FARMER'); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-niti-forest bg-niti-mint"
                >
                  👨‍🌾 {lang === 'hi' ? 'किसान लॉगिन' : 'Farmer Login'}
                </button>
                <button
                  onClick={() => { onOpenAuth('CHC_MANAGER'); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50"
                >
                  🏢 {lang === 'hi' ? 'सीएचसी लॉगिन' : 'CHC Login'}
                </button>
                <button
                  onClick={() => { onOpenAuth('OPERATOR'); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50"
                >
                  🚜 {lang === 'hi' ? 'ऑपरेटर लॉगिन' : 'Operator Login'}
                </button>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
