import React, { useState } from 'react';
import { Tractor, MapPin, Star, Phone, CheckCircle, Calendar, SlidersHorizontal, Fuel, UserCheck, ShieldCheck } from 'lucide-react';
import { sampleEquipmentListings, equipmentCategories, statesCoverage } from '../data/agriData';

export default function EquipmentListings({
  lang,
  filterParams,
  onResetFilters,
  onBookItem,
  onEnquireItem
}) {
  const [selectedCategory, setSelectedCategory] = useState(filterParams.category || 'all');
  const [selectedState, setSelectedState] = useState(filterParams.state || 'all');
  const [selectedOwnerType, setSelectedOwnerType] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);

  // Filter listings based on controls
  const filteredListings = sampleEquipmentListings.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedState !== 'all' && item.state !== selectedState) return false;
    if (selectedOwnerType !== 'all' && item.ownerType !== selectedOwnerType) return false;
    if (availableOnly && item.status !== 'Available') return false;
    return true;
  });

  return (
    <section id="listings" className="section-py" style={{ backgroundColor: '#FAFAF5', borderTop: '1px solid #E0E0D8' }}>
      <div className="container">
        
        {/* Section Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '750px', margin: '0 auto 2.5rem auto' }}>
          <div className="section-badge">
            <Tractor size={16} />
            <span>{lang === 'en' ? 'FEATURED EQUIPMENT DIRECTORY' : 'उपलब्ध कृषि मशीनें व ट्रैक्टर'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'Verified Machinery Available for Rent' : 'किराए के लिए सत्यापित ट्रैक्टर व उपकरण'}
          </h2>

          <p className="section-subtitle">
            {lang === 'en'
              ? 'Connect directly with verified equipment owners and CHCs. Transparent rates, genuine specifications, and instant bookings.'
              : 'पारदर्शी दरें, प्रामाणिक मशीनें और शून्य कमीशन। सीधे मशीन मालिक से बात करें या ऑनलाइन बुक करें।'}
          </p>
        </div>

        {/* Filter Toolbar Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '1.25rem',
            border: '1.5px solid #E0E0D8',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            marginBottom: '2rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #EAEAE0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#1B5E20' }}>
              <SlidersHorizontal size={18} />
              <span>{lang === 'en' ? 'Filter Equipment Listings:' : 'मशीनें फ़िल्टर करें:'}</span>
              <span style={{ backgroundColor: '#E8F5E9', color: '#1B5E20', fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 700 }}>
                {filteredListings.length} {lang === 'en' ? 'Found' : 'उपलब्ध'}
              </span>
            </div>

            {(selectedCategory !== 'all' || selectedState !== 'all' || selectedOwnerType !== 'all' || availableOnly) && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedState('all');
                  setSelectedOwnerType('all');
                  setAvailableOnly(false);
                  onResetFilters();
                }}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#C62828',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {lang === 'en' ? 'Reset All Filters (फ़िल्टर साफ़ करें)' : 'सभी फ़िल्टर साफ़ करें'}
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              alignItems: 'center'
            }}
          >
            {/* Filter 1: Equipment Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.35rem' }}>
                {lang === 'en' ? 'Equipment Category' : 'उपकरण प्रकार'}
              </label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ height: '42px', minHeight: '42px', fontSize: '0.9rem' }}
              >
                <option value="all">{lang === 'en' ? 'All Equipment (सभी प्रकार)' : 'सभी प्रकार के उपकरण'}</option>
                {equipmentCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name[lang]}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: State */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.35rem' }}>
                {lang === 'en' ? 'State' : 'राज्य'}
              </label>
              <select
                className="form-select"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                style={{ height: '42px', minHeight: '42px', fontSize: '0.9rem' }}
              >
                <option value="all">{lang === 'en' ? 'All States (सभी राज्य)' : 'सभी राज्य'}</option>
                {statesCoverage.map((s) => (
                  <option key={s.name} value={s.name}>{lang === 'en' ? s.name : s.nameHi}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Owner Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.35rem' }}>
                {lang === 'en' ? 'Owner Type' : 'मालिक का प्रकार'}
              </label>
              <select
                className="form-select"
                value={selectedOwnerType}
                onChange={(e) => setSelectedOwnerType(e.target.value)}
                style={{ height: '42px', minHeight: '42px', fontSize: '0.9rem' }}
              >
                <option value="all">{lang === 'en' ? 'All Owners (सभी मालिक)' : 'सभी (किसान व CHC)'}</option>
                <option value="Farmer">{lang === 'en' ? 'Farmer Owner' : 'किसान मालिक'}</option>
                <option value="Custom Hiring Centre">{lang === 'en' ? 'Custom Hiring Centre (CHC)' : 'कस्टम हायरिंग सेंटर (CHC)'}</option>
              </select>
            </div>

            {/* Filter 4: Available Only Checkbox */}
            <div style={{ paddingTop: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, color: '#1B5E20' }}>
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#1B5E20' }}
                />
                <span>{lang === 'en' ? 'Show Available Only' : 'केवल तुरंत उपलब्ध दिखाएं'}</span>
              </label>
            </div>

          </div>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1.5px dashed #C8E6C9' }}>
            <Tractor size={48} style={{ color: '#A5D6A7', margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1B5E20', marginBottom: '0.5rem' }}>
              {lang === 'en' ? 'No Equipment Matching Your Filter' : 'आपके चुने फ़िल्टर में कोई मशीन नहीं मिली'}
            </h3>
            <p style={{ color: '#555555', marginBottom: '1.5rem' }}>
              {lang === 'en' ? 'Try clearing state or category filters to see nearby machinery.' : 'अन्य राज्य या श्रेणी चुनकर देखें, या कॉल बैक अनुरोध भेजें।'}
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedState('all');
                setSelectedOwnerType('all');
                setAvailableOnly(false);
              }}
              className="btn btn-primary"
            >
              {lang === 'en' ? 'Clear All Filters' : 'सभी फ़िल्टर साफ़ करें'}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {filteredListings.map((item) => (
              <div
                key={item.id}
                className="agri-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {/* Equipment Photo with Status Badge */}
                  <div style={{ position: 'relative', height: '210px', width: '100%', overflow: 'hidden', backgroundColor: '#E0E0D8' }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />

                    {/* Status Badge */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span className={item.status === 'Available' ? 'badge-available' : 'badge-booked'}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.status === 'Available' ? '#1B5E20' : '#E65100' }} />
                        {item.status === 'Available' ? (lang === 'en' ? 'Available' : 'उपलब्ध') : (lang === 'en' ? 'Booked' : 'व्यस्त')}
                      </span>
                    </div>

                    {/* Owner Type Badge */}
                    <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                      <span
                        style={{
                          backgroundColor: item.ownerType === 'Custom Hiring Centre' ? '#1B5E20' : '#F9A825',
                          color: item.ownerType === 'Custom Hiring Centre' ? '#FFFFFF' : '#212121',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                        }}
                      >
                        {item.ownerType === 'Custom Hiring Centre' ? 'CHC Hub' : 'Farmer Owner'}
                      </span>
                    </div>

                    {/* Location Badge on Image Bottom */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0',
                        left: '0',
                        right: '0',
                        padding: '0.6rem 0.85rem',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.82rem',
                        fontWeight: 600
                      }}
                    >
                      <MapPin size={14} style={{ color: '#F9A825' }} />
                      <span>{item.village}, {item.district} ({item.state})</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '1.25rem' }}>
                    
                    {/* Title */}
                    <h3
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#1B5E20',
                        marginBottom: '0.35rem',
                        lineHeight: 1.25
                      }}
                    >
                      {lang === 'en' ? item.name : item.nameHi}
                    </h3>

                    {/* Owner & Rating */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555555', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600 }}>By: {item.ownerName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#F9A825', fontWeight: 800 }}>
                        <Star size={14} fill="#F9A825" />
                        <span>{item.rating}</span>
                        <span style={{ color: '#757575', fontSize: '0.75rem' }}>({item.reviewsCount})</span>
                      </div>
                    </div>

                    {/* Specifications / Inclusions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      <span style={{ backgroundColor: '#F1F8F1', color: '#1B5E20', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
                        ✓ {lang === 'en' ? item.operatorIncluded : item.operatorIncludedHi}
                      </span>
                      <span style={{ backgroundColor: '#FFF8E1', color: '#B78103', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
                        ⛽ {lang === 'en' ? item.fuelIncluded : item.fuelIncludedHi}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Pricing & Booking Buttons Footer */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    backgroundColor: '#FAFAF5',
                    borderTop: '1px solid #EAEAE0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  {/* Price */}
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#757575', textTransform: 'uppercase' }}>
                      {lang === 'en' ? 'Rental Rate' : 'किराया दर'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.45rem', fontWeight: 900, color: '#1B5E20' }}>
                        {item.rate}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#555555' }}>
                        {lang === 'en' ? ` / ${item.unit}` : ` / ${item.unitHi}`}
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => onEnquireItem(item)}
                      className="btn btn-outline-green"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', minHeight: '40px' }}
                      title="Enquire with owner"
                    >
                      <Phone size={14} />
                      <span>{lang === 'en' ? 'Enquire' : 'पूछें'}</span>
                    </button>

                    <button
                      onClick={() => onBookItem(item)}
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', minHeight: '40px', backgroundColor: '#1B5E20' }}
                    >
                      <span>{lang === 'en' ? 'Book Now' : 'बुक करें'}</span>
                    </button>
                  </div>

                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
