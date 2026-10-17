import React, { useState } from 'react';
import { Search, MapPin, Tractor, Calendar, ShieldCheck, ArrowRight, CheckCircle2, PlusCircle } from 'lucide-react';
import { translations, statesCoverage, equipmentCategories } from '../data/agriData';

export default function HeroSection({ lang, onSearch, onListClick }) {
  const t = translations[lang];

  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Dynamically get districts based on selected state
  const availableDistricts = selectedState
    ? statesCoverage.find(s => s.name === selectedState)?.districts || []
    : [];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch({
      state: selectedState,
      district: selectedDistrict,
      category: selectedCategory,
    });
    // Smooth scroll down to listings
    const el = document.getElementById('listings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      style={{
        position: 'relative',
        backgroundColor: '#1B5E20',
        color: '#FFFFFF',
        backgroundImage: `linear-gradient(to right, rgba(27, 94, 32, 0.94) 0%, rgba(27, 94, 32, 0.82) 50%, rgba(27, 94, 32, 0.70) 100%), url('/assets/card-e.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        paddingTop: '3.5rem',
        paddingBottom: '4.5rem',
        borderBottom: '4px solid #F9A825'
      }}
    >
      <div className="container">
        <div style={{ maxWidth: '820px' }}>
          
          {/* Trust Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(249, 168, 37, 0.25)',
              border: '1.5px solid #F9A825',
              padding: '0.35rem 0.95rem',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#FFF8E1',
              marginBottom: '1.25rem'
            }}
          >
            <ShieldCheck size={18} style={{ color: '#F9A825' }} />
            <span>
              {lang === 'en'
                ? 'Direct Farmer-to-Farmer Rental • 0% Platform Commission'
                : 'सीधा किसान से किसान किराया • शून्य बिचौलिया, शून्य कमीशन'}
            </span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2.1rem, 5vw, 3.75rem)',
              fontWeight: 900,
              lineHeight: 1.15,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              marginBottom: '1rem',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}
          >
            {t.heroHeadline}
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: 'clamp(1.05rem, 2vw, 1.35rem)',
              color: '#E8F5E9',
              fontWeight: 500,
              lineHeight: 1.6,
              marginBottom: '2rem',
              maxWidth: '720px'
            }}
          >
            {t.heroSubheadline}
          </p>

          {/* Quick Action CTA Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
            <a
              href="#listings"
              className="btn btn-secondary"
              style={{ fontSize: '1.05rem', padding: '0.85rem 1.85rem' }}
            >
              <Search size={18} />
              <span>{t.findEquipmentNearMe}</span>
              <ArrowRight size={18} />
            </a>

            <button
              onClick={onListClick}
              className="btn btn-outline-white"
              style={{ fontSize: '1.05rem', padding: '0.85rem 1.85rem' }}
            >
              <PlusCircle size={18} style={{ color: '#F9A825' }} />
              <span>{t.listYourEquipment}</span>
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* COMPACT RURAL-FRIENDLY SEARCH BAR (STATE, DISTRICT, EQUIPMENT, SEARCH)    */}
        {/* ========================================================================= */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.25rem',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.22)',
            border: '2px solid #E0E0D8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: '#1B5E20', fontWeight: 800, fontSize: '0.95rem' }}>
            <Tractor size={20} style={{ color: '#4CAF50' }} />
            <span>
              {lang === 'en' ? 'Quick Equipment Search / तुरंत उपकरण खोजें:' : 'त्वरित उपकरण खोज (राज्य और जिला चुनें):'}
            </span>
          </div>

          <form onSubmit={handleSearchSubmit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '0.85rem',
                alignItems: 'end'
              }}
            >
              {/* Field 1: State */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  {lang === 'en' ? '1. State / राज्य' : '1. राज्य चुनें'}
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="form-select"
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedDistrict('');
                    }}
                    style={{ fontWeight: 600, color: '#212121', paddingRight: '2rem' }}
                  >
                    <option value="">{lang === 'en' ? '-- Select State --' : '-- राज्य चुनें --'}</option>
                    {statesCoverage.map((s) => (
                      <option key={s.name} value={s.name}>
                        {lang === 'en' ? s.name : `${s.nameHi} (${s.name})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 2: District */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  {lang === 'en' ? '2. District / जिला' : '2. जिला चुनें'}
                </label>
                <select
                  className="form-select"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={!selectedState}
                  style={{ fontWeight: 600, color: '#212121' }}
                >
                  <option value="">
                    {selectedState
                      ? (lang === 'en' ? '-- Select District --' : '-- जिला चुनें --')
                      : (lang === 'en' ? '-- Select State First --' : '-- पहले राज्य चुनें --')}
                  </option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Field 3: Equipment Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  {lang === 'en' ? '3. Equipment / उपकरण' : '3. उपकरण का प्रकार'}
                </label>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ fontWeight: 600, color: '#212121' }}
                >
                  <option value="">{lang === 'en' ? '-- All Equipment Types --' : '-- सभी उपकरण श्रेणियां --'}</option>
                  {equipmentCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name[lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '48px', fontSize: '1rem', backgroundColor: '#1B5E20' }}
                >
                  <Search size={18} />
                  <span>{t.searchNow}</span>
                </button>
              </div>

            </div>
          </form>

          {/* Quick Filter Tags */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #EFEFE8', fontSize: '0.82rem', color: '#555555' }}>
            <span style={{ fontWeight: 700, color: '#1B5E20' }}>
              {lang === 'en' ? 'Popular Searches:' : 'लोकप्रिय खोज:'}
            </span>
            {['Tractors (45+ HP)', 'Rotavator 7-ft', 'Combine Harvester', 'Laser Leveler'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  if (tag.includes('Tractor')) setSelectedCategory('tractors');
                  if (tag.includes('Rotavator')) setSelectedCategory('rotavators');
                  if (tag.includes('Harvester')) setSelectedCategory('harvesters');
                  if (tag.includes('Laser')) setSelectedCategory('land-prep');
                  onSearch({ category: tag.includes('Tractor') ? 'tractors' : tag.includes('Rotavator') ? 'rotavators' : tag.includes('Harvester') ? 'harvesters' : 'land-prep' });
                  document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  backgroundColor: '#F1F8F1',
                  color: '#1B5E20',
                  border: '1px solid #C8E6C9',
                  borderRadius: '9999px',
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + {tag}
              </button>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
