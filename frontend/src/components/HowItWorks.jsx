import React, { useState } from 'react';
import { MapPin, Search, PhoneCall, CheckCircle, PlusCircle, CalendarCheck, IndianRupee, Star, HelpCircle } from 'lucide-react';

export default function HowItWorks({ lang, onListClick }) {
  const [activeTab, setActiveTab] = useState('farmers'); // 'farmers' or 'owners'

  const farmerSteps = [
    {
      num: '01',
      icon: <MapPin size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Select Location & Need', hi: 'स्थान और जरूरत चुनें' },
      desc: {
        en: 'Choose your State and District. Select the equipment you need (Tractor, Rotavator, Harvester, or Sprayer) and target date.',
        hi: 'अपना राज्य और जिला चुनें। आवश्यक मशीन (ट्रैक्टर, रोटावेटर, हार्वेस्टर) और काम की तारीख तय करें।'
      }
    },
    {
      num: '02',
      icon: <Search size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Browse Verified Machinery', hi: 'पास की उपलब्ध मशीनें देखें' },
      desc: {
        en: 'Compare verified nearby tractors and implements. View transparent hourly/per-acre rates, operator options, and farmer ratings.',
        hi: 'नज़दीक के किसानों और CHC केंद्रों की मशीनें देखें। घंटेवार दरें, डीजल व ड्राइवर की शर्तें और रिव्यू जांचें।'
      }
    },
    {
      num: '03',
      icon: <PhoneCall size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Connect & Book Directly', hi: 'सीधा संपर्क करें और बुक करें' },
      desc: {
        en: 'Click Book Now or call the equipment owner directly. Confirm field address and timing with zero platform commission.',
        hi: 'सीधे मशीन मालिक से फोन पर बात करें या ऑनलाइन बुक करें। बिना किसी बिचौलिए के खेत का पता व समय तय करें।'
      }
    },
    {
      num: '04',
      icon: <CheckCircle size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Complete Field Work & Pay', hi: 'काम पूरा करें और भुगतान करें' },
      desc: {
        en: 'Equipment arrives on your field on time. Pay the owner directly after completion and share your feedback.',
        hi: 'मशीन समय पर आपके खेत पहुंचेगी। काम पूरा होने पर सीधे मालिक को भुगतान करें और अपना अनुभव साझा करें।'
      }
    }
  ];

  const ownerSteps = [
    {
      num: '01',
      icon: <PlusCircle size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'List Your Equipment in 2 Mins', hi: '2 मिनट में मशीन लिस्ट करें' },
      desc: {
        en: 'Enter your tractor/implement brand, HP model, village location, and your per-hour or per-acre rental rate.',
        hi: 'अपने ट्रैक्टर, रोटावेटर या हार्वेस्टर का मॉडल, हॉर्सपावर, गांव और अपनी प्रति घंटा या प्रति एकड़ दर दर्ज करें।'
      }
    },
    {
      num: '02',
      icon: <CalendarCheck size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Receive Direct Inquiries', hi: 'सीधी किसान बुकिंग प्राप्त करें' },
      desc: {
        en: 'Nearby farmers in your district will contact you directly via call or WhatsApp during your idle field days.',
        hi: 'जब आपका ट्रैक्टर खाली हो, तब आसपास के किसान आपसे सीधे फोन या व्हाट्सएप पर बुकिंग के लिए संपर्क करेंगे।'
      }
    },
    {
      num: '03',
      icon: <TractorIcon size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Deploy to Nearby Fields', hi: 'खेत पर मशीन भेजें' },
      desc: {
        en: 'Send your equipment with your driver or provide the implement. Utilize idle machine-days productively.',
        hi: 'अपने अनुभवी ड्राइवर के साथ मशीन भेजें। अपने ट्रैक्टर के खाली दिनों का सही इस्तेमाल करें।'
      }
    },
    {
      num: '04',
      icon: <IndianRupee size={28} style={{ color: '#1B5E20' }} />,
      title: { en: 'Earn Full Direct Income', hi: 'सीधी पूरी कमाई प्राप्त करें' },
      desc: {
        en: 'Receive 100% of your rental payment directly from the farmer. Zero cut, zero platform fee, pure profit.',
        hi: 'किसान से सीधे पूरा किराया अपने हाथ में या बैंक में लें। कोई कमीशन नहीं, पूरी कमाई आपकी।'
      }
    }
  ];

  function TractorIcon({ size, style }) {
    return <Search size={size} style={style} />;
  }

  const currentSteps = activeTab === 'farmers' ? farmerSteps : ownerSteps;

  return (
    <section id="how-it-works" className="section-py" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E0E0D8' }}>
      <div className="container">
        
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 2.5rem auto' }}>
          <div className="section-badge">
            <HelpCircle size={16} />
            <span>{lang === 'en' ? 'SIMPLE 4-STEP PROCESS' : 'आसान 4 चरणों की प्रक्रिया'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'How AgriLink Works' : 'एग्रीलिंक कैसे काम करता है?'}
          </h2>

          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {lang === 'en'
              ? 'Transparent, direct farmer-to-farmer agricultural machinery rental with zero middlemen.'
              : 'बिना किसी बिचौलिए के, सीधे किसान से किसान तक आधुनिक मशीनें पहुँचाने का सरल तरीका।'}
          </p>

          {/* Flow Switcher Toggle (For Farmers vs For Equipment Owners) */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#FAFAF5',
              border: '2px solid #E0E0D8',
              borderRadius: '9999px',
              padding: '0.35rem',
              marginTop: '1.75rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
          >
            <button
              onClick={() => setActiveTab('farmers')}
              style={{
                padding: '0.65rem 1.6rem',
                borderRadius: '9999px',
                fontSize: '0.95rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                backgroundColor: activeTab === 'farmers' ? '#1B5E20' : 'transparent',
                color: activeTab === 'farmers' ? '#FFFFFF' : '#555555'
              }}
            >
              {lang === 'en' ? '🌾 For Farmers (किराएदार किसान)' : '🌾 किसानों के लिए (किराएदार)'}
            </button>

            <button
              onClick={() => setActiveTab('owners')}
              style={{
                padding: '0.65rem 1.6rem',
                borderRadius: '9999px',
                fontSize: '0.95rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                backgroundColor: activeTab === 'owners' ? '#F9A825' : 'transparent',
                color: activeTab === 'owners' ? '#212121' : '#555555'
              }}
            >
              {lang === 'en' ? '🚜 For Equipment Owners (मशीन मालिक)' : '🚜 ट्रैक्टर व मशीन मालिकों के लिए'}
            </button>
          </div>
        </div>

        {/* 4 Steps Timeline / Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            position: 'relative'
          }}
        >
          {currentSteps.map((step) => (
            <div
              key={step.num}
              style={{
                backgroundColor: '#FAFAF5',
                borderRadius: '20px',
                padding: '1.75rem 1.5rem',
                border: '1.5px solid #E0E0D8',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = activeTab === 'farmers' ? '#4CAF50' : '#F9A825';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 10px 22px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E0E0D8';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Step Number Watermark */}
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: activeTab === 'farmers' ? '#1B5E20' : '#F9A825',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{step.num}</span>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E0E0D8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  {step.icon}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1B5E20', marginBottom: '0.6rem' }}>
                  {step.title[lang]}
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#555555', lineHeight: 1.55 }}>
                  {step.desc[lang]}
                </p>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px dashed #D0D0C8', fontSize: '0.75rem', fontWeight: 700, color: '#4CAF50' }}>
                ✓ {lang === 'en' ? 'Verified & Secure Process' : 'सत्यापित व सुरक्षित प्रक्रिया'}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Call to Action strip */}
        <div
          style={{
            marginTop: '3rem',
            backgroundColor: '#E8F5E9',
            border: '2px solid #C8E6C9',
            borderRadius: '20px',
            padding: '1.5rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1B5E20' }}>
              {activeTab === 'farmers'
                ? (lang === 'en' ? 'Need a tractor or harvester for tomorrow?' : 'क्या कल के लिए ट्रैक्टर या हार्वेस्टर चाहिए?')
                : (lang === 'en' ? 'Have a tractor or implement sitting idle?' : 'क्या आपका ट्रैक्टर या रोटावेटर खाली खड़ा है?')}
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#33691E', margin: 0 }}>
              {activeTab === 'farmers'
                ? (lang === 'en' ? 'Find and book in less than 3 minutes. Zero advance commission.' : '3 मिनट में खोजें और सीधे बात करें। कोई कमीशन नहीं।')
                : (lang === 'en' ? 'Earn an extra ₹30,000 to ₹1,00,000 every seasonal window.' : 'हर सीजन में ₹30,000 से ₹1,00,000 की अतिरिक्त कमाई करें।')}
            </p>
          </div>

          <div>
            {activeTab === 'farmers' ? (
              <a href="#listings" className="btn btn-primary">
                <span>{lang === 'en' ? 'Browse Available Fleet' : 'उपलब्ध मशीनें देखें'}</span>
              </a>
            ) : (
              <button onClick={onListClick} className="btn btn-secondary">
                <span>{lang === 'en' ? 'List Your Tractor Now' : 'अपना ट्रैक्टर अभी जोड़ें'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
