import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { RoleAuthModal } from './components/RoleAuthModal';
import { FarmerOnboardingModal } from './components/FarmerOnboardingModal';
import { FarmerDashboard } from './components/FarmerDashboard';
import { ChcDashboard } from './components/ChcDashboard';
import { ChcLoginPage } from './components/ChcLoginPage';
import { OperatorDashboard } from './components/OperatorDashboard';
import { SettingsView } from './components/SettingsView';
import { NitiLandingPage } from './components/NitiLandingPage';
import { NitiLoginPage } from './components/NitiLoginPage';

import BookingModal from './components/BookingModal';
import ListEquipmentModal from './components/ListEquipmentModal';

import { AdminDashboard } from './components/AdminDashboard';
import { nitiClient } from './api/nitiClient';
import { supabase } from './api/supabaseClient';
import { translations } from './data/translations';

export default function App() {
  const [lang, setLang] = useState('en'); // Always default to English as requested
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [farmerProfile, setFarmerProfile] = useState(null);
  const [activeView, setActiveView] = useState('catalog'); // default to pure landing page if unauthenticated
  
  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialRole, setAuthInitialRole] = useState('FARMER');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [listModalOpen, setListModalOpen] = useState(false);

  const t = translations[lang] || translations.en;

  // 1-Click Demo Login for all 3 dashboards (Farmer, CHC Manager, Worker)
  const handleOneClickDemo = (role) => {
    let demoUser;
    if (role === 'FARMER') {
      demoUser = {
        id: 'F0001',
        farmer_id: 'F0001',
        user_id: 'F0001',
        full_name: 'Ajay Verma',
        name: 'Ajay Verma',
        email: 'farmer.ajay@niti.in',
        phone_number: '+919876543210',
        phone: '+919876543210',
        village: 'Dhanipur Kalan',
        district: 'Agra',
        region: 'Western',
        state: 'Uttar Pradesh',
        farm_size: 1.19,
        farm_size_unit: 'acres',
        primary_crops: 'Bajra, Wheat',
        preferred_language: 'en',
        onboarding_completed: true,
        role: 'FARMER'
      };
      setFarmerProfile(demoUser);
    } else if (role === 'CHC_MANAGER') {
      demoUser = {
        id: 'CHC001',
        centre_id: 'CHC001',
        user_id: 'CHC001',
        full_name: 'Ramesh Patel',
        name: 'CHC Pur Kalan',
        centre_name: 'CHC Pur Kalan',
        email: 'manager.chc001@niti.in',
        phone_number: '+919876500001',
        village: 'Gaon',
        district: 'Aligarh',
        region: 'Western',
        state: 'Uttar Pradesh',
        role: 'CHC_MANAGER'
      };
    } else {
      demoUser = {
        id: 'OP001',
        operator_id: 'OP001',
        user_id: 'OP001',
        full_name: 'Virendra Patel',
        name: 'Virendra Patel',
        email: 'operator.virendra@niti.in',
        phone_number: '+919876500034',
        village: 'Rampur Majra',
        district: 'Sitapur',
        centre_id: 'CHC025',
        skills: 'Happy Seeder, Tractor',
        experience_years: 15,
        role: 'OPERATOR'
      };
    }

    nitiClient.setSession('demo-token-' + role, demoUser, role);
    handleLoginSuccess({ user: demoUser, role: role, access_token: 'demo-token-' + role });
  };

  // Initialize session on mount
  useEffect(() => {
    try {
      const user = nitiClient.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        const rawRole = nitiClient.getCurrentRole() || user.role || 'FARMER';
        const role = String(rawRole).toUpperCase();
        setCurrentRole(role);

        const currentHash = window.location.hash.replace('#', '');
        if (currentHash && currentHash !== 'login' && currentHash !== 'catalog') {
          setActiveView(currentHash);
        } else {
          setActiveView(role === 'CHC_MANAGER' ? 'dashboard' : (role === 'ADMIN' ? 'admin' : 'dashboard'));
        }

        if (role === 'FARMER') {
          loadFarmerProfile();
        }
      } else {
        const currentHash = window.location.hash.replace('#', '');
        if (currentHash === 'login' || currentHash === 'chc-login') {
          setActiveView(currentHash);
        } else {
          setActiveView('catalog');
        }
      }
    } catch (err) {
      console.warn('Session init error:', err);
      setActiveView('catalog');
    }

    // Connect Supabase Auth state listener if available
    let authListener;
    if (supabase) {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            const userMeta = session.user.user_metadata || {};
            const role = (userMeta.role || 'FARMER').toUpperCase();
            const authUser = {
              user_id: session.user.id,
              email: session.user.email,
              full_name: userMeta.full_name || session.user.email,
              role,
            };
            setCurrentUser(authUser);
            setCurrentRole(role);
            if (role === 'FARMER') {
              loadFarmerProfile();
            }
          }
        });
        authListener = subscription;
      } catch (e) {
        console.warn('Could not attach Supabase auth listener:', e);
      }
    }

    return () => {
      authListener?.unsubscribe?.();
    };
  }, []);

  const loadFarmerProfile = async () => {
    try {
      const prof = await nitiClient.getFarmerProfile();
      if (prof) {
        setFarmerProfile(prof);
        if (prof.preferred_language && prof.preferred_language !== 'hi') {
          setLang(prof.preferred_language);
        }
        if (prof.onboarding_completed === false) {
          setOnboardingOpen(true);
        }
      }
    } catch (err) {
      console.warn('Could not load profile from database:', err);
      const curr = nitiClient.getCurrentUser();
      if (curr) {
        setFarmerProfile(curr);
      }
    }
  };

  const handleLoginSuccess = (loginData) => {
    localStorage.removeItem('niti_logged_out');
    setCurrentUser(loginData.user);
    setCurrentRole(loginData.role);
    setAuthModalOpen(false);
    setActiveView(loginData.role === 'ADMIN' ? 'admin' : 'dashboard');

    if (loginData.role === 'FARMER') {
      loadFarmerProfile();
      if (loginData.needs_onboarding) {
        setOnboardingOpen(true);
      }
    }
  };

  const handleLogout = async () => {
    nitiClient.logout();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signout failed:', e);
      }
    }
    localStorage.setItem('niti_logged_out', 'true');
    setCurrentUser(null);
    setCurrentRole(null);
    setFarmerProfile(null);
    setActiveView('catalog');
  };

  const openAuthWithRole = (role) => {
    setAuthInitialRole(role || 'FARMER');
    handleSelectView('login');
  };

  // Central view selector with browser back/forward history synchronization
  const handleSelectView = (view) => {
    setActiveView(view);
    if (window.location.hash !== `#${view}`) {
      window.location.hash = view;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== activeView) {
        setActiveView(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeView]);

  return (
    <div className="min-h-screen bg-niti-cream text-gray-800 flex flex-col font-sans">
      {/* Top Navbar only shown for authenticated dashboard views on mobile or split-screen login */}
      {currentUser && (
        <div className={(currentRole === 'FARMER' || currentRole === 'CHC_MANAGER' || currentRole === 'OPERATOR') ? 'lg:hidden' : ''}>
          <Navbar
            lang={lang}
            setLang={setLang}
            currentUser={currentUser}
            currentRole={currentRole}
            onOpenAuth={openAuthWithRole}
            onLogout={handleLogout}
            onSelectView={handleSelectView}
            activeView={activeView}
          />
        </div>
      )}

      {/* Unauthenticated Landing Page vs. Modern Sky-Blue Login Page */}
      {!currentUser ? (
        (activeView === 'login' || activeView === 'chc-login') ? (
          <NitiLoginPage
            initialRole={authInitialRole}
            onLoginSuccess={handleLoginSuccess}
            onBackToLanding={() => handleSelectView('catalog')}
            onDemoLogin={handleOneClickDemo}
            lang={lang}
          />
        ) : (
          <NitiLandingPage
            onOpenLogin={openAuthWithRole}
            onDemoLogin={handleOneClickDemo}
          />
        )
      ) : (
        <div className="flex-1 flex w-full">
          {/* Desktop Sidebar for authenticated users */}
          {currentRole !== 'OPERATOR' && (
            <Sidebar
              currentRole={currentRole || 'FARMER'}
              activeView={activeView}
              onSelectView={handleSelectView}
              onLogout={handleLogout}
              lang={lang}
              t={t}
            />
          )}

          {/* Main Content Area */}
          <main className={currentRole === 'OPERATOR' ? 'w-full' : 'flex-1 min-w-0'}>
            {/* If Role is CHC_MANAGER */}
            {currentRole === 'CHC_MANAGER' ? (
              <ChcDashboard
                currentUser={currentUser}
                activeSubView={activeView}
                onSelectSubView={handleSelectView}
                onLogout={handleLogout}
                lang={lang}
                t={t}
              />
            ) : currentRole === 'OPERATOR' ? (
              /* If Role is OPERATOR */
              <OperatorDashboard
                onLogout={handleLogout}
                lang={lang}
                t={t}
              />
            ) : (currentRole === 'ADMIN' || activeView === 'admin') ? (
              /* If Role is ADMIN */
              <AdminDashboard
                lang={lang}
                t={t}
              />
            ) : activeView === 'settings' ? (
              /* Settings View */
              <SettingsView
                farmerProfile={farmerProfile}
                onProfileUpdated={setFarmerProfile}
                onBack={() => setActiveView('dashboard')}
                lang={lang}
                t={t}
                onToggleLang={() => setLang(prev => prev === 'en' ? 'hi' : 'en')}
              />
            ) : (
              /* Default & Farmer Dashboard */
              <FarmerDashboard
                farmerProfile={farmerProfile}
                currentUser={currentUser}
                onUpdateProfile={setFarmerProfile}
                onOpenSettings={() => handleSelectView('settings')}
                activeView={activeView}
                onSelectView={handleSelectView}
                lang={lang}
                t={t}
              />
            )}
          </main>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Authenticated only) */}
      {currentUser && (
        <BottomNav
          currentRole={currentRole}
          activeView={activeView}
          onSelectView={handleSelectView}
          lang={lang}
          t={t}
        />
      )}

      {/* 3-Role Auth Modal */}
      <RoleAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole={authInitialRole}
        onLoginSuccess={handleLoginSuccess}
        onDemoLogin={handleOneClickDemo}
        onOpenSplitScreenChc={() => {
          setAuthModalOpen(false);
          setActiveView('chc-login');
        }}
        lang={lang}
        t={t}
      />

      {/* 3-Step Farmer Onboarding Wizard */}
      <FarmerOnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        existingProfile={farmerProfile}
        onSaveProfile={(updated) => {
          setFarmerProfile(updated);
          setOnboardingOpen(false);
        }}
        lang={lang}
        t={t}
      />

      {/* Legacy Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        equipment={selectedEquipment}
        lang={lang}
      />

      {/* Legacy List Equipment Modal */}
      <ListEquipmentModal
        isOpen={listModalOpen}
        onClose={() => setListModalOpen(false)}
        lang={lang}
        onListingAdded={() => alert(lang === 'en' ? 'Machine registered!' : 'मशीन दर्ज हो गई!')}
      />
    </div>
  );
}
