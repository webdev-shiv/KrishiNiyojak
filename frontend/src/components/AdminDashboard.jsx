import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Tractor, 
  Calendar, 
  TrendingUp, 
  IndianRupee, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Search,
  Filter,
  ArrowUpRight
} from 'lucide-react';
import { 
  analyticsService, 
  centresService, 
  bookingsService, 
  machineryService, 
  farmersService, 
  operatorsService 
} from '../api/supabaseService';
import { SupabaseStatusBanner } from './SupabaseStatusBanner';

export function AdminDashboard({ lang = 'hi', t }) {
  const [stats, setStats] = useState(null);
  const [centres, setCentres] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCentreModal, setShowAddCentreModal] = useState(false);
  const [newCentre, setNewCentre] = useState({
    name: '',
    code: '',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    contact_phone: '',
    manager_name: ''
  });
  const [submittingCentre, setSubmittingCentre] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, centresData, bookingsData] = await Promise.all([
        analyticsService.getChcOverview().catch(err => { throw err; }),
        centresService.getAllCentres().catch(err => { throw err; }),
        bookingsService.getAllBookings(10).catch(err => { throw err; })
      ]);

      setStats(overviewData);
      setCentres(centresData || []);
      setRecentBookings(bookingsData || []);
    } catch (err) {
      console.error('[AdminDashboard] Live query failed:', err);
      setError(err);
      // Ensure no demo numbers are retained on failure
      setStats(null);
      setCentres([]);
      setRecentBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateCentre = async (e) => {
    e.preventDefault();
    if (!newCentre.name || !newCentre.code) return;
    setSubmittingCentre(true);
    try {
      await centresService.createCentre(newCentre);
      setShowAddCentreModal(false);
      setNewCentre({ name: '', code: '', district: 'Lucknow', state: 'Uttar Pradesh', contact_phone: '', manager_name: '' });
      await fetchDashboardData();
    } catch (err) {
      alert(`Failed to create centre: ${err.message}`);
    } finally {
      setSubmittingCentre(false);
    }
  };

  const filteredCentres = centres.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in pb-20">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-100 text-emerald-800">
              State Control Centre
            </span>
            <span className="text-xs text-gray-500 font-mono">PostgreSQL Single Source of Truth</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mt-1">
            {lang === 'hi' ? 'उत्तर प्रदेश कस्टम हायरिंग केंद्र (CHC) प्रशासन' : 'UP Custom Hiring Centre (CHC) Admin Console'}
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            {lang === 'hi'
              ? 'सुपबेस डेटाबेस से सभी केंद्रों, किसानों, ऑपरेटरों और बुकिंग का रीयल-टाइम अवलोकन'
              : 'Real-time state overview of centres, registered farmers, machinery fleet, and revenue directly from Supabase'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'hi' ? 'रिफ्रेश' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setShowAddCentreModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-niti-forest hover:bg-niti-moss text-white text-xs font-bold transition-all shadow-md shadow-niti-forest/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'नया केंद्र जोड़ें' : 'Add New CHC'}</span>
          </button>
        </div>
      </div>

      {/* Supabase Error / Status Notice */}
      <SupabaseStatusBanner error={error} onRetry={fetchDashboardData} title="Admin Database Connection Error" />

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Centres */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 block">
              {lang === 'hi' ? 'कुल CHC केंद्र' : 'Total Centres'}
            </span>
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {loading ? '...' : stats ? stats.total_centres : 0}
            </span>
          </div>
        </div>

        {/* Total Farmers */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 block">
              {lang === 'hi' ? 'पंजीकृत किसान' : 'Registered Farmers'}
            </span>
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {loading ? '...' : stats ? stats.total_farmers : 0}
            </span>
          </div>
        </div>

        {/* Total Machinery */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Tractor className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 block">
              {lang === 'hi' ? 'सक्रिय मशीनें' : 'Machinery Units'}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-gray-900 tracking-tight">
                {loading ? '...' : stats ? stats.total_machines : 0}
              </span>
              {stats && stats.active_machines > 0 && (
                <span className="text-[10px] font-bold text-emerald-600">
                  ({stats.active_machines} available)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Operators */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 block">
              {lang === 'hi' ? 'प्रमाणित चालक' : 'Operators'}
            </span>
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {loading ? '...' : stats ? stats.total_operators : 0}
            </span>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 block">
              {lang === 'hi' ? 'कुल बुकिंग्स' : 'Total Bookings'}
            </span>
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {loading ? '...' : stats ? stats.total_bookings : 0}
            </span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 block">
              {lang === 'hi' ? 'संपन्न राजस्व' : 'Completed Revenue'}
            </span>
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              ₹{loading ? '...' : stats ? Number(stats.total_revenue).toLocaleString('en-IN') : 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Section: Centres Directory & Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Centres Table (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {lang === 'hi' ? 'कस्टम हायरिंग केंद्र (Centres Directory)' : 'Registered Custom Hiring Centres'}
              </h2>
              <p className="text-xs text-gray-500">
                {centres.length} {lang === 'hi' ? 'सत्यापित केंद्र पंजीकृत' : 'verified centres loaded from Supabase'}
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={lang === 'hi' ? 'केंद्र या जिला खोजें...' : 'Search centre, district...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-niti-forest/20 w-full sm:w-60"
              />
            </div>
          </div>

          {filteredCentres.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-gray-50 border border-gray-200">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-700">
                {loading ? 'लोड हो रहा है...' : (lang === 'hi' ? 'कोई केंद्र नहीं मिला' : 'No Centres Found in Database')}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {lang === 'hi' 
                  ? 'सुपबेस डेटाबेस में कोई केंद्र रिकॉर्ड नहीं है या फ़िल्टर मेल नहीं खाता।'
                  : 'Zero records returned from Supabase. Add a new centre above or check table public.centres.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                    <th className="pb-3 px-3">Centre Code</th>
                    <th className="pb-3 px-3">Centre Name</th>
                    <th className="pb-3 px-3">District</th>
                    <th className="pb-3 px-3">Manager</th>
                    <th className="pb-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCentres.map((centre) => (
                    <tr key={centre.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-niti-forest">
                        {centre.code}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">
                        {centre.name}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {centre.district}, {centre.state}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {centre.manager_name || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          centre.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {centre.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Booking Ledger (1 Column) */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {lang === 'hi' ? 'नवीनतम बुकिंग्स' : 'Recent Bookings'}
            </h2>
            <p className="text-xs text-gray-500">
              {lang === 'hi' ? 'लाइव डेटाबेस से प्राप्त रिकॉर्ड' : 'Real database queries from public.bookings'}
            </p>
          </div>

          {recentBookings.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-gray-50 border border-gray-200">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <h3 className="text-xs font-bold text-gray-700">
                {lang === 'hi' ? 'कोई बुकिंग उपलब्ध नहीं' : 'No Bookings Recorded Yet'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                {lang === 'hi' ? 'किसान जब मशीन अनुरोध करेंगे तो यहां प्रदर्शित होगी।' : 'Real farmer bookings will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b) => (
                <div key={b.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-niti-forest">
                      {b.booking_reference || b.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.status === 'Completed' || b.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700 font-semibold">
                    {b.operation} • {b.crop || 'Crop'} ({b.farm_area || 5} Acres)
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/50">
                    <span>{b.scheduled_date}</span>
                    <span className="font-bold text-gray-900">₹{b.total_price}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add New Centre Modal */}
      {showAddCentreModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-fade-in space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {lang === 'hi' ? 'नया कस्टम हायरिंग केंद्र पंजीकृत करें' : 'Register New Custom Hiring Centre'}
            </h3>
            <form onSubmit={handleCreateCentre} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Centre Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sundarpur Agro Service Hub"
                  value={newCentre.name}
                  onChange={(e) => setNewCentre({ ...newCentre, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CHC-UP-001"
                    value={newCentre.code}
                    onChange={(e) => setNewCentre({ ...newCentre, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={newCentre.district}
                    onChange={(e) => setNewCentre({ ...newCentre, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Manager Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
                  value={newCentre.manager_name}
                  onChange={(e) => setNewCentre({ ...newCentre, manager_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={newCentre.contact_phone}
                  onChange={(e) => setNewCentre({ ...newCentre, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCentreModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCentre}
                  className="px-4 py-2 rounded-xl bg-niti-forest hover:bg-niti-moss text-white font-bold"
                >
                  {submittingCentre ? 'Saving...' : 'Save to Supabase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
