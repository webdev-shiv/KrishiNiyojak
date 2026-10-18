import React, { useState } from 'react';
import { X, Smartphone, Mail, Lock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { translations } from '../data/translations';

export function RoleAuthModal({ isOpen, onClose, lang = 'en', onLoginSuccess, initialRole = 'FARMER', onOpenSplitScreenChc, onDemoLogin }) {
  if (!isOpen) return null;

  const t = translations[lang] || translations.en;
  const [activeTab, setActiveTab] = useState(initialRole || 'FARMER'); // FARMER, CHC_MANAGER, OPERATOR

  // Form states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePasswordLogin, setUsePasswordLogin] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDemoClick = (role) => {
    if (onDemoLogin) {
      onDemoLogin(role);
      onClose();
      return;
    }

    let demoUser;
    if (role === 'FARMER') {
      demoUser = {
        id: 'F0001',
        farmer_id: 'F0001',
        user_id: 'F0001',
        full_name: 'Ajay Verma',
        name: 'Ajay Verma',
        email: 'farmer.ajay@niti.in',
        phone_number: '+919876543210',
        village: 'Dhanipur Kalan',
        district: 'Agra',
        role: 'FARMER'
      };
    } else if (role === 'CHC_MANAGER') {
      demoUser = {
        id: 'CHC001',
        centre_id: 'CHC001',
        user_id: 'CHC001',
        full_name: 'Ramesh Patel',
        name: 'CHC Pur Kalan',
        centre_name: 'CHC Pur Kalan',
        email: 'manager.chc001@niti.in',
        phone_number: '+919876500001',
        village: 'Gaon',
        district: 'Aligarh',
        role: 'CHC_MANAGER'
      };
    } else {
      demoUser = {
        id: 'OP001',
        operator_id: 'OP001',
        user_id: 'OP001',
        full_name: 'Virendra Patel',
        name: 'Virendra Patel',
        email: 'operator.virendra@niti.in',
        phone_number: '+919876500034',
        village: 'Rampur Majra',
        district: 'Sitapur',
        centre_id: 'CHC025',
        role: 'OPERATOR'
      };
    }

    nitiClient.setSession('demo-token-' + role, demoUser, role);
    setSuccessMsg(`Instant Demo Login verified! Loading ${role} Dashboard...`);
    setTimeout(() => {
      onClose();
      if (onLoginSuccess) {
        onLoginSuccess({ user: demoUser, role: role, access_token: 'demo-token-' + role }, role);
      }
    }, 300);
  };

  const resetForm = () => {
    setPhone('');
    setOtp('');
    setOtpSent(false);
    setEmail('');
    setPassword('');
    setErrorMsg('');
    setSuccessMsg('');
    setUsePasswordLogin(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetForm();
  };

  // Send OTP
  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      setErrorMsg(lang === 'hi' ? 'कृपया सही 10-अंकों का मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await nitiClient.sendOtp(phone, activeTab);
      setOtpSent(true);
      setSuccessMsg(res.message);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP & Login
  const handleVerifyAndLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      let data;
      if (activeTab === 'FARMER') {
        if (usePasswordLogin) {
          data = await nitiClient.loginFarmer({ email, password });
        } else {
          data = await nitiClient.loginFarmer({ phoneNumber: phone, otpCode: otp });
        }
      } else if (activeTab === 'CHC_MANAGER') {
        if (usePasswordLogin || !otpSent) {
          data = await nitiClient.loginChc({ email, password });
        } else {
          data = await nitiClient.loginChc({ phoneNumber: phone, otpCode: otp });
        }
      } else {
        // OPERATOR
        if (usePasswordLogin) {
          data = await nitiClient.loginOperator({ email, password });
        } else {
          data = await nitiClient.loginOperator({ phoneNumber: phone, otpCode: otp });
        }
      }

      setSuccessMsg(t.auth.loginSuccess);
      setTimeout(() => {
        onClose();
        if (onLoginSuccess) {
          onLoginSuccess(data, activeTab);
        }
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      backgroundColor: 'rgba(15, 41, 30, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 50px rgba(19, 78, 46, 0.25)',
        overflow: 'hidden',
        border: '1px solid #bbf7d0',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '24px 28px 16px',
          backgroundColor: '#f0fdf4',
          borderBottom: '1px solid #e2ede6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: '#134e2e', marginBottom: '8px' }}>
              <ShieldCheck size={14} />
              {lang === 'hi' ? 'सुरक्षित OTP प्रमाणीकरण' : 'Secure Role-Based Access'}
            </div>
            <h2 style={{ fontSize: '1.4rem', color: '#134e2e', margin: 0 }}>{t.auth.title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#4b6354' }}>{t.auth.subtitle}</p>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '50%', backgroundColor: '#ffffff', color: '#4b6354' }}>
            <X size={20} />
          </button>
        </div>

        {/* 3 Role Selection Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2ede6', backgroundColor: '#ffffff' }}>
          <button
            onClick={() => handleTabChange('FARMER')}
            style={{
              flex: 1,
              padding: '14px 8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'FARMER' ? '#134e2e' : '#718a7b',
              borderBottom: activeTab === 'FARMER' ? '3px solid #134e2e' : '3px solid transparent',
              backgroundColor: activeTab === 'FARMER' ? '#f0fdf4' : 'transparent',
            }}
          >
            🌾 {t.auth.farmerTab}
          </button>
          <button
            onClick={() => handleTabChange('CHC_MANAGER')}
            style={{
              flex: 1,
              padding: '14px 8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'CHC_MANAGER' ? '#134e2e' : '#718a7b',
              borderBottom: activeTab === 'CHC_MANAGER' ? '3px solid #134e2e' : '3px solid transparent',
              backgroundColor: activeTab === 'CHC_MANAGER' ? '#f0fdf4' : 'transparent',
            }}
          >
            🏢 {t.auth.chcTab}
          </button>
          <button
            onClick={() => handleTabChange('OPERATOR')}
            style={{
              flex: 1,
              padding: '14px 8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'OPERATOR' ? '#134e2e' : '#718a7b',
              borderBottom: activeTab === 'OPERATOR' ? '3px solid #134e2e' : '3px solid transparent',
              backgroundColor: activeTab === 'OPERATOR' ? '#f0fdf4' : 'transparent',
            }}
          >
            🚜 {t.auth.operatorTab}
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px' }}>
          
          {/* ONE-CLICK DEMO LOGIN (All 3 Dashboards End-to-End) */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #86efac',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#0f3d23', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Sparkles size={14} color="#16a34a" />
                <span>One-Click Demo Login</span>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px' }}>
                End-to-End Live
              </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#374151' }}>
              Instant access to explore live dashboards without OTP or password:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleDemoClick('FARMER')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #bbf7d0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontSize: '1rem', marginBottom: '2px' }}>🌾</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f3d23' }}>Farmer</div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Ajay Verma</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoClick('CHC_MANAGER')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #bbf7d0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontSize: '1rem', marginBottom: '2px' }}>🏢</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f3d23' }}>CHC Hub</div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Pur Kalan</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoClick('OPERATOR')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #bbf7d0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontSize: '1rem', marginBottom: '2px' }}>🚜</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f3d23' }}>Worker</div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>V. Patel</div>
              </button>
            </div>
          </div>

          {activeTab === 'CHC_MANAGER' && onOpenSplitScreenChc && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={onOpenSplitScreenChc}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #134e2e',
                  borderRadius: '12px',
                  color: '#134e2e',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                🏢 {lang === 'hi' ? 'समर्पित पूर्ण स्क्रीन लॉगिन पोर्टल खोलें' : 'Open Dedicated Split-Screen Login Page'}
              </button>
            </div>
          )}

          {/* Alerts */}
          {errorMsg && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Content: Mobile OTP Flow or Password */}
          {!usePasswordLogin && activeTab !== 'CHC_MANAGER' ? (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                  {t.auth.phoneLabel}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Smartphone size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#718a7b' }} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t.auth.phonePlaceholder}
                      disabled={otpSent}
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 38px',
                        borderRadius: '10px',
                        border: '1.5px solid #e2ede6',
                        fontSize: '0.95rem',
                      }}
                    />
                  </div>
                  {!otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading || !phone}
                      className="btn-primary"
                      style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : t.auth.sendOtp}
                    </button>
                  )}
                </div>
              </div>

              {otpSent && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f291e' }}>
                      {t.auth.enterOtp}
                    </label>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      style={{ fontSize: '0.75rem', color: '#134e2e', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {lang === 'hi' ? 'नंबर बदलें' : 'Change Phone'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1.5px solid #16a34a',
                      fontSize: '1.2rem',
                      letterSpacing: '6px',
                      textAlign: 'center',
                      fontWeight: 700,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: '#718a7b' }}>
                    <span>{lang === 'hi' ? 'प्राप्त 6-अंकों का OTP दर्ज करें' : 'Enter 6-digit OTP'}</span>
                    <button type="button" onClick={handleSendOtp} style={{ color: '#134e2e', fontWeight: 600 }}>
                      {t.auth.resendOtp}
                    </button>
                  </div>
                </div>
              )}

              {otpSent && (
                <button
                  type="button"
                  onClick={handleVerifyAndLogin}
                  disabled={loading || otp.length < 6}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      {t.auth.verifyAndLogin}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              )}

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setUsePasswordLogin(true)}
                  style={{ fontSize: '0.85rem', color: '#134e2e', fontWeight: 600 }}
                >
                  {t.auth.orUsePassword}
                </button>
              </div>
            </div>
          ) : (
            /* Email & Password login (Preferred for CHC, alternative for Farmer/Operator) */
            <form onSubmit={handleVerifyAndLogin}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                  {t.auth.emailLabel}
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#718a7b' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={activeTab === 'CHC_MANAGER' ? 'chc@niti.org' : 'farmer@niti.org'}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 38px',
                      borderRadius: '10px',
                      border: '1.5px solid #e2ede6',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f291e', marginBottom: '6px' }}>
                  {t.auth.passwordLabel}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#718a7b' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 38px',
                      borderRadius: '10px',
                      border: '1.5px solid #e2ede6',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    {t.auth.emailLoginBtn}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {activeTab !== 'CHC_MANAGER' && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setUsePasswordLogin(false)}
                    style={{ fontSize: '0.85rem', color: '#134e2e', fontWeight: 600 }}
                  >
                    {t.auth.orUseOtp}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoleAuthModal;
