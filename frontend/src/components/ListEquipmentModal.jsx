import React, { useState } from 'react';
import { X, CheckCircle2, Tractor, PlusCircle, Sparkles, MapPin, IndianRupee } from 'lucide-react';
import { equipmentCategories, statesCoverage } from '../data/agriData';

export default function ListEquipmentModal({ isOpen, onClose, lang, onListingAdded }) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'tractors',
    hp: '45 HP',
    rate: '650',
    unit: 'Hour',
    state: 'Madhya Pradesh',
    district: 'Mandsaur',
    village: '',
    ownerName: '',
    ownerPhone: '',
    ownerType: 'Farmer',
    driverIncluded: 'Yes',
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.ownerPhone || !formData.village) {
      alert(lang === 'en' ? 'Please fill all mandatory fields' : 'कृपया सभी आवश्यक फ़ील्ड भरें');
      return;
    }
    setSubmitted(true);
    if (onListingAdded) {
      onListingAdded(formData);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  const currentDistricts = statesCoverage.find(s => s.name === formData.state)?.districts || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          maxWidth: '640px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '2px solid #FFE082',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1B5E20', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PlusCircle size={24} style={{ color: '#F9A825' }} />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-heading)', margin: 0 }}>
                {lang === 'en' ? 'List Your Tractor or Equipment Free' : 'अपना ट्रैक्टर या कृषि उपकरण लिस्ट करें (100% मुफ़्त)'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#C8E6C9' }}>
                {lang === 'en' ? 'Zero registration charges • Direct farmer contact' : 'शून्य पंजीकरण शुल्क • सीधी किसान बुकिंग'}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.15)', border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#E8F5E9', color: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', marginBottom: '0.5rem' }}>
                {lang === 'en' ? 'Equipment Listed Successfully!' : 'उपकरण सफलतापूर्वक लिस्ट हो गया!'}
              </h4>
              <p style={{ color: '#555555', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {lang === 'en'
                  ? `Your machine "${formData.name}" has been published in ${formData.district}, ${formData.state}. Farmers in your block will contact you directly on ${formData.ownerPhone}.`
                  : `आपकी मशीन "${formData.name}" ${formData.district}, ${formData.state} में लिस्ट हो गई है। आसपास के किसान आपसे सीधे ${formData.ownerPhone} पर संपर्क करेंगे।`}
              </p>

              <button
                onClick={handleClose}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                {lang === 'en' ? 'Done / View Listings' : 'समाप्त / लिस्टिंग देखें'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                
                {/* Row 1: Category & Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Equipment Type / प्रकार *' : 'उपकरण प्रकार *'}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="form-select"
                    >
                      {equipmentCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name[lang]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Brand & Model / नाम *' : 'ट्रैक्टर/मशीन का नाम *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'en' ? 'e.g. Swaraj 855 FE' : 'जैसे, स्वराज 855 FE'}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Row 2: Location (State, District, Village) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'State / राज्य *' : 'राज्य *'}
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value, district: '' })}
                      className="form-select"
                    >
                      {statesCoverage.map((s) => (
                        <option key={s.name} value={s.name}>{lang === 'en' ? s.name : s.nameHi}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'District / जिला *' : 'जिला *'}
                    </label>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="form-select"
                    >
                      {currentDistricts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Village / गांव *' : 'गांव / कस्बा *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'en' ? 'Village Name' : 'गांव का नाम'}
                      value={formData.village}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Row 3: Rate, Unit, Driver */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Rental Rate (₹) *' : 'किराया दर (₹) *'}
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="600"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Per Unit *' : 'इकाई *'}
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="form-select"
                    >
                      <option value="Hour">{lang === 'en' ? 'Per Hour (प्रति घंटा)' : 'प्रति घंटा'}</option>
                      <option value="Acre">{lang === 'en' ? 'Per Acre (प्रति एकड़)' : 'प्रति एकड़'}</option>
                      <option value="Day">{lang === 'en' ? 'Per Day (प्रति दिन)' : 'प्रति दिन'}</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Driver / ऑपरेटर' : 'चालक सहित?'}
                    </label>
                    <select
                      value={formData.driverIncluded}
                      onChange={(e) => setFormData({ ...formData, driverIncluded: e.target.value })}
                      className="form-select"
                    >
                      <option value="Yes">{lang === 'en' ? 'Yes (Driver Included)' : 'हाँ (चालक सहित)'}</option>
                      <option value="No">{lang === 'en' ? 'No (Machine Only)' : 'नहीं (केवल मशीन)'}</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Owner Name & Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Owner Name / मालिक का नाम *' : 'मालिक का नाम *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'en' ? 'Devendra Singh' : 'देवेंद्र सिंह'}
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                      {lang === 'en' ? 'Mobile Number / मोबाइल नंबर *' : 'मोबाइल नंबर (10 अंक) *'}
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="98260XXXXX"
                      value={formData.ownerPhone}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ width: '100%', height: '48px', fontSize: '1rem', marginTop: '0.5rem' }}
                >
                  <PlusCircle size={18} />
                  <span>{lang === 'en' ? 'List Equipment (Publish Live Now)' : 'उपकरण लिस्ट करें (अभी प्रकाशित करें)'}</span>
                </button>

              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
