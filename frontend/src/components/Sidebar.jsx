import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Tractor, 
  Calendar, 
  Tag,
  Bell,
  User,
  Sliders, 
  LogOut, 
  Compass, 
  Headphones,
  MessageSquare,
  Activity,
  Users,
  Leaf,
  FileText,
  BarChart2,
  Settings as CogIcon,
  BookOpen,
  Zap
} from 'lucide-react';
import { supabase } from '../api/supabaseClient';

export const Sidebar = ({ 
  currentRole, 
  activeView, 
  onSelectView, 
  onLogout, 
  pendingBadgeCount,
  lang = 'hi', 
  t 
}) => {
  const isChc = currentRole === 'CHC_MANAGER';
  const [livePendingCount, setLivePendingCount] = useState(0);

  // Synchronize live pending request count for CHC Manager
  useEffect(() => {
    if (currentRole !== 'CHC_MANAGER') return;
    
    let isMounted = true;
    const fetchPending = async () => {
      try {
        if (!supabase) return;
        const { count, error } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('hours', 0);
        if (!error && count != null && isMounted) {
          setLivePendingCount(count);
        }
      } catch (e) {
        console.warn('[Sidebar] fetchPending warning:', e);
      }
    };
    fetchPending();

    if (!supabase) return;
    const channel = supabase.channel('sidebar-broadcast-' + Math.random().toString(36).substring(7));
    channel.on('broadcast', { event: 'new_booking' }, () => {
      setLivePendingCount(prev => prev + 1);
      fetchPending();
    });
    channel.on('broadcast', { event: 'booking_status_updated' }, () => {
      fetchPending();
    });
    channel.on('broadcast', { event: 'booking_deleted' }, () => {
      setLivePendingCount(prev => Math.max(0, prev - 1));
      fetchPending();
    });
    channel.subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentRole]);

  const effectivePending = pendingBadgeCount !== undefined ? pendingBadgeCount : livePendingCount;
  const requestsBadge = effectivePending > 0 ? String(effectivePending) : undefined;

  const getNavItems = () => {
    if (currentRole === 'FARMER') {
      return [
        { id: 'dashboard', icon: Home, labelHi: 'Overview', labelEn: 'Overview' },
        { id: 'request', icon: Tractor, labelHi: 'Request a Machine', labelEn: 'Request a Machine' },
        { id: 'bookings', icon: Calendar, labelHi: 'My Bookings', labelEn: 'My Bookings' },
        { id: 'compare', icon: Tag, labelHi: 'Compare Offers', labelEn: 'Compare Offers' },
        { id: 'updates', icon: Bell, labelHi: 'Live Updates', labelEn: 'Live Updates' },
        { id: 'settings', icon: User, labelHi: 'Profile & Settings', labelEn: 'Profile & Settings' },
      ];
    }
    if (currentRole === 'CHC_MANAGER') {
      return [
        { id: 'dashboard', icon: Home, labelHi: 'Dashboard', labelEn: 'Dashboard' },
        { id: 'recovery', icon: Zap, labelHi: 'Breakdown Recovery (USP)', labelEn: 'Breakdown Recovery (USP)', badge: '⚡ USP' },
        { id: 'requests', icon: FileText, labelHi: 'Service Requests', labelEn: 'Service Requests', badge: requestsBadge },
        { id: 'schedule', icon: Calendar, labelHi: 'Schedule & Assign', labelEn: 'Schedule & Assign' },
        { id: 'machines', icon: Tractor, labelHi: 'Machines', labelEn: 'Machines' },
        { id: 'operators', icon: User, labelHi: 'Operators', labelEn: 'Operators' },
        { id: 'bookings', icon: BookOpen, labelHi: 'Bookings', labelEn: 'Bookings' },
        { id: 'reports', icon: BarChart2, labelHi: 'Reports', labelEn: 'Reports' },
        { id: 'settings', icon: CogIcon, labelHi: 'Settings', labelEn: 'Settings' },
      ];
    }
    if (currentRole === 'ADMIN') {
      return [
        { id: 'admin', icon: Home, labelHi: 'प्रशासन डैशबोर्ड', labelEn: 'Admin Dashboard' },
        { id: 'catalog', icon: Compass, labelHi: 'मशीनरी कैटलॉग', labelEn: 'Equipment Catalog' },
      ];
    }
    if (currentRole === 'OPERATOR') {
      return [
        { id: 'dashboard', icon: Home, labelHi: 'ऑपरेटर होम', labelEn: 'Operator Home' },
        { id: 'jobs', icon: Tractor, labelHi: 'आवंटित कार्य', labelEn: 'Assigned Jobs' },
        { id: 'catalog', icon: Compass, labelHi: 'कैटलॉग', labelEn: 'Machinery' },
      ];
    }

    // Default / Public
    return [
      { id: 'catalog', icon: Compass, labelHi: 'मशीनरी कैटलॉग', labelEn: 'Machinery Catalog' },
      { id: 'admin', icon: BarChart2, labelHi: 'प्रशासन अवलोकन', labelEn: 'Admin Overview' },
    ];
  };

  const navItems = getNavItems();

  if (isChc) {
    // CHC Manager Sidebar — Exact Match to CHC Screenshot
    return (
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200/90 text-gray-800 min-h-screen p-5 justify-between shrink-0 sticky top-0 z-30 shadow-xs select-none">
        <div className="space-y-6">
          {/* Brand Header: Green tractor with field lines + Machine-Day Composer */}
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Tractor className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <span className="text-lg font-black text-gray-900 tracking-tight block leading-tight">
                Machine-Day
              </span>
              <span className="text-base font-extrabold text-emerald-800 block leading-tight">
                Composer
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id || (item.id === 'dashboard' && (!activeView || activeView === 'dashboard'));

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#134e2e] text-white shadow-xs'
                      : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                    <span className="truncate">{item.labelEn}</span>
                  </div>
                  {item.badge && (
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Farm Landscape Watermark Illustration */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="opacity-80 pointer-events-none select-none flex items-center justify-center py-2">
            <svg className="w-full h-16 text-emerald-700 fill-current" viewBox="0 0 200 55">
              <path d="M0,55 L200,55 L200,42 Q180,36 160,42 Q140,30 120,40 Q100,28 80,38 Q60,32 40,44 Q20,38 0,48 Z" opacity="0.25" />
              <path d="M12,48 L22,34 L32,48 Z M28,40 L40,40 L40,48 Z M130,42 L145,26 L160,42 Z M142,42 L142,32 L152,32 L152,42 Z" opacity="0.45" />
              <circle cx="170" cy="24" r="7" opacity="0.3" />
              <path d="M164,32 L176,32 L176,40 L164,40 Z" opacity="0.3" />
              {/* Little tractor silhouette */}
              <circle cx="65" cy="46" r="5" opacity="0.7" />
              <circle cx="80" cy="48" r="3.5" opacity="0.7" />
              <path d="M65,42 L74,42 L77,46 L62,46 Z" opacity="0.7" />
            </svg>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>लॉगआउट (Logout)</span>
          </button>
        </div>
      </aside>
    );
  }

  // Farmer Sidebar — Dark Green Theme matching Farmer Screenshot
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#0e3822] text-white min-h-screen p-5 justify-between shrink-0 sticky top-0 z-30 shadow-xl select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Leaf className="w-6 h-6 fill-emerald-400 text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white tracking-wider block leading-tight">
              NITI
            </span>
            <span className="text-[8.5px] text-emerald-300 font-bold tracking-[0.16em] uppercase block">
              CHC SCHEDULING PLATFORM
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1b6b3e] text-white shadow-md shadow-black/20'
                    : 'text-emerald-100/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-emerald-300/80'}`} />
                <span className="truncate">{lang === 'hi' ? item.labelHi : item.labelEn}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Help Box & Illustration Watermark */}
      <div className="space-y-4 pt-4 border-t border-emerald-800/60 relative">
        <div className="p-3.5 rounded-2xl bg-[#14472d] border border-emerald-700/50 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Need Help?</div>
              <div className="text-[11px] text-emerald-200/80">Call our support team</div>
              <a href="tel:18001234567" className="text-xs font-bold text-emerald-300 hover:underline block mt-0.5">
                1800 123 4567
              </a>
            </div>
          </div>

          <a 
            href="#chat" 
            onClick={(e) => { e.preventDefault(); alert(lang === 'hi' ? 'नीति सहायक चैट शीघ्र उपलब्ध होगा' : 'NITI Chat Support is opening...'); }}
            className="w-full py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
            <span>Chat with Us</span>
          </a>
        </div>

        {/* Farm silhouette illustration footer */}
        <div className="opacity-35 pointer-events-none select-none flex items-center justify-center pt-1">
          <svg className="w-full h-12 text-emerald-300 fill-current" viewBox="0 0 200 45">
            <path d="M0,45 L200,45 L200,35 Q180,30 160,35 Q140,25 120,33 Q100,20 80,32 Q60,25 40,36 Q20,30 0,40 Z" opacity="0.3" />
            <path d="M10,40 L18,28 L26,40 Z M22,33 L32,33 L32,40 Z M130,35 L145,22 L160,35 Z M140,35 L140,28 L150,28 L150,35 Z" opacity="0.5" />
            <circle cx="170" cy="20" r="6" opacity="0.4" />
            <path d="M165,26 L175,26 L175,32 L165,32 Z" opacity="0.4" />
          </svg>
        </div>

        {currentRole && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'hi' ? 'लॉगआउट (Logout)' : 'Logout'}</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
