import React from 'react';
import { 
  Home, 
  Tractor, 
  Calendar, 
  Activity, 
  User, 
  Compass, 
  PlusCircle,
  Sliders
} from 'lucide-react';

export const BottomNav = ({ 
  currentRole, 
  activeView, 
  onSelectView, 
  lang = 'hi', 
  t 
}) => {
  // Mobile bottom navigation items based on active role
  const getItems = () => {
    if (currentRole === 'FARMER') {
      return [
        { id: 'dashboard', icon: Home, labelHi: 'Home', labelEn: 'Home' },
        { id: 'bookings', icon: Calendar, labelHi: 'Bookings', labelEn: 'Bookings' },
        { id: 'request', icon: Tractor, labelHi: 'Request', labelEn: 'Request', highlight: true },
        { id: 'updates', icon: Activity, labelHi: 'Updates', labelEn: 'Updates' },
        { id: 'settings', icon: Sliders, labelHi: 'Profile', labelEn: 'Profile' },
      ];
    }
    if (currentRole === 'CHC_MANAGER') {
      return [
        { id: 'dashboard', icon: Home, labelHi: 'सीएचसी', labelEn: 'CHC' },
        { id: 'fleet', icon: Tractor, labelHi: 'बेड़ा', labelEn: 'Fleet' },
        { id: 'bookings', icon: Calendar, labelHi: 'ऑर्डर', labelEn: 'Orders' },
        { id: 'catalog', icon: Compass, labelHi: 'कैटलॉग', labelEn: 'Catalog' },
      ];
    }
    if (currentRole === 'OPERATOR') {
      return [
        { id: 'dashboard', icon: Home, labelHi: 'होम', labelEn: 'Home' },
        { id: 'jobs', icon: Tractor, labelHi: 'कार्य', labelEn: 'Jobs' },
        { id: 'catalog', icon: Compass, labelHi: 'कैटलॉग', labelEn: 'Catalog' },
      ];
    }
    return [
      { id: 'catalog', icon: Compass, labelHi: 'कैटलॉग', labelEn: 'Catalog' },
      { id: 'how-it-works', icon: Activity, labelHi: 'सुविधाएं', labelEn: 'Features' },
    ];
  };

  const items = getItems();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-niti-forest/15 px-3 py-2 shadow-2xl safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="w-12 h-12 rounded-full bg-niti-forest text-white flex items-center justify-center shadow-lg shadow-niti-forest/30 border-2 border-white">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-niti-forest mt-0.5">
                  {lang === 'hi' ? item.labelHi : item.labelEn}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
                isActive ? 'text-niti-forest font-bold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] truncate max-w-[60px]">
                {lang === 'hi' ? item.labelHi : item.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
