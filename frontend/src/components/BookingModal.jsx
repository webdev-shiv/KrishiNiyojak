import React, { useState } from 'react';
import { X, CheckCircle2, Tractor, MapPin, Calendar, Clock, Phone, ShieldCheck, IndianRupee, Loader2 } from 'lucide-react';
import { bookingsService } from '../api/supabaseService';

export default function BookingModal({ isOpen, onClose, equipment, lang, onBookingCreated }) {
  const [hoursOrAcres, setHoursOrAcres] = useState(4);
  const [bookingDate, setBookingDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmedRecord, setConfirmedRecord] = useState(null);

  if (!isOpen || !equipment) return null;

  // Calculate estimated total from real machine rate (no fabricated default)
  const rateNumeric = typeof equipment.rate === 'number' 
    ? equipment.rate 
    : (parseInt(String(equipment.rate).replace(/[^0-9]/g, '')) || 0);
  const estimatedTotal = rateNumeric > 0 ? rateNumeric * hoursOrAcres : 0;

  const handleConfirm = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!farmerName || !farmerPhone) {
      setErrorMsg(lang === 'en' ? 'Please fill your name and mobile number' : 'कृपया अपना नाम और मोबाइल नंबर भरें');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        machine_id: equipment.id,
        centre_id: equipment.centre_id,
        operation: equipment.category ? `${equipment.category.toUpperCase()} OPERATION` : 'AGRICULTURAL_WORK',
        farm_area: hoursOrAcres,
        field_location: equipment.village ? `${equipment.village}, ${equipment.district}` : equipment.district,
        scheduled_date: bookingDate,
        total_price: estimatedTotal,
        rate_per_unit: rateNumeric,
        special_instructions: `Farmer: ${farmerName}, Mobile: ${farmerPhone}`
      };

      const result = await bookingsService.createBooking(payload);
      setConfirmedRecord(result);
      if (onBookingCreated) {
        onBookingCreated(result);
      }
    } catch (err) {
      console.error('[BookingModal] Booking failed:', err);
      setErrorMsg(err.message || 'Failed to persist booking in database.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setConfirmedRecord(null);
    setErrorMsg(null);
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
          
          {confirmedRecord ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#E8F5E9', color: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', marginBottom: '0.5rem' }}>
                {lang === 'en' ? 'Booking Confirmed in Supabase!' : 'डेटाबेस में बुकिंग दर्ज हुई!'}
              </h4>
              <p style={{ color: '#555555', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {lang === 'en'
                  ? `Booking reference #${confirmedRecord.booking_reference} has been saved to public.bookings. The centre coordinator has received this live dispatch.`
                  : `बुकिंग संदर्भ #${confirmedRecord.booking_reference} डेटाबेस में दर्ज हो गया है। केंद्र समन्वयक को सूचना प्राप्त हो गई है।`}
              </p>

              {equipment.centres?.contact_phone && (
                <a
                  href={`tel:${equipment.centres.contact_phone}`}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                >
                  <Phone size={18} />
                  <span>{lang === 'en' ? `Call Centre Coordinator: ${equipment.centres.contact_phone}` : `केंद्र समन्वयक को कॉल करें: ${equipment.centres.contact_phone}`}</span>
                </a>
              )}

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
                  src={equipment.image_url || '/assets/card-e.jpg'}
                  alt={equipment.name}
                  style={{ width: '90px', height: '80px', borderRadius: '12px', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = '/assets/card-e.jpg'; }}
                />
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1B5E20', margin: '0 0 0.2rem 0' }}>
                    {equipment.name}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#555555' }}>
                    📍 {equipment.village ? `${equipment.village}, ` : ''}{equipment.district}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1B5E20', marginTop: '0.35rem' }}>
                    ₹{rateNumeric} / {equipment.rate_unit || 'Hour'} • {equipment.fuel_included ? 'Fuel Included' : 'Self Fuel'}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '12px', color: '#C62828', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {errorMsg}
                </div>
              )}

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
                        {lang === 'en' ? `Estimated ${equipment.rate_unit || 'Hour'}s *` : `अनुमानित ${equipment.rate_unit || 'घंटा'} *`}
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
                      ✓ Supabase Persisted<br />(0% Commission)
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ width: '100%', height: '48px', fontSize: '1rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    {submitting && <Loader2 size={18} className="animate-spin" />}
                    <span>{submitting ? 'Persisting to Database...' : (lang === 'en' ? 'Confirm Booking to Supabase' : 'बुकिंग पक्की करें')}</span>
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
