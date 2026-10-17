import React, { useState } from 'react';
import { X, CheckCircle2, Tractor, MapPin, Calendar, Clock, Phone, ShieldCheck, IndianRupee } from 'lucide-react';

export default function BookingModal({ isOpen, onClose, equipment, lang }) {
  const [hoursOrAcres, setHoursOrAcres] = useState(4);
  const [bookingDate, setBookingDate] = useState('2026-10-22');
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen || !equipment) return null;

  // Calculate estimated total
  const rateNumeric = parseInt(equipment.rate.replace(/[^0-9]/g, '')) || 600;
  const estimatedTotal = rateNumeric * hoursOrAcres;

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!farmerName || !farmerPhone) {
      alert(lang === 'en' ? 'Please fill your name and mobile number' : 'कृपया अपना नाम और मोबाइल नंबर भरें');
      return;
    }
    setConfirmed(true);
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

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
          maxWidth: '580px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '2px solid #C8E6C9',
          position: 'relative'
        }}
      >
        {/* Header Bar */}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1B5E20', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Tractor size={24} style={{ color: '#F9A825' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-heading)', margin: 0 }}>
              {lang === 'en' ? 'Direct Equipment Booking' : 'सीधी मशीन बुकिंग'}
            </h3>
          </div>

          <button
            onClick={handleClose}
            style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.15)', border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem' }}>
          
          {confirmed ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#E8F5E9', color: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', marginBottom: '0.5rem' }}>
                {lang === 'en' ? 'Booking Confirmed with Owner!' : 'मशीन मालिक के पास बुकिंग दर्ज हुई!'}
              </h4>
              <p style={{ color: '#555555', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {lang === 'en'
                  ? `Booking code #AGRI-${Math.floor(1000 + Math.random() * 9000)} created. The equipment owner ${equipment.ownerName} has been alerted and will coordinate arrival.`
                  : `बुकिंग कोड #AGRI-${Math.floor(1000 + Math.random() * 9000)} बन गया है। मशीन मालिक ${equipment.ownerName} को सूचना भेज दी गई है।`}
              </p>

              {/* Direct Phone Call Button */}
              <a
                href={`tel:${equipment.ownerPhone}`}
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '0.75rem' }}
              >
                <Phone size={18} />
                <span>{lang === 'en' ? `Call Owner Directly: ${equipment.ownerPhone}` : `सीधे मालिक को कॉल करें: ${equipment.ownerPhone}`}</span>
              </a>

              <button
                onClick={handleClose}
                className="btn btn-outline-green"
                style={{ width: '100%' }}
              >
                {lang === 'en' ? 'Done / Close' : 'समाप्त / बंद करें'}
              </button>
            </div>
          ) : (
            <div>
              {/* Selected Equipment Summary Card */}
              <div style={{ display: 'flex', gap: '1rem', backgroundColor: '#FAFAF5', padding: '1rem', borderRadius: '16px', border: '1px solid #E0E0D8', marginBottom: '1.25rem' }}>
                <img
                  src={equipment.image}
                  alt={equipment.name}
                  style={{ width: '90px', height: '80px', borderRadius: '12px', objectFit: 'cover' }}
                />
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1B5E20', margin: '0 0 0.2rem 0' }}>
                    {lang === 'en' ? equipment.name : equipment.nameHi}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#555555' }}>
                    📍 {equipment.village}, {equipment.district}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1B5E20', marginTop: '0.35rem' }}>
                    {equipment.rate} / {equipment.unit} • {equipment.fuelIncluded}
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirm}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  
                  {/* Row 1: Date & Expected Hours/Acres */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'Required Date / काम की तारीख *' : 'काम की तारीख *'}
                      </label>
                      <input
                        type="date"
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? `Estimated ${equipment.unit}s *` : `अनुमानित ${equipment.unitHi} *`}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={hoursOrAcres}
                        onChange={(e) => setHoursOrAcres(Math.max(1, parseInt(e.target.value) || 1))}
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* Row 2: Farmer Name & Phone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'Your Name / आपका नाम *' : 'आपका नाम *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={lang === 'en' ? 'Ramesh Patel' : 'रमेश पटेल'}
                        value={farmerName}
                        onChange={(e) => setFarmerName(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'Mobile Number / मोबाइल *' : 'मोबाइल नंबर *'}
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="98260XXXXX"
                        value={farmerPhone}
                        onChange={(e) => setFarmerPhone(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* Price Estimate Strip */}
                  <div style={{ backgroundColor: '#E8F5E9', border: '1px solid #C8E6C9', padding: '0.85rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#33691E' }}>
                        {lang === 'en' ? 'Estimated Total Rental' : 'अनुमानित कुल किराया'}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1B5E20' }}>
                        ₹{estimatedTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#1B5E20', fontWeight: 700, textAlign: 'right' }}>
                      ✓ 0% Platform Commission<br />(सीधे मालिक को देय)
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', height: '48px', fontSize: '1rem', marginTop: '0.5rem' }}
                  >
                    <span>{lang === 'en' ? 'Confirm Booking (No Advance Needed)' : 'बुकिंग पक्की करें (अग्रिम राशि शून्य)'}</span>
                  </button>

                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
