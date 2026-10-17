import React from 'react';
import { Sparkles, ArrowRight, Check } from 'lucide-react';
import { equipmentCategories } from '../data/agriData';

export default function CategoriesSection({ lang, onSelectCategory }) {
  return (
    <section id="categories" className="section-py" style={{ backgroundColor: '#FAFAF5' }}>
      <div className="container">
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 3rem auto' }}>
          <div className="section-badge">
            <Sparkles size={16} />
            <span>{lang === 'en' ? 'EQUIPMENT CATEGORIES' : 'कृषि उपकरण श्रेणियां'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'Browse by Farm Equipment Type' : 'खेती के काम अनुसार उपकरण चुनें'}
          </h2>

          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {lang === 'en'
              ? 'Find verified tractors, soil preparation implements, seed drills, and combine harvesters ready for seasonal deployment.'
              : 'जुताई, बुवाई, छिड़काव और कटाई के लिए आधुनिक व सत्यापित मशीनें उचित किराए पर उपलब्ध हैं।'}
          </p>
        </div>

        {/* 8 Category Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {equipmentCategories.map((cat) => (
            <div
              key={cat.id}
              className="agri-card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                {/* Image Container with Badge */}
                <div style={{ position: 'relative', width: '100%', height: '185px', overflow: 'hidden', backgroundColor: '#E0E0D8' }}>
                  <img
                    src={cat.image}
                    alt={cat.name[lang]}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    loading="lazy"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      backgroundColor: 'rgba(27, 94, 32, 0.9)',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '9999px',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    {cat.specs}
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.75)',
                      color: '#F9A825',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px'
                    }}
                  >
                    {cat.count}
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: '1.25rem' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#1B5E20',
                      marginBottom: '0.45rem'
                    }}
                  >
                    {cat.name[lang]}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#555555', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {cat.desc[lang]}
                  </p>
                </div>
              </div>

              {/* Price & Action Button Footer */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderTop: '1px solid #EAEAE0',
                  backgroundColor: '#FAFAF5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#757575', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'Starting from' : 'शुरुआती किराया'}
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1B5E20', fontFamily: 'var(--font-heading)' }}>
                    {cat.startingPrice}
                  </div>
                </div>

                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className="btn btn-outline-green"
                  style={{ minHeight: '40px', padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
                >
                  <span>{lang === 'en' ? 'View Equipment' : 'उपकरण देखें'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
