import React, { useState } from 'react';
import { Phone, MessageCircle, Mail, Clock, Send, CheckCircle2, Headphones, AlertCircle } from 'lucide-react';
import { statesCoverage } from '../data/agriData';

export default function HelplineSupport({ lang }) {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    state: 'Madhya Pradesh',
    requirement: 'Tractor (45-55 HP)',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) {
      alert(lang === 'en' ? 'Please enter your name and mobile number' : 'कृपया अपना नाम और मोबाइल नंबर दर्ज करें');
      return;
    }
    setFormSubmitted(true);
  };

  return (
    <section id="support" className="section-py" style={{ backgroundColor: '#1B5E20', color: '#FFFFFF' }}>
      <div className="container">
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '3rem',
            alignItems: 'center'
          }}
        >
          {/* Left Column: Toll-Free & Direct Help Info */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(249, 168, 37, 0.25)',
                border: '1px solid #F9A825',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#FFF8E1',
                marginBottom: '1rem'
              }}
            >
              <Headphones size={16} style={{ color: '#F9A825' }} />
              <span>{lang === 'en' ? '24x7 DEDICATED KISAN HELPLINE' : '24x7 समर्पित किसान सहायता केंद्र'}</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                fontWeight: 900,
                lineHeight: 1.2,
                marginBottom: '1rem',
                color: '#FFFFFF'
              }}
            >
              {lang === 'en' ? 'Need Help Booking Equipment? Speak to a Krishi Mitra' : 'उपकरण बुक करने में मदद चाहिए? कृषि मित्र से बात करें'}
            </h2>

            <p style={{ fontSize: '1.05rem', color: '#C8E6C9', lineHeight: 1.6, marginBottom: '2rem' }}>
              {lang === 'en'
                ? 'Our rural assistance coordinators are available in Hindi and regional languages. Call toll-free, chat on WhatsApp, or request an instant callback.'
                : 'इंटरनेट की समस्या हो या फोन पर बुकिंग करानी हो — हमारे कृषि सहायक आपकी भाषा में तुरंत मदद के लिए तैयार हैं।'}
            </p>

            {/* Direct Contact Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Toll-Free Card */}
              <a
                href="tel:18001232474"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  transition: 'all 0.25s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F9A825', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#212121' }}>
                  <Phone size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#F9A825', fontWeight: 800 }}>
                    {lang === 'en' ? 'Toll-Free National Helpline' : 'राष्ट्रीय टोल-फ्री हेल्पलाइन'}
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>
                    1800-123-AGRI (2474)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#C8E6C9' }}>
                    {lang === 'en' ? 'Toll Free • Mon-Sun 6:00 AM – 10:00 PM' : 'निशुल्क कॉल • सुबह 6:00 से रात 10:00 तक'}
                  </div>
                </div>
              </a>

              {/* WhatsApp Card */}
              <a
                href="https://wa.me/919876543210?text=Namaste%20AgriLink%20I%20need%20tractor%20rental%20help"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  transition: 'all 0.25s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
                  <MessageCircle size={26} />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#A7F3D0', fontWeight: 800 }}>
                    {lang === 'en' ? 'Direct WhatsApp Booking Assistance' : 'व्हाट्सएप बुकिंग सहायता'}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>
                    +91 98765 43210
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#C8E6C9' }}>
                    {lang === 'en' ? 'Send "TRACTOR" on WhatsApp for instant matches' : 'तुरंत सहायता के लिए व्हाट्सएप पर मैसेज भेजें'}
                  </div>
                </div>
              </a>

            </div>
          </div>

          {/* Right Column: "Request a Callback" Form Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              color: '#212121',
              borderRadius: '24px',
              padding: '2.25rem',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)'
            }}
          >
            {formSubmitted ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#E8F5E9', color: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', marginBottom: '0.5rem' }}>
                  {lang === 'en' ? 'Callback Request Received!' : 'कॉल बैक अनुरोध प्राप्त हुआ!'}
                </h3>
                <p style={{ color: '#555555', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  {lang === 'en'
                    ? `Thank you, ${formData.name}. Our local Krishi Mitra will call you on ${formData.mobile} within 15 minutes.`
                    : `धन्यवाद, ${formData.name} जी। हमारे कृषि सहायक 15 मिनट के भीतर आपके नंबर ${formData.mobile} पर संपर्क करेंगे।`}
                </p>
                <button
                  onClick={() => setFormSubmitted(false)}
                  className="btn btn-outline-green"
                  style={{ width: '100%' }}
                >
                  {lang === 'en' ? 'Submit Another Request' : 'दूसरा अनुरोध दर्ज करें'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B5E20', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'FREE ASSISTANCE' : 'निशुल्क सहायता'}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', fontWeight: 900, color: '#1B5E20', margin: '0.2rem 0 0.5rem 0' }}>
                    {lang === 'en' ? 'Request an Instant Callback' : 'कॉल बैक का अनुरोध करें'}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#555555', margin: 0 }}>
                    {lang === 'en'
                      ? 'Leave your phone number. Our coordinator will match and book equipment for you.'
                      : 'अपना नंबर दर्ज करें। हमारा कृषि मित्र तुरंत फोन करके आपको उपकरण बुक कराएगा।'}
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    
                    {/* Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'Farmer Name / किसान का नाम *' : 'आपका नाम *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={lang === 'en' ? 'e.g., Rajesh Patel' : 'जैसे, राजेश पटेल'}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="form-input"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'Mobile Number / मोबाइल नंबर *' : 'मोबाइल नंबर (10 अंक) *'}
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder={lang === 'en' ? 'e.g., 9826012345' : 'जैसे, 9826012345'}
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        className="form-input"
                      />
                    </div>

                    {/* State */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'State / राज्य' : 'राज्य चुनें'}
                      </label>
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="form-select"
                      >
                        {statesCoverage.map((s) => (
                          <option key={s.name} value={s.name}>
                            {lang === 'en' ? s.name : `${s.nameHi} (${s.name})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Requirement */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#555555', marginBottom: '0.25rem' }}>
                        {lang === 'en' ? 'Required Farm Machine / आवश्यक मशीन' : 'कौन सी मशीन चाहिए?'}
                      </label>
                      <select
                        value={formData.requirement}
                        onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                        className="form-select"
                      >
                        <option value="Tractor (45-55 HP)">{lang === 'en' ? 'Tractor (45-55 HP)' : 'ट्रैक्टर (45-55 HP)'}</option>
                        <option value="Rotavator 7-Feet">{lang === 'en' ? 'Rotavator 7-Feet' : 'रोटावेटर 7 फीट'}</option>
                        <option value="Combine Harvester">{lang === 'en' ? 'Combine Harvester' : 'कंबाइन हार्वेस्टर'}</option>
                        <option value="Zero-Till Seed Drill">{lang === 'en' ? 'Zero-Till Seed Drill' : 'सीड ड्रिल (बुवाई मशीन)'}</option>
                        <option value="Laser Land Leveler">{lang === 'en' ? 'Laser Land Leveler' : 'लेज़र लैंड लेवलर'}</option>
                        <option value="Boom Sprayer">{lang === 'en' ? 'Boom Sprayer' : 'कीटनाशक स्प्रेयर'}</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '0.5rem', height: '48px', fontSize: '1rem' }}
                    >
                      <Send size={18} />
                      <span>{lang === 'en' ? 'Call Me Back within 15 Mins' : '15 मिनट में मुझे कॉल करें'}</span>
                    </button>

                  </div>
                </form>
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
}
