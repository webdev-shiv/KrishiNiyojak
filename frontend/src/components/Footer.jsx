import React from 'react';
import { Tractor, Phone, Mail, MapPin, Heart, ArrowUp, ShieldCheck, ExternalLink } from 'lucide-react';
import { equipmentCategories } from '../data/agriData';

export default function Footer({ lang }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer style={{ backgroundColor: '#134417', color: '#E8F5E9', borderTop: '4px solid #F9A825' }}>
      
      {/* Upper Footer Columns */}
      <div className="container" style={{ paddingTop: '4rem', paddingBottom: '3.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '2.5rem',
            alignItems: 'start'
          }}
        >
          {/* Col 1: Brand & Mission */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#F9A825', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B5E20' }}>
                <Tractor size={26} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
                  NI<span style={{ color: '#F9A825' }}>TI</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5D6A7' }}>
                  {lang === 'en' ? 'NITI Agricultural Equipment Rental' : 'नीति (NITI) उपकरण सेवा'}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#C8E6C9', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {lang === 'en'
                ? "India's trustworthy agricultural machinery rental platform connecting smallholder farmers directly with tractor owners and Custom Hiring Centres (CHCs)."
                : 'भारतीय किसानों का अपना मंच — जहां बिना किसी बिचौलिए के सही दाम पर ट्रैक्टर और आधुनिक कृषि उपकरण किराए पर मिलते हैं।'}
            </p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', color: '#FFF8E1' }}>
              <ShieldCheck size={16} style={{ color: '#F9A825' }} />
              <span>{lang === 'en' ? '0% Commission • Farmer-Centric' : '0% कमीशन • किसान हित में समर्पित'}</span>
            </div>
          </div>

          {/* Col 2: Equipment Categories */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', borderBottom: '2px solid #2E7D32', paddingBottom: '0.5rem' }}>
              {lang === 'en' ? 'Farm Equipment Categories' : 'कृषि उपकरण श्रेणियां'}
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
              {equipmentCategories.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <a
                    href="#categories"
                    style={{ color: '#C8E6C9', textDecoration: 'none', transition: 'color 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#F9A825'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#C8E6C9'; }}
                  >
                    → {c.name[lang]}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Quick Navigation */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', borderBottom: '2px solid #2E7D32', paddingBottom: '0.5rem' }}>
              {lang === 'en' ? 'Quick Links' : 'त्वरित लिंक'}
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
              <li>
                <a href="#home" style={{ color: '#C8E6C9', textDecoration: 'none' }}>
                  {lang === 'en' ? 'Home' : 'मुख्य पृष्ठ'}
                </a>
              </li>
              <li>
                <a href="#listings" style={{ color: '#C8E6C9', textDecoration: 'none' }}>
                  {lang === 'en' ? 'Rent Equipment' : 'उपकरण किराए पर लें'}
                </a>
              </li>
              <li>
                <a href="#how-it-works" style={{ color: '#C8E6C9', textDecoration: 'none' }}>
                  {lang === 'en' ? 'How It Works' : 'यह कैसे काम करता है'}
                </a>
              </li>
              <li>
                <a href="#states" style={{ color: '#C8E6C9', textDecoration: 'none' }}>
                  {lang === 'en' ? 'States We Serve' : 'हमारे राज्य'}
                </a>
              </li>
              <li>
                <a href="#testimonials" style={{ color: '#C8E6C9', textDecoration: 'none' }}>
                  {lang === 'en' ? "Farmers' Voices" : 'किसानों की आवाज़'}
                </a>
              </li>
              <li>
                <a href="#faq" style={{ color: '#C8E6C9', textDecoration: 'none' }}>
                  {lang === 'en' ? 'FAQs & Help' : 'अक्सर पूछे जाने वाले सवाल'}
                </a>
              </li>
              <li>
                <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" style={{ color: '#F9A825', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>FastAPI Backend Swagger</span>
                  <ExternalLink size={12} />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Kisan Contact & Helpline */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', borderBottom: '2px solid #2E7D32', paddingBottom: '0.5rem' }}>
              {lang === 'en' ? 'Kisan Helpline & Office' : 'किसान हेल्पलाइन व संपर्क'}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <Phone size={18} style={{ color: '#F9A825', shrink: 0, marginTop: '3px' }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem' }}>1800-123-AGRI (2474)</div>
                  <div style={{ fontSize: '0.75rem', color: '#A5D6A7' }}>{lang === 'en' ? 'Toll Free (6 AM - 10 PM)' : 'टोल-फ्री (सुबह 6 से रात 10)'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Mail size={18} style={{ color: '#F9A825', shrink: 0 }} />
                <span>sahayata@niti.in</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <MapPin size={18} style={{ color: '#F9A825', shrink: 0, marginTop: '3px' }} />
                <span>Krishi Vikas Bhavan, Mandsaur & Dewas Central Hubs, M.P. - 458001</span>
              </div>
            </div>

            {/* Back to top button */}
            <button
              onClick={scrollToTop}
              style={{
                marginTop: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ArrowUp size={14} />
              <span>{lang === 'en' ? 'Back to Top' : 'ऊपर जाएं'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Bottom Legal Copyright Strip */}
      <div style={{ backgroundColor: '#0B290E', padding: '1.25rem 1rem', fontSize: '0.82rem', color: '#A5D6A7', borderTop: '1px solid #1B5E20' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            © {new Date().getFullYear()} NITI. All rights reserved.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#F9A825' }}>
            <span>जय जवान, जय किसान 🇮🇳 Empowering Indian Farmers</span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <a href="#faq" style={{ color: '#A5D6A7', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#faq" style={{ color: '#A5D6A7', textDecoration: 'none' }}>Terms & Conditions</a>
            <a href="#support" style={{ color: '#A5D6A7', textDecoration: 'none' }}>Support</a>
          </div>
        </div>
      </div>

    </footer>
  );
}
