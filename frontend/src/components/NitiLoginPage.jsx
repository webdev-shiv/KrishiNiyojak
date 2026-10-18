import React, { useState } from 'react';
import { 
  LogIn, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  X,
  Send,
  Tractor,
  Users,
  Wheat
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { supabase } from '../api/supabaseClient';

export function NitiLoginPage({ onLoginSuccess, onBackToLanding, lang = 'en', onDemoLogin, initialRole = 'FARMER' }) {
  const [selectedRole, setSelectedRole] = useState(initialRole || 'FARMER'); // FARMER, CHC_MANAGER, OPERATOR
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Handle Sign In submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      let data;
      // 1. First attempt Supabase Auth if user has registered account
      if (supabase) {
        try {
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password,
          });
          if (!supaErr && supaData?.user) {
            data = {
              access_token: supaData.session?.access_token || 'supa-token',
              user: {
                id: supaData.user.id,
                email: supaData.user.email,
                role: selectedRole,
                full_name: supaData.user.user_metadata?.full_name || email.split('@')[0],
              }
            };
          }
        } catch (sErr) {
          console.warn('[NitiLogin] Supabase sign-in fallback to backend API:', sErr);
        }
      }

      // 2. If not signed in via Supabase directly, call NITI backend auth endpoints
      if (!data) {
        if (selectedRole === 'FARMER') {
          data = await nitiClient.loginFarmer({ email: email.trim(), password });
        } else if (selectedRole === 'CHC_MANAGER') {
          data = await nitiClient.loginChc({ email: email.trim(), password });
        } else {
          data = await nitiClient.loginOperator({ email: email.trim(), password });
        }
      }

      setSuccessMsg(`Welcome back! Loading ${selectedRole === 'CHC_MANAGER' ? 'CHC Manager' : selectedRole === 'OPERATOR' ? 'Operator' : 'Farmer'} Dashboard...`);
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data, selectedRole);
        }
      }, 500);
    } catch (err) {
      console.error('[NitiLogin] Authentication error:', err);
      setErrorMsg(err.message || 'Invalid credentials or user not found. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // Handle 1-Click Quick Demo Login
  const handleQuickDemo = (role) => {
    if (onDemoLogin) {
      onDemoLogin(role);
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
    setSuccessMsg(`Instant Demo login verified. Opening ${role} Dashboard...`);
    setTimeout(() => {
      if (onLoginSuccess) {
        onLoginSuccess({ user: demoUser, role, access_token: 'demo-token-' + role }, role);
      }
    }, 300);
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      if (supabase) {
        await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
          redirectTo: window.location.origin,
        });
      }
      setForgotSubmitted(true);
    } catch (err) {
      console.warn('Password reset error:', err);
      setForgotSubmitted(true);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden select-none font-sans antialiased">
      
      {/* =========================================================================
          1. SKY-BLUE GRADIENT BACKGROUND & SOFT ATMOSPHERIC CLOUDS
         ========================================================================= */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 15%, rgba(255, 255, 255, 0.45) 0%, rgba(191, 227, 253, 0.25) 45%, transparent 75%), linear-gradient(180deg, #7eb9f7 0%, #9bcbf8 30%, #bde0fa 55%, #daf0fd 75%, #ebf7fe 100%)'
        }}
      />

      {/* Atmospheric Concentric Glowing Rings (Exact match to reference art) */}
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40" 
        viewBox="0 0 1440 900" 
        fill="none" 
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="720" cy="450" r="380" stroke="white" strokeWidth="1.5" strokeDasharray="6 6" />
        <circle cx="720" cy="450" r="540" stroke="white" strokeWidth="1" opacity="0.6" />
        <circle cx="720" cy="450" r="700" stroke="white" strokeWidth="1" opacity="0.4" />
      </svg>

      {/* Realistic Soft Fluffy Cloud Silhouette Layers at the Bottom */}
      <div className="absolute bottom-0 left-0 right-0 w-full pointer-events-none z-0 overflow-hidden leading-none">
        <svg 
          className="w-full h-44 sm:h-64 text-white/40 fill-current translate-y-6" 
          viewBox="0 0 1440 320" 
          preserveAspectRatio="none"
        >
          <path d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,229.3C960,213,1056,171,1152,160C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
        <svg 
          className="absolute bottom-0 w-full h-36 sm:h-52 text-white/70 fill-current translate-y-3" 
          viewBox="0 0 1440 320" 
          preserveAspectRatio="none"
        >
          <path d="M0,256L48,261.3C96,267,192,277,288,266.7C384,256,480,224,576,213.3C672,203,768,213,864,229.3C960,245,1056,267,1152,261.3C1248,256,1344,224,1392,208L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
        <svg 
          className="absolute bottom-0 w-full h-28 sm:h-40 text-white fill-current" 
          viewBox="0 0 1440 320" 
          preserveAspectRatio="none"
        >
          <path d="M0,288L60,277.3C120,267,240,245,360,250.7C480,256,600,288,720,288C840,288,960,256,1080,245.3C1200,235,1320,245,1380,250.7L1440,256L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
        </svg>
      </div>

      {/* =========================================================================
          2. MINIMAL NITI BRANDING AT TOP-LEFT (Exact match to reference 'Ebolt')
         ========================================================================= */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-10 flex items-center gap-2.5 z-20">
        <button 
          onClick={onBackToLanding}
          className="flex items-center gap-2.5 text-gray-900 hover:opacity-80 transition-all cursor-pointer group"
          title="Return to website"
        >
          <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            {/* Minimalist modern NITI 4-leaf pinwheel motif */}
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12,2C10.5,5 8.5,8 6,9C9,10.5 12,12.5 13,15C14.5,12 16.5,9 19,8C16,6.5 13,4.5 12,2Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          </div>
          <span className="font-extrabold text-base tracking-tight text-gray-900">
            NITI
          </span>
        </button>
      </div>

      {/* Back Link on Top-Right */}
      {onBackToLanding && (
        <div className="absolute top-6 right-6 sm:top-8 sm:right-10 z-20">
          <button
            onClick={onBackToLanding}
            className="text-xs font-bold text-gray-700 hover:text-gray-950 px-3.5 py-1.5 rounded-full bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          3. CENTERED TRANSLUCENT GLASSMORPHISM LOGIN CARD
         ========================================================================= */}
      <div className="relative z-10 w-full max-w-[420px] mx-auto animate-scale-up">
        
        {/* The Glassmorphism Container */}
        <div className="backdrop-blur-xl bg-white/75 sm:bg-white/70 rounded-[32px] p-7 sm:p-9 shadow-[0_20px_50px_-12px_rgba(28,78,137,0.18)] border border-white/80 transition-all">
          
          {/* Card Top Icon: Centered white squircle with login door symbol */}
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white shadow-xs border border-gray-100 flex items-center justify-center text-gray-900 mb-4 transition-transform hover:scale-105">
            <LogIn className="w-5 h-5 ml-0.5" />
          </div>

          {/* Heading & Subtitle (Exact typography from reference) */}
          <div className="text-center mb-5">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-snug">
              Welcome Back to NITI
            </h1>
            <p className="text-xs text-gray-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
              Sign in to manage your agricultural operations.
            </p>
          </div>

          {/* Role Selector Pill */}
          <div className="flex p-1 bg-gray-100/80 rounded-xl mb-4 text-xs font-bold text-gray-600">
            {[
              { id: 'FARMER', label: 'Farmer' },
              { id: 'CHC_MANAGER', label: 'CHC Manager' },
              { id: 'OPERATOR', label: 'Operator' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRole(r.id);
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedRole === r.id 
                    ? 'bg-white text-gray-900 shadow-2xs font-extrabold' 
                    : 'hover:text-gray-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email Field */}
            <div>
              <div className="relative rounded-xl bg-gray-50/90 border border-gray-200/90 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex items-center px-3.5 py-3">
                <Mail className="w-4 h-4 text-gray-400 shrink-0 mr-2.5" />
                <input
                  type="email"
                  id="niti-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedRole === 'FARMER' ? 'farmer.ajay@niti.in' :
                    selectedRole === 'CHC_MANAGER' ? 'manager.chc001@niti.in' : 'operator.virendra@niti.in'
                  }
                  required
                  autoComplete="email"
                  className="w-full bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="relative rounded-xl bg-gray-50/90 border border-gray-200/90 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex items-center px-3.5 py-3">
                <Lock className="w-4 h-4 text-gray-400 shrink-0 mr-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="niti-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 ml-2 cursor-pointer p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Primary Action Button: "Sign In" (Matching reference dark pill) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#18181b] hover:bg-[#27272a] text-white py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Divider: "Or quick demo access" */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200/80"></div>
            </div>
            <span className="relative px-3 bg-white/70 text-[10px] sm:text-[11px] font-medium text-gray-400 backdrop-blur-xs">
              Or quick demo access
            </span>
          </div>

          {/* 3 Social/Role Demo Action Buttons (Exact squircle style from reference) */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickDemo('FARMER')}
              className="py-2.5 px-2 rounded-xl bg-white border border-gray-200/90 hover:border-gray-300 hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-1 shadow-2xs cursor-pointer group"
              title="One-click Farmer Demo"
            >
              <Wheat className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-gray-700">Farmer</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('CHC_MANAGER')}
              className="py-2.5 px-2 rounded-xl bg-white border border-gray-200/90 hover:border-gray-300 hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-1 shadow-2xs cursor-pointer group"
              title="One-click CHC Manager Demo"
            >
              <Tractor className="w-4 h-4 text-blue-700 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-gray-700">CHC</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('OPERATOR')}
              className="py-2.5 px-2 rounded-xl bg-white border border-gray-200/90 hover:border-gray-300 hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-1 shadow-2xs cursor-pointer group"
              title="One-click Operator Demo"
            >
              <Users className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-gray-700">Operator</span>
            </button>
          </div>

        </div>

      </div>

      {/* =========================================================================
          4. FORGOT PASSWORD MODAL
         ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-900 text-sm">Reset Password</h3>
              <button 
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotSubmitted(false);
                }}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="space-y-3 text-center py-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-gray-900 text-sm">Instructions Sent</h4>
                <p className="text-xs text-gray-500">
                  If an account exists for <strong className="text-gray-800">{forgotEmail}</strong>, password reset guidance has been dispatched.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSubmitted(false);
                  }}
                  className="w-full mt-2 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <p className="text-xs text-gray-500">
                  Enter your registered NITI email address. We will verify and send secure reset instructions.
                </p>
                <div>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    {forgotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Reset Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
