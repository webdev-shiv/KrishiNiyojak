import React from 'react';
import { BadgePercent, Users2, Scale, Tractor, CheckCircle, Award } from 'lucide-react';
import { trustHighlights, platformCounters } from '../data/agriData';

export default function TrustStrip({ lang }) {
  const iconMap = {
    BadgePercent: <BadgePercent size={32} style={{ color: '#1B5E20' }} />,
    Users2: <Users2 size={32} style={{ color: '#1B5E20' }} />,
    Scale: <Scale size={32} style={{ color: '#1B5E20' }} />,
    Tractor: <Tractor size={32} style={{ color: '#1B5E20' }} />,
  };

  return (
    <section style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0E0D8' }}>
      
      {/* 4 Key Benefits Row */}
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '2.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {trustHighlights.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                padding: '1.25rem',
                borderRadius: '16px',
                backgroundColor: '#FAFAF5',
                border: '1px solid #EAEAE0',
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#A5D6A7';
                e.currentTarget.style.boxShadow = '0 6px 14px rgba(27, 94, 32, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#EAEAE0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  backgroundColor: '#E8F5E9',
                  border: '1.5px solid #C8E6C9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shrink: 0
                }}
              >
                {iconMap[item.icon]}
              </div>

              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1B5E20', marginBottom: '0.25rem' }}>
                  {item.title[lang]}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#555555', lineHeight: 1.45 }}>
                  {item.desc[lang]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Impact Counters Strip (Wheat / Forest Tone) */}
      <div style={{ backgroundColor: '#FAFAF5', borderTop: '1px solid #E0E0D8', borderBottom: '1px solid #E0E0D8', padding: '2rem 1rem' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1.5rem',
              textAlign: 'center'
            }}
          >
            {platformCounters.map((counter, idx) => (
              <div key={idx} style={{ padding: '0.5rem' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                    fontWeight: 900,
                    color: '#1B5E20',
                    lineHeight: 1.1,
                    marginBottom: '0.35rem'
                  }}
                >
                  {counter.value}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#555555' }}>
                  {counter.label[lang]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
