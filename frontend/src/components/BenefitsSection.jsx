import React from 'react';
import { CheckCircle2, TrendingUp, IndianRupee, ShieldCheck, Tractor, Users, Clock, Award } from 'lucide-react';

export default function BenefitsSection({ lang, onListClick }) {
  const farmerBenefits = [
    {
      title: { en: 'Zero Capital Burden', hi: 'लाखों के कर्ज से मुक्ति' },
      desc: {
        en: 'Save ₹6 Lakhs to ₹12 Lakhs on tractor and implement purchases. Pay only for the exact hours or acres you cultivate.',
        hi: 'ट्रैक्टर खरीदने के लिए 6 से 12 लाख का कर्ज लेने की जरूरत नहीं। सिर्फ जितने घंटे काम हो, उतने का ही भुगतान करें।'
      }
    },
    {
      title: { en: 'Access Modern High-HP Implements', hi: 'आधुनिक व उन्नत तकनीकों का लाभ' },
      desc: {
        en: 'Use advanced laser land levelers, zero-till seeders, and pneumatic drills that are otherwise unaffordable for smallholders.',
        hi: 'लेज़र लेवलर, रोटावेटर और ज़ीरो-टिल सीड ड्रिल जैसी आधुनिक मशीनों से खेत तैयार कर 20% तक पैदावार बढ़ाएं।'
      }
    },
    {
      title: { en: 'Guaranteed On-Time Availability', hi: 'बुवाई व कटाई के समय पक्की उपलब्धता' },
      desc: {
        en: 'Book in advance for sensitive sowing and harvesting windows. Prevent crop losses caused by labor and tractor shortages.',
        hi: 'सीजन के व्यस्त समय में मशीन न मिलने की चिंता खत्म। 2 दिन पहले बुक करें और खेत पर समय से काम कराएं।'
      }
    },
    {
      title: { en: '100% Transparent Local Pricing', hi: 'पारदर्शी व निश्चित दरें' },
      desc: {
        en: 'No broker margins or sudden price spikes. Compare local rates with clear terms on diesel and experienced drivers.',
        hi: 'बिचौलियों की मनमानी और ऐन वक्त पर रेट बढ़ाने से छुटकारा। स्पष्ट व निष्पक्ष घंटेवार दरें।'
      }
    }
  ];

  const ownerBenefits = [
    {
      title: { en: 'Turn Idle Days into Direct Profits', hi: 'खाली खड़े ट्रैक्टर से हर महीने कमाई' },
      desc: {
        en: 'Tractors sit idle for 15–20 days every month. Earn an extra ₹40,000 to ₹1,20,000 every seasonal window by renting to neighbors.',
        hi: 'अपने खेत का काम खत्म होने के बाद खाली दिनों में पड़ोस के किसानों को किराए पर देकर हर सीजन 40,000 से 1 लाख+ कमाएं।'
      }
    },
    {
      title: { en: 'Direct Cash Payments, Zero Commission', hi: 'पूरी कमाई सीधे आपके हाथ में' },
      desc: {
        en: 'NITI takes 0% cut. Receive 100% of your rental payment directly from the farmer via UPI or cash.',
        hi: 'नीति (NITI) 0% कमीशन लेता है। किसान से पूरा किराया सीधे आपके बैंक खाते या नकद में प्राप्त करें।'
      }
    },
    {
      title: { en: 'Digital Booking & Scheduling', hi: 'डिजिटल बुकिंग व शेड्यूल प्रबंधन' },
      desc: {
        en: 'Manage your machine-day calendar on your mobile. Avoid double-bookings and coordinate with verified local farmers.',
        hi: 'कागज़-डायरी का झंझट खत्म। मोबाइल पर बुकिंग स्वीकारें और अपने ऑपरेटर/ड्राइवर का समय आसानी से तय करें।'
      }
    },
    {
      title: { en: 'Grow a Rural Equipment Business', hi: 'ग्रामीण कृषि सेवा उद्यमी बनें' },
      desc: {
        en: 'Transform from a machine owner into a respected Custom Hiring provider in your block with verified digital trust ratings.',
        hi: 'अपने गांव व क्षेत्र में भरोसेमंद कस्टम हायरिंग प्रदाता के रूप में पहचान बनाएं और नया कृषि व्यवसाय बढ़ाएं।'
      }
    }
  ];

  return (
    <section className="section-py" style={{ backgroundColor: '#FAFAF5', borderTop: '1px solid #E0E0D8' }}>
      <div className="container">
        
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 3rem auto' }}>
          <div className="section-badge">
            <Award size={16} />
            <span>{lang === 'en' ? 'WIN-WIN PLATFORM' : 'दोनों पक्षों का लाभ'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'Designed for Every Member of the Farming Community' : 'किसान और मशीन मालिक, दोनों की उन्नति'}
          </h2>

          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {lang === 'en'
              ? 'Whether you need equipment to cultivate your field or own a tractor with spare capacity, NITI empowers you.'
              : 'चाहे आपको खेत जोतने के लिए मशीन चाहिए या आपके पास ट्रैक्टर है — नीति (NITI) दोनों को जोड़कर समृद्धि लाता है।'}
          </p>
        </div>

        {/* Two-Column Comparison Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem',
          }}
        >
          {/* Column 1: For Renting Farmers */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '2rem',
              border: '2px solid #C8E6C9',
              boxShadow: '0 8px 24px rgba(27, 94, 32, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              {/* Header Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #E8F5E9' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B5E20' }}>
                  <Users size={26} />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4CAF50', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'BENEFITS FOR RENTERS' : 'किराएदार किसानों के फायदे'}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', margin: 0 }}>
                    {lang === 'en' ? 'For Cultivating Farmers' : 'खेती करने वाले किसानों के लिए'}
                  </h3>
                </div>
              </div>

              {/* Benefit Points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                {farmerBenefits.map((b, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#E8F5E9', color: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0, marginTop: '2px' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1B5E20' }}>
                        {b.title[lang]}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#555555', marginTop: '0.2rem', lineHeight: 1.5 }}>
                        {b.desc[lang]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <a
              href="#listings"
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <span>{lang === 'en' ? 'Find Equipment for Your Farm' : 'अपने खेत के लिए मशीन खोजें'}</span>
            </a>
          </div>

          {/* Column 2: For Equipment Owners */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '2rem',
              border: '2px solid #FFE082',
              boxShadow: '0 8px 24px rgba(249, 168, 37, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              {/* Header Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #FFF8E1' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B78103' }}>
                  <Tractor size={26} />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F9A825', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'BENEFITS FOR OWNERS & CHCs' : 'मशीन मालिकों के फायदे'}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#1B5E20', margin: 0 }}>
                    {lang === 'en' ? 'For Equipment Owners & CHCs' : 'ट्रैक्टर व उपकरण मालिकों के लिए'}
                  </h3>
                </div>
              </div>

              {/* Benefit Points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                {ownerBenefits.map((b, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFF8E1', color: '#B78103', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0, marginTop: '2px' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1B5E20' }}>
                        {b.title[lang]}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#555555', marginTop: '0.2rem', lineHeight: 1.5 }}>
                        {b.desc[lang]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onListClick}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              <span>{lang === 'en' ? 'Register Your Machine Free' : 'अपनी मशीन मुफ़्त पंजीकृत करें'}</span>
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}
