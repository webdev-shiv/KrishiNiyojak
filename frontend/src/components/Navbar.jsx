import React, { useState } from 'react';
import { Sprout, Phone, PlusCircle, Globe, Menu, X, Search, Tractor } from 'lucide-react';
import { translations } from '../data/agriData';

export default function Navbar({ lang, setLang, onRentClick, onListClick }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = translations[lang];

  const toggleLanguage = () => {
    setLang(prev => (prev === 'en' ? 'hi' : 'en'));
  };

  const navLinks = [
    { href: '#home', label: lang === 'en' ? 'Home' : 'मुख्य पृष्ठ' },
    { href: '#categories', label: lang === 'en' ? 'Categories' : 'उपकरण श्रेणियां' },
    { href: '#listings', label: t.rentEquipment, highlight: true },
    { href: '#how-it-works', label: t.howItWorks },
    { href: '#states', label: t.statesWeServe },
    { href: '#testimonials', label: t.farmersVoices },
    { href: '#support', label: t.contact },
  ];

  const handleNavClick = (e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Top Kisan Helpline Ribbon */}
      <div style={{ backgroundColor: '#1B5E20', color: '#FFFFFF', padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <span style={{ backgroundColor: '#F9A825', color: '#212121', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
              {lang === 'en' ? 'FREE PLATFORM' : '100% मुफ़्त'}
            </span>
            <span>{t.trustedBy}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.85rem' }}>
            <a href="tel:18001232474" style={{ color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
              <Phone size={15} style={{ color: '#F9A825' }} />
              <span>1800-123-AGRI (2474)</span>
            </a>
            
            {/* Language Switcher Pill */}
            <button
              onClick={toggleLanguage}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                padding: '0.2rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Toggle English / हिंदी"
            >
              <Globe size={14} style={{ color: '#F9A825' }} />
              <span>{lang === 'en' ? 'हिंदी में देखें' : 'English'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: '#FFFFFF',
          borderBottom: '2px solid #E0E0D8',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '74px', padding: '0.6rem 1.25rem' }}>
          
          {/* Logo on the Left */}
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, '#home')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: '#1B5E20' }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F9A825', boxShadow: '0 4px 10px rgba(27, 94, 32, 0.25)' }}>
              <Tractor size={28} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#1B5E20' }}>
                Agri<span style={{ color: '#F9A825' }}>Link</span>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4CAF50', letterSpacing: '0.02em' }}>
                {lang === 'en' ? 'KrishiNiyojak Equipment Rental' : 'कृषिनियोजक उपकरण सेवा'}
              </div>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav style={{ display: 'none' }} className="desktop-nav">
            <ul style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', listStyle: 'none' }}>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: link.highlight ? 800 : 600,
                      color: link.highlight ? '#1B5E20' : '#475569',
                      textDecoration: 'none',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '6px',
                      transition: 'all 0.2s ease',
                      borderBottom: link.highlight ? '2px solid #4CAF50' : '2px solid transparent'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#1B5E20'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = link.highlight ? '#1B5E20' : '#475569'; }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Prominent Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* Rent Equipment CTA */}
            <button
              onClick={onRentClick}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
            >
              <Search size={16} />
              <span>{t.rentEquipment}</span>
            </button>

            {/* List Your Tractor/Equipment CTA */}
            <button
              onClick={onListClick}
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
            >
              <PlusCircle size={16} />
              <span>{lang === 'en' ? 'List Equipment' : 'उपकरण जोड़ें'}</span>
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                border: '1.5px solid #E0E0D8',
                backgroundColor: '#FAFAF5',
                color: '#1B5E20',
                cursor: 'pointer'
              }}
              className="mobile-toggle"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid #E0E0D8',
              padding: '1.25rem',
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#212121',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    backgroundColor: link.highlight ? '#E8F5E9' : '#FAFAF5'
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #E0E0D8' }}>
              <button
                onClick={() => { setMobileMenuOpen(false); onRentClick(); }}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.9rem' }}
              >
                {t.rentEquipment}
              </button>
              
              <button
                onClick={() => { setMobileMenuOpen(false); onListClick(); }}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.9rem' }}
              >
                {lang === 'en' ? 'List Equipment' : 'उपकरण जोड़ें'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Responsive Inline CSS to handle desktop-nav and mobile-toggle display */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-nav { display: block !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
    </>
  );
}
