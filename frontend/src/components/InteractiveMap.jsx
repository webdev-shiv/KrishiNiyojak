import React, { useState } from 'react';
import { MapPin, Building2, Tractor, CheckCircle2, ArrowRight, Globe } from 'lucide-react';
import { statesCoverage } from '../data/agriData';

export default function InteractiveMap({ lang, onSelectStateFilter }) {
  const [activeStateName, setActiveStateName] = useState('Madhya Pradesh');

  const activeState = statesCoverage.find(s => s.name === activeStateName) || statesCoverage[0];

  return (
    <section id="states" className="section-py" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E0E0D8' }}>
      <div className="container">
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 3rem auto' }}>
          <div className="section-badge">
            <Globe size={16} />
            <span>{lang === 'en' ? 'PAN-INDIA PRESENCE' : 'अखिल भारतीय सेवा'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'Active States & Regional CHC Hubs' : '16 प्रमुख कृषि राज्यों में सक्रिय सेवा'}
          </h2>

          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {lang === 'en'
              ? 'Select any state below to view verified tractor listings, active districts, and connected Custom Hiring Centres.'
              : 'किसी भी राज्य पर क्लिक करें और वहां के सक्रिय जिले, उपलब्ध ट्रैक्टर व CHC केंद्रों का विवरण देखें।'}
          </p>
        </div>

        {/* 2-Column Interactive Map / State Selector Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem',
            alignItems: 'start'
          }}
        >
          {/* Left Column: Interactive State Selector Chips Grid */}
          <div
            style={{
              backgroundColor: '#FAFAF5',
              borderRadius: '24px',
              padding: '1.5rem',
              border: '1.5px solid #E0E0D8'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #EAEAE0' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1B5E20' }}>
                {lang === 'en' ? 'Choose State / राज्य चुनें:' : 'राज्य चुनें:'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#555555', fontWeight: 600 }}>
                16 {lang === 'en' ? 'States Connected' : 'राज्य जुड़े हुए हैं'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.65rem',
                maxHeight: '440px',
                overflowY: 'auto',
                paddingRight: '0.25rem'
              }}
            >
              {statesCoverage.map((s) => {
                const isSelected = s.name === activeStateName;
                return (
                  <button
                    key={s.name}
                    onClick={() => setActiveStateName(s.name)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #1B5E20' : '1px solid #E0E0D8',
                      backgroundColor: isSelected ? '#E8F5E9' : '#FFFFFF',
                      color: isSelected ? '#1B5E20' : '#212121',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 10px rgba(27, 94, 32, 0.12)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '0.92rem', fontWeight: isSelected ? 800 : 700, lineHeight: 1.2 }}>
                      {lang === 'en' ? s.name : s.nameHi}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: isSelected ? '#2E7D32' : '#757575', marginTop: '0.25rem', fontWeight: 600 }}>
                      {s.listings} {lang === 'en' ? 'Units' : 'मशीनें'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Selected State Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '2rem',
              border: '2px solid #C8E6C9',
              boxShadow: '0 8px 24px rgba(27, 94, 32, 0.08)'
            }}
          >
            {/* State Title Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid #EAEAE0' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {lang === 'en' ? 'STATE SERVICE PROFILE' : 'राज्य विवरण'}
                </span>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.85rem', fontWeight: 900, color: '#1B5E20', margin: 0 }}>
                  {lang === 'en' ? activeState.name : `${activeState.nameHi} (${activeState.name})`}
                </h3>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ backgroundColor: '#F9A825', color: '#212121', padding: '0.3rem 0.8rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 900 }}>
                  {activeState.listings} {lang === 'en' ? 'Active Listings' : 'सक्रिय उपकरण'}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#FAFAF5', padding: '1rem', borderRadius: '14px', border: '1px solid #EAEAE0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1B5E20', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                  <Building2 size={16} />
                  <span>{lang === 'en' ? 'Partner CHC Hubs' : 'संबद्ध CHC केंद्र'}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', fontFamily: 'var(--font-heading)' }}>
                  {activeState.hubCount}+
                </div>
              </div>

              <div style={{ backgroundColor: '#FAFAF5', padding: '1rem', borderRadius: '14px', border: '1px solid #EAEAE0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1B5E20', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                  <Tractor size={16} />
                  <span>{lang === 'en' ? 'Key Districts Served' : 'प्रमुख जिले'}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', fontFamily: 'var(--font-heading)' }}>
                  {activeState.districts.length} {lang === 'en' ? 'Districts' : 'जिले'}
                </div>
              </div>
            </div>

            {/* Major Districts Pills */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#555555', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                {lang === 'en' ? 'Top Agricultural Districts Covered:' : 'सक्रिय कृषि जिले:'}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {activeState.districts.map((d) => (
                  <span
                    key={d}
                    style={{
                      backgroundColor: '#E8F5E9',
                      color: '#1B5E20',
                      border: '1px solid #C8E6C9',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700
                    }}
                  >
                    📍 {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Popular Demand */}
            <div style={{ backgroundColor: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#B78103', textTransform: 'uppercase' }}>
                {lang === 'en' ? 'Highest In-Demand Machinery in this State:' : 'इस राज्य में सबसे अधिक मांग वाले उपकरण:'}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#5D4037', marginTop: '0.2rem' }}>
                {activeState.popular}
              </div>
            </div>

            {/* Direct Action: Filter Listings by This State */}
            <button
              onClick={() => {
                onSelectStateFilter(activeState.name);
                document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.98rem' }}
            >
              <span>{lang === 'en' ? `View ${activeState.name} Equipment Listings` : `${activeState.nameHi} के उपकरण देखें`}</span>
              <ArrowRight size={16} />
            </button>

          </div>

        </div>

      </div>
    </section>
  );
}
