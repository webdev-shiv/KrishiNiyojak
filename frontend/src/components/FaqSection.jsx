import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { faqs } from '../data/agriData';

export default function FaqSection({ lang }) {
  const [openIdx, setOpenIdx] = useState(0); // Open first by default

  const toggleAccordion = (index) => {
    setOpenIdx(openIdx === index ? -1 : index);
  };

  return (
    <section id="faq" className="section-py" style={{ backgroundColor: '#FAFAF5', borderTop: '1px solid #E0E0D8' }}>
      <div className="container">
        
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 3rem auto' }}>
          <div className="section-badge">
            <HelpCircle size={16} />
            <span>{lang === 'en' ? 'FREQUENTLY ASKED QUESTIONS' : 'अक्सर पूछे जाने वाले सवाल'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'Got Questions? We Have Answers.' : 'आपके सवाल, हमारे जवाब'}
          </h2>

          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {lang === 'en'
              ? 'Everything you need to know about renting or listing farm equipment on NITI.'
              : 'नीति (NITI) पर ट्रैक्टर किराए पर लेने और अपनी मशीन लिस्ट करने से जुड़ी सभी ज़रूरी जानकारियां।'}
          </p>
        </div>

        {/* Accordion List */}
        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqs.map((faq, index) => {
            const isOpen = openIdx === index;
            return (
              <div
                key={index}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: isOpen ? '2px solid #1B5E20' : '1px solid #E0E0D8',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  boxShadow: isOpen ? '0 6px 16px rgba(27, 94, 32, 0.08)' : '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  style={{
                    width: '100%',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: isOpen ? '#1B5E20' : '#212121'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      lineHeight: 1.35
                    }}
                  >
                    {faq.q[lang]}
                  </span>

                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isOpen ? '#E8F5E9' : '#FAFAF5',
                      color: isOpen ? '#1B5E20' : '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shrink: 0
                    }}
                  >
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 1.5rem 1.25rem 1.5rem',
                      fontSize: '0.95rem',
                      color: '#555555',
                      lineHeight: 1.65,
                      borderTop: '1px solid #F1F1E8',
                      paddingTop: '0.85rem'
                    }}
                  >
                    {faq.a[lang]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
