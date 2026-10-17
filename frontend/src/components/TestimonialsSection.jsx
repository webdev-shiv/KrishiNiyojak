import React, { useState } from 'react';
import { Star, Quote, Heart, CheckCircle2, MessageSquareText } from 'lucide-react';
import { testimonials } from '../data/agriData';

export default function TestimonialsSection({ lang }) {
  const [activeStoryTab, setActiveStoryTab] = useState('farmers'); // 'farmers' or 'owners'

  const currentList = activeStoryTab === 'farmers' ? testimonials.farmers : testimonials.owners;

  return (
    <section id="testimonials" className="section-py" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E0E0D8' }}>
      <div className="container">
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 2.5rem auto' }}>
          <div className="section-badge">
            <MessageSquareText size={16} />
            <span>{lang === 'en' ? "VOICES FROM INDIA'S FARMLANDS" : 'किसानों के अनुभव'}</span>
          </div>

          <h2 className="section-title">
            {lang === 'en' ? 'Trusted by Those Who Feed the Nation' : 'देश का पेट भरने वाले किसानों का विश्वास'}
          </h2>

          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {lang === 'en'
              ? 'Real stories of timely crop sowing, cost savings, and tractor owner prosperity powered by direct rentals.'
              : 'समय पर बुवाई, भारी बचत और ट्रैक्टर मालिकों की अतिरिक्त आय की सच्ची कहानियां।'}
          </p>

          {/* Tab Switcher */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#FAFAF5',
              border: '2px solid #E0E0D8',
              borderRadius: '9999px',
              padding: '0.35rem',
              marginTop: '1.75rem'
            }}
          >
            <button
              onClick={() => setActiveStoryTab('farmers')}
              style={{
                padding: '0.6rem 1.4rem',
                borderRadius: '9999px',
                fontSize: '0.9rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: activeStoryTab === 'farmers' ? '#1B5E20' : 'transparent',
                color: activeStoryTab === 'farmers' ? '#FFFFFF' : '#555555'
              }}
            >
              {lang === 'en' ? '🌾 Farmer Stories' : '🌾 किसान अनुभव (किराएदार)'}
            </button>

            <button
              onClick={() => setActiveStoryTab('owners')}
              style={{
                padding: '0.6rem 1.4rem',
                borderRadius: '9999px',
                fontSize: '0.9rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: activeStoryTab === 'owners' ? '#F9A825' : 'transparent',
                color: activeStoryTab === 'owners' ? '#212121' : '#555555'
              }}
            >
              {lang === 'en' ? '🚜 Machine Owner Stories' : '🚜 ट्रैक्टर व मशीन मालिक अनुभव'}
            </button>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.75rem',
          }}
        >
          {currentList.map((item) => (
            <div
              key={item.id}
              className="agri-card"
              style={{
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              {/* Quote Mark Watermark */}
              <div
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  color: activeStoryTab === 'farmers' ? '#C8E6C9' : '#FFE082',
                  opacity: 0.6
                }}
              >
                <Quote size={40} />
              </div>

              <div>
                {/* 5-Star Rating */}
                <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '1rem', color: '#F9A825' }}>
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} size={18} fill="#F9A825" />
                  ))}
                </div>

                {/* Quote Text */}
                <p
                  style={{
                    fontSize: '0.98rem',
                    color: '#333333',
                    lineHeight: 1.65,
                    fontStyle: 'italic',
                    marginBottom: '1.5rem',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  "{item.quote[lang]}"
                </p>
              </div>

              {/* Author Profile */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #EAEAE0'
                }}
              >
                <img
                  src={item.avatar}
                  alt={item.name}
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #1B5E20'
                  }}
                  loading="lazy"
                />

                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1B5E20', margin: 0 }}>
                    {lang === 'en' ? item.name : item.nameHi}
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: '#555555', marginTop: '0.15rem' }}>
                    {lang === 'en' ? item.village : item.villageHi}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4CAF50', marginTop: '0.15rem' }}>
                    {activeStoryTab === 'farmers'
                      ? (lang === 'en' ? `Cultivates: ${item.crop}` : `खेती: ${item.cropHi}`)
                      : (lang === 'en' ? item.machines : item.machinesHi)}
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
