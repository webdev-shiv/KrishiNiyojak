import React, { useState } from 'react';
import { 
  Tractor, 
  Lock, 
  Mail, 
  Smartphone, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2,
  MapPin,
  Calendar,
  Users
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';

export function ChcLoginPage({ onLoginSuccess, onSwitchToFarmer, lang = 'hi' }) {
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      let data;
      if (loginMethod === 'password') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both your registered email and password.');
        }
        data = await nitiClient.loginChc({ email: email.trim(), password });
      } else {
        if (!phone.trim() || !otp.trim()) {
          throw new Error('Please enter your 10-digit mobile number and the OTP code received.');
        }
        data = await nitiClient.loginChc({ phoneNumber: phone.trim(), otpCode: otp.trim() });
      }

      setSuccessMsg(`Welcome, ${data.user?.full_name || 'Manager'}! Accessing CHC Dashboard...`);
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data, 'CHC_MANAGER');
        }
      }, 500);
    } catch (err) {
      console.error('CHC Login failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials or ensure your account has CHC Manager authorization.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit registered mobile number.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await nitiClient.sendOtp(phone, 'CHC_MANAGER');
      setOtpSent(true);
      setSuccessMsg(res.message || 'OTP sent successfully to registered mobile.');
    } catch (err) {
      setErrorMsg(err.message || 'Could not dispatch OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#f8faf8] font-sans antialiased text-gray-800">
      {/* Left Column: Agricultural Visual & NITI Brand Banner */}
      <div 
        style={{ background: 'linear-gradient(135deg, #0e3822 0%, #134e2e 50%, #1e5c38 100%)' }}
        className="w-full md:w-1/2 lg:w-5/12 text-white p-8 md:p-14 flex flex-col justify-between relative overflow-hidden select-none shadow-2xl"
      >
        {/* Subtle decorative background circles / field lines */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-emerald-300/10 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
              <Tractor className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight leading-none text-white">
                Machine-Day <span className="text-emerald-400">Composer</span>
              </div>
              <div className="text-xs uppercase tracking-widest text-emerald-200/80 font-bold mt-1">
                NITI — Agri-Logistics Portal
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Custom Hiring Centre Portal
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Empowering CHCs with Automated Scheduling & Machine Fleet Management
            </h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed max-w-md">
              Review farmer bookings, match compatible implements, assign qualified operators, and coordinate timely field operations with zero scheduling conflicts.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="relative z-10 my-10 space-y-3.5">
          <div className="flex items-start gap-3 bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Cluster-Based Route Optimization</div>
              <div className="text-[11px] text-emerald-200/70">Minimize deadhead travel between fragmented farmer plots</div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Conflict-Free Machine-Day Composition</div>
              <div className="text-[11px] text-emerald-200/70">Automated machine horsepower and attachment pairing checks</div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Operator Roster & Live Status Sync</div>
              <div className="text-[11px] text-emerald-200/70">Real-time status updates synchronized between Farmer and CHC</div>
            </div>
          </div>
        </div>

        {/* Bottom Banner Footer */}
        <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-emerald-200/80">
          <span>Sundarpur CHC Operations</span>
          <span className="font-mono">v2.4.0-NITI</span>
        </div>
      </div>

      {/* Right Column: Split Screen Login Form */}
      <div className="w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                CHC Manager Sign In
              </span>
              <button
                type="button"
                onClick={onSwitchToFarmer}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
              >
                ← Switch to Farmer Portal
              </button>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Welcome back, Manager
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Sign in with your registered Custom Hiring Centre credentials to access your dashboard.
            </p>
          </div>

          {/* ONE-CLICK DEMO ACCESS (End-to-End) */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                ⚡ One-Click Demo Login
              </span>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                All 3 Dashboards
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/80 mb-3">
              Instantly test and view the full live dashboard end-to-end:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  const demoUser = {
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
                  nitiClient.setSession('demo-token-chc', demoUser, 'CHC_MANAGER');
                  if (onLoginSuccess) onLoginSuccess({ user: demoUser, role: 'CHC_MANAGER', access_token: 'demo-token-chc' }, 'CHC_MANAGER');
                }}
                className="p-2.5 rounded-xl bg-white border border-emerald-400 hover:border-emerald-600 hover:shadow-sm text-left transition-all active:scale-95 group"
              >
                <div className="text-base mb-0.5">🏢</div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">CHC Hub</div>
                <div className="text-[9px] text-slate-500">Pur Kalan</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoUser = {
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
                  nitiClient.setSession('demo-token-farmer', demoUser, 'FARMER');
                  if (onLoginSuccess) onLoginSuccess({ user: demoUser, role: 'FARMER', access_token: 'demo-token-farmer' }, 'FARMER');
                }}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all active:scale-95 group"
              >
                <div className="text-base mb-0.5">🌾</div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">Farmer</div>
                <div className="text-[9px] text-slate-500">Ajay Verma</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoUser = {
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
                  nitiClient.setSession('demo-token-op', demoUser, 'OPERATOR');
                  if (onLoginSuccess) onLoginSuccess({ user: demoUser, role: 'OPERATOR', access_token: 'demo-token-op' }, 'OPERATOR');
                }}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all active:scale-95 group"
              >
                <div className="text-base mb-0.5">🚜</div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">Worker</div>
                <div className="text-[9px] text-slate-500">V. Patel</div>
              </button>
            </div>
          </div>

          {/* Auth Method Switch: Email & Password vs Phone & OTP */}
          <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setErrorMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                loginMethod === 'password'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Registered Email & Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('otp'); setErrorMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                loginMethod === 'otp'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mobile OTP Verification
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {loginMethod === 'password' ? (
              <>
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. manager.singh@niti.org"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      required
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Mobile Phone Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Registered 10-Digit Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Smartphone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+919876543211"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold border border-gray-300 transition-colors"
                    >
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {/* OTP Code Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    6-Digit One-Time Password (OTP)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP code"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white tracking-widest text-center font-mono font-bold"
                  />
                </div>
              </>
            )}

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500 border-gray-300"
                />
                Remember this device for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#134e2e] hover:bg-[#0e3822] text-white text-sm font-bold shadow-md shadow-[#134e2e]/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In to CHC Portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note on security */}
          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Role-protected endpoint. Only authorized CHC Managers may access this portal.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reset Manager Password</h3>
            <p className="text-xs text-gray-600">
              Enter your registered CHC email address and an account recovery link will be dispatched by the NITI administrator.
            </p>

            {forgotSubmitted ? (
              <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 border border-emerald-200">
                Password recovery request recorded for {forgotEmail}. Please check your administrator inbox.
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="manager@sundarpur-chc.in"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setForgotSubmitted(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold"
                >
                  Send Recovery Link
                </button>
              </div>
            )}

            <div className="text-right pt-2">
              <button
                type="button"
                onClick={() => { setShowForgotModal(false); setForgotSubmitted(false); }}
                className="text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
