import React, { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TrustStrip from './components/TrustStrip';
import CategoriesSection from './components/CategoriesSection';
import HowItWorks from './components/HowItWorks';
import EquipmentListings from './components/EquipmentListings';
import InteractiveMap from './components/InteractiveMap';
import BenefitsSection from './components/BenefitsSection';
import TestimonialsSection from './components/TestimonialsSection';
import HelplineSupport from './components/HelplineSupport';
import FaqSection from './components/FaqSection';
import Footer from './components/Footer';
import BookingModal from './components/BookingModal';
import ListEquipmentModal from './components/ListEquipmentModal';

export default function App() {
  // Master language state: 'en' (English) or 'hi' (Hindi)
  const [lang, setLang] = useState('en');

  // Search filter parameters
  const [filterParams, setFilterParams] = useState({
    state: 'all',
    district: '',
    category: 'all',
  });

  // Modal dialog states
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [listModalOpen, setListModalOpen] = useState(false);

  // Search handler from Hero search bar
  const handleHeroSearch = ({ state, district, category }) => {
    setFilterParams({
      state: state || 'all',
      district: district || '',
      category: category || 'all',
    });
  };

  // Category select handler from Categories section
  const handleCategorySelect = (categoryId) => {
    setFilterParams((prev) => ({ ...prev, category: categoryId }));
    const el = document.getElementById('listings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // State select handler from Interactive Map section
  const handleStateSelect = (stateName) => {
    setFilterParams((prev) => ({ ...prev, state: stateName }));
  };

  // Open booking modal
  const handleBookNow = (item) => {
    setSelectedEquipment(item);
    setBookingModalOpen(true);
  };

  // Open enquire modal
  const handleEnquire = (item) => {
    setSelectedEquipment(item);
    setBookingModalOpen(true);
  };

  const handleResetFilters = () => {
    setFilterParams({ state: 'all', district: '', category: 'all' });
  };

  const scrollToRent = () => {
    const el = document.getElementById('listings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FAFAF5' }}>
      
      {/* 1. STICKY HEADER WITH LANGUAGE TOGGLE & PROMINENT CTAs */}
      <Navbar
        lang={lang}
        setLang={setLang}
        onRentClick={scrollToRent}
        onListClick={() => setListModalOpen(true)}
      />

      {/* 2. HERO SECTION WITH FARMER PHOTO, HEADLINE & SEARCH BAR */}
      <HeroSection
        lang={lang}
        onSearch={handleHeroSearch}
        onListClick={() => setListModalOpen(true)}
      />

      {/* 3. TRUST AND HIGHLIGHTS STRIP (4 BENEFITS + LIVE COUNTERS) */}
      <TrustStrip lang={lang} />

      {/* 4. EQUIPMENT CATEGORIES SECTION (8 CARDS WITH STARTING PRICES) */}
      <CategoriesSection
        lang={lang}
        onSelectCategory={handleCategorySelect}
      />

      {/* 5. HOW IT WORKS (4-STEP TIMELINE WITH FARMER & OWNER FLOWS) */}
      <HowItWorks
        lang={lang}
        onListClick={() => setListModalOpen(true)}
      />

      {/* 6. FEATURED EQUIPMENT LISTINGS (WITH ADVANCED FILTERING & BOOKING) */}
      <EquipmentListings
        lang={lang}
        filterParams={filterParams}
        onResetFilters={handleResetFilters}
        onBookItem={handleBookNow}
        onEnquireItem={handleEnquire}
      />

      {/* 7. INTERACTIVE MAP SECTION (16 PAN-INDIA STATES WITH DISTRICTS) */}
      <InteractiveMap
        lang={lang}
        onSelectStateFilter={handleStateSelect}
      />

      {/* 8. BENEFITS SECTION (TWO-COLUMN FOR FARMERS & OWNERS) */}
      <BenefitsSection
        lang={lang}
        onListClick={() => setListModalOpen(true)}
      />

      {/* 9. TESTIMONIALS (FARMER STORIES & RENTER STORIES) */}
      <TestimonialsSection lang={lang} />

      {/* 10. HELPLINE AND SUPPORT (TOLL-FREE, WHATSAPP & CALLBACK FORM) */}
      <HelplineSupport lang={lang} />

      {/* 11. FAQ ACCORDION SECTION */}
      <FaqSection lang={lang} />

      {/* 12. RURAL-FRIENDLY FOOTER */}
      <Footer lang={lang} />

      {/* INTERACTIVE MODALS */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        equipment={selectedEquipment}
        lang={lang}
      />

      <ListEquipmentModal
        isOpen={listModalOpen}
        onClose={() => setListModalOpen(false)}
        lang={lang}
        onListingAdded={(newListing) => {
          alert(lang === 'en' ? 'Machine submitted! Live verification active.' : 'मशीन विवरण दर्ज हो गया है!');
        }}
      />

    </div>
  );
}
