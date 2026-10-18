import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Custom error class for Supabase connection & configuration issues
 */
export class SupabaseError extends Error {
  constructor(message, details = null, code = 'SUPABASE_ERROR') {
    super(message);
    this.name = 'SupabaseError';
    this.details = details;
    this.code = code;
  }
}

const checkClient = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new SupabaseError(
      'Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.',
      null,
      'UNCONFIGURED'
    );
  }
  return supabase;
};

// ==========================================
// Field Normalizers (Handles both synthetic & UUID schemas)
// ==========================================
export const normalizeCentre = (c) => {
  if (!c) return c;
  return {
    ...c,
    id: c.centre_id || c.id,
    name: c.centre_name || c.name,
    code: c.centre_id || c.code || 'CHC-001',
    district: c.district || 'Uttar Pradesh',
    state: c.state || c.region || 'Uttar Pradesh',
    village: c.village || '',
    status: c.status || 'ACTIVE',
    contact_phone: c.contact_phone || '+91 98765 43210',
    manager_name: c.manager_name || 'CHC Manager',
  };
};

export const normalizeMachine = (m) => {
  if (!m) return m;
  const rawType = m.machine_type || m.name || 'Tractor';
  let category = m.category;
  if (!category) {
    const l = rawType.toLowerCase();
    if (l.includes('thresher')) category = 'post-harvest';
    else if (l.includes('harvester')) category = 'harvesters';
    else if (l.includes('rotavator')) category = 'tillage';
    else if (l.includes('sprayer')) category = 'sprayers';
    else if (l.includes('leveler')) category = 'land-prep';
    else if (l.includes('seeder') || l.includes('drill')) category = 'seed-drills';
    else category = 'tractors';
  }

  return {
    ...m,
    id: m.machine_id || m.id,
    name: rawType,
    category,
    model: m.model || rawType,
    horsepower: m.horsepower != null ? m.horsepower : null,
    rate: m.rate != null ? m.rate : (m.hourly_rate_inr != null ? m.hourly_rate_inr : (m.rate_per_acre_inr != null ? m.rate_per_acre_inr : null)),
    rate_unit: m.rate_unit || (m.billing_basis === 'acre' ? 'Acre' : (m.hourly_rate_inr ? 'Hour' : null)),
    status: m.status || (m.is_available !== undefined ? (m.is_available ? 'Available' : 'Unavailable') : 'Available'),
    district: m.district || m.centres?.district || null,
    state: m.state || m.centres?.state || 'Uttar Pradesh',
    image_url: m.image_url || '/assets/card-e.jpg',
    fuel_included: m.fuel_included !== undefined ? m.fuel_included : false,
    operator_included: m.operator_included !== undefined ? m.operator_included : true,
    centres: m.centres ? normalizeCentre(m.centres) : null,
  };
};

export const normalizeOperator = (o) => {
  if (!o) return o;
  return {
    ...o,
    id: o.operator_id || o.id,
    name: o.name || 'Certified Operator',
    skills: o.skills || o.machine_skills || null,
    experience_years: o.experience_years != null ? o.experience_years : null,
    is_available: o.is_available !== undefined ? o.is_available : true,
    rating: o.rating != null ? o.rating : (o.farmer_rating != null ? o.farmer_rating : null),
    total_jobs_completed: o.total_jobs_completed != null ? o.total_jobs_completed : (o.avg_hours_per_month ? Math.round(o.avg_hours_per_month / 4) : null),
    phone_number: o.phone_number || null,
  };
};

export const normalizeFarmer = (f) => {
  if (!f) return f;
  return {
    ...f,
    id: f.farmer_id || f.id,
    full_name: f.full_name || f.name || 'Farmer',
    farm_size: f.farm_size != null ? f.farm_size : (f.land_area_acre != null ? f.land_area_acre : null),
    primary_crops: f.primary_crops || f.main_crop || null,
    district: f.district || null,
    village: f.village || null,
  };
};

export const normalizeBooking = (b) => {
  if (!b) return b;
  let resolvedStatus = b.status;
  if (!resolvedStatus) {
    if (b.hours != null && b.hours === 1) {
      resolvedStatus = 'Approved';
    } else if ((b.hours != null && b.hours > 1) || b.farmer_rating != null) {
      resolvedStatus = 'Completed';
    } else {
      resolvedStatus = 'Pending';
    }
  }
  return {
    ...b,
    id: b.booking_id || b.id,
    booking_reference: b.booking_reference || b.booking_id || (b.id ? `BK-${b.id}` : null),
    scheduled_date: b.scheduled_date || b.booking_date || null,
    scheduled_time: b.scheduled_time || (b.hours ? `${b.hours} hrs completed` : '08:00 – 12:00'),
    operation: b.operation || b.job_type || (b.machinery?.machine_type ? `${b.machinery.machine_type} Operation` : 'Agricultural Operation'),
    crop: b.crop || b.farmers?.main_crop || b.farmers?.primary_crops || 'Wheat',
    farm_area: b.farm_area != null ? b.farm_area : (b.area_worked_acre != null ? b.area_worked_acre : 1.19),
    total_price: b.total_price != null ? b.total_price : (b.amount_inr != null ? b.amount_inr : 0),
    status: resolvedStatus,
    field_location: b.field_location || (b.farmers?.village ? `${b.farmers.village}, ${b.farmers.district || ''}` : (b.village ? `${b.village}, ${b.district || ''}` : 'Aligarh Rural')),
    // CHC Offer attributes
    offer_price_per_acre: b.offer_price_per_acre != null ? Number(b.offer_price_per_acre) : (b.rate_per_unit != null ? Number(b.rate_per_unit) : null),
    offer_duration_hours: b.offer_duration_hours || null,
    offer_machine_model: b.offer_machine_model || b.machinery?.machine_type || b.machine_type || null,
    // Farmer Complaint attributes
    complaint_status: b.complaint_status || null,
    complaint_category: b.complaint_category || null,
    complaint_text: b.complaint_text || null,
    complaint_created_at: b.complaint_created_at || null,
  };
};

// ==========================================
// 1. CENTRES SERVICE
// ==========================================
export const centresService = {
  async getAllCentres(filters = {}) {
    const client = checkClient();
    let query = client.from('centres').select('*');
    
    if (filters.district && filters.district !== 'all') {
      query = query.ilike('district', `%${filters.district}%`);
    }
    if (filters.state && filters.state !== 'all') {
      query = query.ilike('state', `%${filters.state}%`);
    }

    const { data, error } = await query;
    if (error) throw new SupabaseError(`Failed to fetch centres: ${error.message}`, error);
    return (data || []).map(normalizeCentre);
  },

  async getCentreById(id) {
    const client = checkClient();
    let { data, error } = await client.from('centres').select('*').or(`centre_id.eq.${id},id.eq.${id}`).maybeSingle();
    if (!data) {
      const res = await client.from('centres').select('*').eq('centre_id', id).maybeSingle();
      data = res.data;
      error = res.error;
    }
    if (error) throw new SupabaseError(`Failed to fetch centre ${id}: ${error.message}`, error);
    return normalizeCentre(data);
  },

  async getCentreByUserId(userId) {
    const client = checkClient();
    const { data, error } = await client.from('centres').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new SupabaseError(`Failed to fetch centre for user: ${error.message}`, error);
    return normalizeCentre(data);
  },

  async createCentre(centreData) {
    const client = checkClient();
    const { data, error } = await client.from('centres').insert([centreData]).select().single();
    if (error) throw new SupabaseError(`Failed to create centre: ${error.message}`, error);
    return normalizeCentre(data);
  },

  async updateCentre(id, updates) {
    const client = checkClient();
    const { data, error } = await client.from('centres').update(updates).or(`centre_id.eq.${id},id.eq.${id}`).select().single();
    if (error) throw new SupabaseError(`Failed to update centre: ${error.message}`, error);
    return normalizeCentre(data);
  }
};

// ==========================================
// 2. FARMERS SERVICE
// ==========================================
export const farmersService = {
  async getFarmerProfile(userId) {
    const client = checkClient();
    const { data, error } = await client
      .from('farmers')
      .select('*')
      .or(`user_id.eq.${userId},farmer_id.eq.${userId}`)
      .maybeSingle();

    if (error) throw new SupabaseError(`Failed to fetch farmer profile: ${error.message}`, error);
    return normalizeFarmer(data);
  },

  async upsertFarmerProfile(profileData) {
    const client = checkClient();
    const { data, error } = await client
      .from('farmers')
      .upsert(profileData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw new SupabaseError(`Failed to save farmer profile: ${error.message}`, error);
    return normalizeFarmer(data);
  },

  async getAllFarmers(limit = 100) {
    const client = checkClient();
    const { data, error } = await client.from('farmers').select('*').limit(limit);
    if (error) throw new SupabaseError(`Failed to fetch farmers: ${error.message}`, error);
    return (data || []).map(normalizeFarmer);
  }
};

// ==========================================
// 3. OPERATORS SERVICE
// ==========================================
export const operatorsService = {
  async getOperatorProfile(userId) {
    const client = checkClient();
    const { data, error } = await client
      .from('operators')
      .select('*')
      .or(`user_id.eq.${userId},operator_id.eq.${userId}`)
      .maybeSingle();

    if (error) throw new SupabaseError(`Failed to fetch operator profile: ${error.message}`, error);
    return normalizeOperator(data);
  },

  async getOperatorsByCentre(centreId) {
    const client = checkClient();
    const { data, error } = await client
      .from('operators')
      .select('*')
      .eq('centre_id', centreId);

    if (error) throw new SupabaseError(`Failed to fetch centre operators: ${error.message}`, error);
    return (data || []).map(normalizeOperator);
  },

  async getAllOperators(limit = 100) {
    const client = checkClient();
    const { data, error } = await client.from('operators').select('*').limit(limit);
    if (error) throw new SupabaseError(`Failed to fetch operators: ${error.message}`, error);
    return (data || []).map(normalizeOperator);
  },

  async updateAvailability(operatorId, isAvailable) {
    const client = checkClient();
    const { data, error } = await client
      .from('operators')
      .update({ is_available: isAvailable })
      .or(`id.eq.${operatorId},operator_id.eq.${operatorId}`)
      .select()
      .maybeSingle();

    if (error) throw new SupabaseError(`Failed to update operator availability: ${error.message}`, error);
    return normalizeOperator(data);
  }
};

// Helper for persistent session bookings (fallback when RLS restricts anonymous direct insert)
const LOCAL_BOOKINGS_KEY = 'niti_session_bookings';
const DELETED_BOOKINGS_KEY = 'niti_deleted_booking_ids_v2';

export const getDeletedBookingIds = () => {
  try {
    return JSON.parse(localStorage.getItem(DELETED_BOOKINGS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const addDeletedBookingId = (id) => {
  if (!id) return;
  try {
    const list = getDeletedBookingIds();
    if (!list.includes(id)) {
      localStorage.setItem(DELETED_BOOKINGS_KEY, JSON.stringify([...list, id]));
    }
  } catch (e) {
    console.warn('[SupabaseService] addDeletedBookingId warning:', e);
  }
};

const getLocalBookings = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY) || '[]');
  } catch {
    return [];
  }
};
const saveLocalBooking = (booking) => {
  try {
    const current = getLocalBookings().filter(b => (b.booking_id || b.id) !== (booking.booking_id || booking.id));
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify([booking, ...current]));
  } catch (e) {
    console.warn('[SupabaseService] Local booking persistence error:', e);
  }
};

// Global Realtime Broadcast Sync Channel (instantly syncs between phones & tabs)
let _syncChannel = null;
export const getSyncChannel = () => {
  if (!_syncChannel && supabase) {
    _syncChannel = supabase.channel('niti-live-sync');
    _syncChannel.subscribe((status) => {
      console.log('[SupabaseService] Realtime sync status:', status);
    });
  }
  return _syncChannel;
};

export const broadcastNewBooking = async (booking) => {
  try {
    const ch = getSyncChannel();
    if (ch) {
      await ch.send({
        type: 'broadcast',
        event: 'new_booking',
        payload: booking
      });
      console.log('[SupabaseService] Broadcasted new_booking to all devices:', booking.id || booking.booking_id);
    }
  } catch (e) {
    console.warn('[SupabaseService] Broadcast failed:', e);
  }
};

export const broadcastBookingStatus = async (bookingId, status) => {
  try {
    const ch = getSyncChannel();
    if (ch) {
      await ch.send({
        type: 'broadcast',
        event: 'booking_status_updated',
        payload: { booking_id: bookingId, id: bookingId, status }
      });
      console.log('[SupabaseService] Broadcasted status update:', bookingId, status);
    }
  } catch (e) {
    console.warn('[SupabaseService] Status broadcast failed:', e);
  }
};

export const broadcastBookingDeleted = async (bookingId) => {
  try {
    const ch = getSyncChannel();
    if (ch) {
      await ch.send({
        type: 'broadcast',
        event: 'booking_deleted',
        payload: { booking_id: bookingId, id: bookingId }
      });
      console.log('[SupabaseService] Broadcasted booking_deleted to all devices:', bookingId);
    }
  } catch (e) {
    console.warn('[SupabaseService] Delete broadcast failed:', e);
  }
};

// ==========================================
// 4. MACHINERY SERVICE
// ==========================================
export const machineryService = {
  async getAvailableMachinery(filters = {}) {
    const client = checkClient();
    let query = client.from('machinery').select('*');

    if (filters.category && filters.category !== 'all') {
      const categoryMap = {
        HARVESTER: ['Harvester', 'Combine'],
        TRACTOR: ['Tractor', 'Power Tiller'],
        ROTAVATOR: ['Rotavator', 'Tiller'],
        SEED_DRILL: ['Seed Drill', 'Happy Seeder', 'Seeder'],
        SPRAYER: ['Sprayer', 'Tractor', 'Power Tiller'],
      };
      const catKey = (filters.category || '').toUpperCase();
      const terms = categoryMap[catKey] || [filters.category];
      const orFilter = terms.map(t => `machine_type.ilike.%${t}%`).join(',');
      query = query.or(orFilter);
    }
    if (filters.centre_id) {
      query = query.eq('centre_id', filters.centre_id);
    }

    try {
      const { data, error } = await query;
      if (error) {
        console.warn(`[machineryService] Filter query error, falling back to all machinery:`, error.message);
        const fallback = await client.from('machinery').select('*').limit(20);
        return (fallback.data || []).map(normalizeMachine);
      }
      return (data || []).map(normalizeMachine);
    } catch (err) {
      console.warn('[machineryService] Query exception, fetching base machines:', err);
      const fallback = await client.from('machinery').select('*').limit(20);
      return (fallback.data || []).map(normalizeMachine);
    }
  },

  async getMachineById(id) {
    const client = checkClient();
    let { data, error } = await client
      .from('machinery')
      .select('*')
      .or(`machine_id.eq.${id},id.eq.${id}`)
      .maybeSingle();

    if (!data) {
      const res = await client.from('machinery').select('*').eq('machine_id', id).maybeSingle();
      data = res.data;
      error = res.error;
    }

    if (error) throw new SupabaseError(`Failed to fetch machine ${id}: ${error.message}`, error);
    return normalizeMachine(data);
  },

  async addMachine(machineData) {
    const client = checkClient();
    const { data, error } = await client.from('machinery').insert([machineData]).select().single();
    if (error) throw new SupabaseError(`Failed to add machine: ${error.message}`, error);
    return normalizeMachine(data);
  },

  async updateMachineStatus(id, status) {
    const client = checkClient();
    const { data, error } = await client
      .from('machinery')
      .update({ status })
      .or(`machine_id.eq.${id},id.eq.${id}`)
      .select()
      .maybeSingle();

    if (error) throw new SupabaseError(`Failed to update machine status: ${error.message}`, error);
    return normalizeMachine(data);
  }
};

// ==========================================
// 5. BOOKINGS SERVICE
// ==========================================
export const bookingsService = {
  async getFarmerBookings(farmerId) {
    if (!farmerId) return [];
    const client = checkClient();
    let dbBookings = [];
    try {
      const { data, error } = await client
        .from('bookings')
        .select('*, machinery(*), centres(*), operators(*)')
        .eq('farmer_id', farmerId)
        .order('booking_date', { ascending: false });
      if (!error && data) {
        dbBookings = data.map(normalizeBooking);
      }
    } catch (e) {
      console.warn('[Supabase] getFarmerBookings warning:', e);
    }

    // Merge persistent local session bookings for this farmer
    const localBookings = getLocalBookings()
      .filter(b => b.farmer_id === farmerId || b.farmerId === farmerId)
      .map(normalizeBooking);

    // Deduplicate by booking_id and filter out deleted/purged IDs
    const deletedIds = new Set(getDeletedBookingIds());
    const seenIds = new Set();
    const merged = [];
    for (const b of [...localBookings, ...dbBookings]) {
      const id = b.booking_id || b.id;
      const ref = b.booking_reference;
      if (id && !seenIds.has(id) && !deletedIds.has(id) && (!ref || !deletedIds.has(ref))) {
        seenIds.add(id);
        merged.push(b);
      }
    }
    return merged;
  },

  async getChcBookings(centreId) {
    if (!centreId) return [];
    const client = checkClient();
    let dbBookings = [];
    try {
      // Query all bookings for this centre OR any pending requests (hours=0) so new farmer bookings from any phone sync instantly
      const { data, error } = await client
        .from('bookings')
        .select('*, farmers(*), machinery(*), centres(*), operators(*)')
        .or(`centre_id.eq.${centreId},hours.eq.0`)
        .order('booking_date', { ascending: false });
      if (!error && data) {
        dbBookings = data.map(normalizeBooking);
      }
    } catch (e) {
      console.warn('[Supabase] getChcBookings warning:', e);
    }

    // Merge persistent local session bookings for this CHC centre or pending
    const localBookings = getLocalBookings()
      .filter(b => b.centre_id === centreId || b.centreId === centreId || b.status === 'Pending' || b.hours === 0)
      .map(normalizeBooking);

    const deletedIds = new Set(getDeletedBookingIds());
    const seenIds = new Set();
    const merged = [];
    for (const b of [...localBookings, ...dbBookings]) {
      const id = b.booking_id || b.id;
      const ref = b.booking_reference;
      if (id && !seenIds.has(id) && !deletedIds.has(id) && (!ref || !deletedIds.has(ref))) {
        seenIds.add(id);
        merged.push(b);
      }
    }
    return merged;
  },

  async getCentreBookings(centreId) {
    return this.getChcBookings(centreId);
  },

  async getOperatorBookings(operatorId) {
    const client = checkClient();
    let query = client.from('bookings').select('*, farmers(*), machinery(*), centres(*)');
    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }
    const { data, error } = await query.order('booking_date', { ascending: false }).limit(50);
    if (error) throw new SupabaseError(`Failed to fetch operator assignments: ${error.message}`, error);
    return (data || []).map(normalizeBooking);
  },

  async getOperatorJobs(operatorId) {
    return this.getOperatorBookings(operatorId);
  },

  async getAllBookings(limit = 100) {
    const client = checkClient();
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .limit(limit);

    if (error) throw new SupabaseError(`Failed to fetch all bookings: ${error.message}`, error);
    return (data || []).map(normalizeBooking);
  },

  async createBooking(bookingPayload) {
    const client = checkClient();
    const reference = `BK-${Date.now().toString(36).toUpperCase()}`;

    // Strictly send ONLY columns that exist in the physical Supabase bookings table
    const dbPayload = {
      booking_id: reference,
      farmer_id: bookingPayload.farmer_id || bookingPayload.farmerId || 'F0001',
      machine_id: bookingPayload.machine_id || bookingPayload.machineId || 'M0001',
      centre_id: bookingPayload.centre_id || bookingPayload.centreId || 'CHC001',
      operator_id: bookingPayload.operator_id || null,
      booking_date: bookingPayload.scheduled_date || bookingPayload.booking_date || new Date().toISOString().split('T')[0],
      area_worked_acre: parseFloat(bookingPayload.farm_area || bookingPayload.area_worked_acre || 1.19),
      hours: 0, // 0 hours indicates new Pending booking!
      amount_inr: parseFloat(bookingPayload.total_price || bookingPayload.amount_inr || 0),
      farmer_rating: null,
    };

    const fullNormalized = normalizeBooking({
      ...dbPayload,
      ...bookingPayload,
      id: reference,
      booking_reference: reference,
      status: 'Pending',
      scheduled_date: dbPayload.booking_date,
      farm_area: dbPayload.area_worked_acre,
      operation: bookingPayload.operation || 'HARVESTING',
      crop: bookingPayload.crop || 'Wheat',
      field_location: bookingPayload.field_location || 'Field Location, Uttar Pradesh',
    });

    try {
      const { data, error } = await client.from('bookings').insert([dbPayload]).select().single();
      if (!error && data) {
        const persisted = normalizeBooking({ ...fullNormalized, ...data, status: 'Pending' });
        saveLocalBooking(persisted);
        broadcastNewBooking(persisted);
        return persisted;
      }
      if (error) {
        console.warn('[bookingsService.createBooking] Direct Supabase insert warning (falling back to session persistence):', error.message);
        saveLocalBooking(fullNormalized);
        broadcastNewBooking(fullNormalized);
        return fullNormalized;
      }
    } catch (insertErr) {
      console.warn('[bookingsService.createBooking] Insert exception, persisting locally:', insertErr);
      saveLocalBooking(fullNormalized);
      broadcastNewBooking(fullNormalized);
      return fullNormalized;
    }

    saveLocalBooking(fullNormalized);
    broadcastNewBooking(fullNormalized);
    return fullNormalized;
  },

  async updateBookingStatus(bookingId, status) {
    const client = checkClient();
    const hoursVal = (status === 'Approved' || status === 'Scheduled') ? 1 : (status === 'Completed' ? 2 : 0);
    try {
      // First attempt update with status column
      let { data, error } = await client
        .from('bookings')
        .update({ status, hours: hoursVal })
        .or(`booking_id.eq.${bookingId},id.eq.${bookingId}`)
        .select()
        .maybeSingle();

      if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('status')))) {
        // Fallback: physical schema doesn't have status column, update hours representation
        const fallback = await client
          .from('bookings')
          .update({ hours: hoursVal })
          .or(`booking_id.eq.${bookingId},id.eq.${bookingId}`)
          .select()
          .maybeSingle();
        data = fallback.data;
      }

      broadcastBookingStatus(bookingId, status);
      return normalizeBooking(data ? { ...data, status } : { id: bookingId, booking_id: bookingId, status, hours: hoursVal });
    } catch (e) {
      broadcastBookingStatus(bookingId, status);
      return { id: bookingId, booking_id: bookingId, status, hours: hoursVal };
    }
  },

  async assignOperator(bookingId, operatorId) {
    const client = checkClient();
    const { data, error } = await client
      .from('bookings')
      .update({ operator_id: operatorId, status: 'Scheduled' })
      .or(`booking_id.eq.${bookingId},id.eq.${bookingId}`)
      .select()
      .maybeSingle();

    if (error) throw new SupabaseError(`Failed to assign booking: ${error.message}`, error);
    return normalizeBooking(data);
  },

  async deleteBooking(bookingId, bookingData = null) {
    if (!bookingId) return false;
    
    // Ownership and status guard: Completed bookings cannot be deleted
    const targetStatus = (bookingData?.status || '').toLowerCase();
    if (targetStatus === 'completed' || (bookingData?.hours && bookingData.hours >= 2)) {
      throw new Error('Completed bookings are preserved historical records and cannot be deleted.');
    }

    const client = checkClient();
    let supabaseDeleted = false;

    // 1. Attempt hard delete from Supabase bookings table
    try {
      const { error } = await client
        .from('bookings')
        .delete()
        .or(`booking_id.eq.${bookingId},id.eq.${bookingId},booking_reference.eq.${bookingId}`);
      if (!error) {
        supabaseDeleted = true;
      } else {
        console.warn('[bookingsService.deleteBooking] Supabase hard delete notice:', error.message);
      }
    } catch (e) {
      console.warn('[bookingsService.deleteBooking] Delete exception:', e);
    }

    // 2. If hard delete was blocked (e.g., FK constraint or RLS restrictions), apply soft cancellation policy
    if (!supabaseDeleted) {
      try {
        const { error: cancelError } = await client
          .from('bookings')
          .update({ status: 'Cancelled' })
          .or(`booking_id.eq.${bookingId},id.eq.${bookingId},booking_reference.eq.${bookingId}`);
        if (!cancelError) {
          supabaseDeleted = true;
        }
      } catch (e) {
        console.warn('[bookingsService.deleteBooking] Fallback cancellation notice:', e);
      }
    }

    // 3. Add to local deletion blacklist so it is never resurrected in session queries
    addDeletedBookingId(bookingId);
    if (bookingData?.booking_reference) addDeletedBookingId(bookingData.booking_reference);
    if (bookingData?.id) addDeletedBookingId(bookingData.id);

    // 4. Remove from local session storage
    try {
      const current = getLocalBookings().filter(b => 
        (b.booking_id || b.id) !== bookingId && b.booking_reference !== bookingId
      );
      localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('[bookingsService.deleteBooking] Local storage delete error:', e);
    }

    // 5. Broadcast live deletion event across all devices
    broadcastBookingDeleted(bookingId);
    broadcastBookingStatus(bookingId, 'Cancelled');
    return true;
  },

  async sendChcOffer(bookingId, offerData) {
    if (!bookingId) throw new Error('Booking ID is required');
    const client = checkClient();
    const pricePerAcre = Number(offerData.pricePerAcre || 800);
    const acreage = Number(offerData.acreage || 1);
    const totalPrice = Number(offerData.totalPrice || Math.round(pricePerAcre * acreage));
    const durationHours = offerData.durationHours || '3.5';
    const machineModel = offerData.machineModel || 'Tractor 60 HP';
    const status = 'Waiting for Farmer Confirmation';

    const updates = {
      status,
      amount_inr: totalPrice,
      total_price: totalPrice,
      offer_price_per_acre: pricePerAcre,
      offer_duration_hours: durationHours,
      offer_machine_model: machineModel,
      hours: 0
    };

    try {
      const { error } = await client
        .from('bookings')
        .update(updates)
        .or(`booking_id.eq.${bookingId},id.eq.${bookingId},booking_reference.eq.${bookingId}`);

      if (error) {
        console.warn('[sendChcOffer] Supabase update warning:', error.message);
      }
    } catch (e) {
      console.warn('[sendChcOffer] Exception:', e);
    }

    // Update in local bookings
    const local = getLocalBookings().map(b => {
      if (b.booking_id === bookingId || b.id === bookingId || b.booking_reference === bookingId) {
        return { ...b, ...updates };
      }
      return b;
    });
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(local));

    // Broadcast status update
    broadcastBookingStatus(bookingId, status);
    return { bookingId, status, ...updates };
  },

  async acceptOfferByFarmer(bookingId) {
    if (!bookingId) throw new Error('Booking ID is required');
    const client = checkClient();
    const status = 'Approved';
    const updates = { status, hours: 1 };

    try {
      await client
        .from('bookings')
        .update(updates)
        .or(`booking_id.eq.${bookingId},id.eq.${bookingId},booking_reference.eq.${bookingId}`);
    } catch (e) {
      console.warn('[acceptOfferByFarmer] Notice:', e);
    }

    const local = getLocalBookings().map(b => {
      if (b.booking_id === bookingId || b.id === bookingId || b.booking_reference === bookingId) {
        return { ...b, ...updates };
      }
      return b;
    });
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(local));

    broadcastBookingStatus(bookingId, status);
    return { bookingId, status };
  },

  async rejectOfferByFarmer(bookingId, reason = '') {
    if (!bookingId) throw new Error('Booking ID is required');
    const client = checkClient();
    const status = 'Rejected';
    const updates = { status, special_instructions: reason ? `Rejected by farmer: ${reason}` : 'Rejected by farmer' };

    try {
      await client
        .from('bookings')
        .update(updates)
        .or(`booking_id.eq.${bookingId},id.eq.${bookingId},booking_reference.eq.${bookingId}`);
    } catch (e) {
      console.warn('[rejectOfferByFarmer] Notice:', e);
    }

    const local = getLocalBookings().map(b => {
      if (b.booking_id === bookingId || b.id === bookingId || b.booking_reference === bookingId) {
        return { ...b, ...updates };
      }
      return b;
    });
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(local));

    broadcastBookingStatus(bookingId, status);
    return { bookingId, status };
  },

  async submitFarmerComplaint(bookingId, complaintData) {
    if (!bookingId) throw new Error('Booking ID is required');
    const client = checkClient();
    const updates = {
      complaint_status: 'OPEN',
      complaint_category: complaintData.category || 'Pricing Dispute',
      complaint_text: complaintData.text || '',
      complaint_created_at: new Date().toISOString()
    };

    try {
      await client
        .from('bookings')
        .update(updates)
        .or(`booking_id.eq.${bookingId},id.eq.${bookingId},booking_reference.eq.${bookingId}`);
    } catch (e) {
      console.warn('[submitFarmerComplaint] Notice:', e);
    }

    const local = getLocalBookings().map(b => {
      if (b.booking_id === bookingId || b.id === bookingId || b.booking_reference === bookingId) {
        return { ...b, ...updates };
      }
      return b;
    });
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(local));

    // Broadcast complaint event
    try {
      const ch = getSyncChannel();
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'farmer_complaint_raised',
          payload: { booking_id: bookingId, ...updates }
        });
      }
    } catch (e) {
      console.warn('[submitFarmerComplaint] Broadcast warning:', e);
    }

    return { bookingId, ...updates };
  }
};

// ==========================================
// 6. ANALYTICS & OVERVIEW (Single Source of Truth)
// ==========================================
export const analyticsService = {
  async getChcOverview(centreId = null) {
    const client = checkClient();

    // Query live counts for core tables
    const [centresRes, machinesRes, bookingsRes, operatorsRes, farmersRes, pendingRes, completedRes] = await Promise.all([
      client.from('centres').select('*', { count: 'exact', head: true }),
      client.from('machinery').select('*', { count: 'exact', head: true }),
      client.from('bookings').select('*', { count: 'exact', head: true }),
      client.from('operators').select('*', { count: 'exact', head: true }),
      client.from('farmers').select('*', { count: 'exact', head: true }),
      client.from('bookings').select('*', { count: 'exact', head: true }).ilike('status', '%pending%'),
      client.from('bookings').select('*', { count: 'exact', head: true }).ilike('status', '%completed%'),
    ]);

    const exactFarmersCount = farmersRes.count || 0;
    const exactPendingCount = pendingRes.count || 0;
    const exactCompletedCount = completedRes.count || 0;

    try {
      let query = client.from('chc_overview').select('*');
      if (centreId) query = query.eq('centre_id', centreId);
      const { data, error } = await query;
      
      if (!error && data && data.length > 0) {
        if (centreId) {
          const r = data[0];
          return {
            centres_count: 1,
            machinery_count: Number(r.total_machines) || 0,
            farmers_count: exactFarmersCount,
            operators_count: Number(r.num_operators) || 0,
            bookings_count: Number(r.total_bookings) || 0,
            total_revenue: Number(r.total_booking_value) || 0,
            total_centres: 1,
            total_machines: Number(r.total_machines) || 0,
            total_bookings: Number(r.total_bookings) || 0,
            active_machines: Number(r.total_machines) || 0,
            available_operators: Number(r.num_operators) || 0,
            pending_bookings: exactPendingCount,
            completed_bookings: exactCompletedCount,
          };
        }

        const totalMachines = data.reduce((s, r) => s + (Number(r.total_machines) || 0), 0);
        const totalBookings = data.reduce((s, r) => s + (Number(r.total_bookings) || 0), 0);
        const totalRevenue = data.reduce((s, r) => s + (Number(r.total_booking_value) || 0), 0);
        const totalOperators = data.reduce((s, r) => s + (Number(r.num_operators) || 0), 0);

        return {
          centres_count: data.length,
          machinery_count: totalMachines,
          farmers_count: exactFarmersCount,
          operators_count: totalOperators,
          bookings_count: totalBookings,
          total_revenue: totalRevenue,
          total_centres: data.length,
          total_machines: totalMachines,
          total_bookings: totalBookings,
          active_machines: totalMachines,
          available_operators: totalOperators,
          pending_bookings: exactPendingCount,
          completed_bookings: exactCompletedCount,
        };
      }
    } catch (e) {
      console.warn('chc_overview view error:', e);
    }

    return {
      centres_count: centresRes.count || 0,
      machinery_count: machinesRes.count || 0,
      farmers_count: exactFarmersCount,
      operators_count: operatorsRes.count || 0,
      bookings_count: bookingsRes.count || 0,
      total_revenue: 0,
      total_centres: centresRes.count || 0,
      total_machines: machinesRes.count || 0,
      total_bookings: bookingsRes.count || 0,
      active_machines: machinesRes.count || 0,
      available_operators: operatorsRes.count || 0,
      pending_bookings: exactPendingCount,
      completed_bookings: exactCompletedCount,
    };
  }
};

// ==========================================
// 7. BREAKDOWN & RECOVERY SERVICE (CORE USP)
// ==========================================
const BREAKDOWN_DEMO_CASES_KEY = 'niti_breakdown_demo_cases_v3';

const INITIAL_DEMO_CASES = [
  {
    id: 'BD-CASE-001',
    incident_number: 'INC-2026-001',
    level: 1,
    level_title: 'Level 1: Same-CHC Substitution',
    title: 'Combine Harvester Belt Failure (Same-Day Intra-CHC Replacement)',
    machine_id: 'M0001',
    machine_name: 'Multicrop Combine Harvester 55HP',
    centre_id: 'CHC001',
    centre_name: 'CHC Pur Kalan, Aligarh',
    failure_type: 'Cutter Bar Drive Belt Snapped Under Load',
    severity: 'MEDIUM',
    downtime_hours: 6.0,
    detected_at: '18 Oct 2026, 07:15 AM IST',
    location_node: 'Dhanipur Kalan (27.8974° N, 78.0880° E)',
    lat: 27.8974,
    lng: 78.0880,
    affected_pending_count: 1,
    completed_preserved_count: 1,
    feasible_alternatives_count: 2,
    deadline_risk_status: 'Safe (0 Violations)',
    recovery_step: 5, // 1: Detected, 2: Identify Bookings, 3: Find Alternatives, 4: Rank Plans, 5: Manager Approval, 6: Update Schedule, 7: Notify Farmers
    execution_status: 'READY_TO_EXECUTE',
    
    affected_farmer: 'Ajay Verma',
    farmer_id: 'F0001',
    village: 'Dhanipur Kalan',
    district: 'Agra',
    operation: 'Wheat Harvesting',
    acreage: 5.0,
    booking_id: 'BK-TEST-MVD61KHK',
    deadline: '2026-10-20',
    priority_score: 88,
    priority_level: 'HIGH_PRIORITY',
    priority_factors: {
      urgency: { pts: 30, max: 40, weight: '40%', reason: 'Scheduled in critical harvest window before forecast unseasonal rainfall' },
      criticality: { pts: 23, max: 25, weight: '25%', reason: 'Harvesting operation has biological window; delay risks lodging & shattering loss' },
      downtime: { pts: 14, max: 20, weight: '20%', reason: 'Estimated downtime 6.0 hours under MEDIUM mechanical failure severity' },
      acreage: { pts: 21, max: 15, weight: '15%', reason: '5.0 acres parcel scale (moderate economic exposure for smallholder)' }
    },
    formula_string: 'Score = (30/40 * 40%) + (23/25 * 25%) + (14/20 * 20%) + (9/15 * 15%) = 88/100',
    
    affected_bookings: [
      {
        booking_id: 'BK-TEST-MVD61KHK',
        farmer_name: 'Ajay Verma',
        farmer_village: 'Dhanipur Kalan',
        operation: 'Wheat Harvesting',
        acreage: 5.0,
        deadline: '2026-10-20',
        priority_score: 88,
        status: 'DISRUPTED_PENDING',
        is_completed: false
      },
      {
        booking_id: 'BK-COMP-009',
        farmer_name: 'Rajesh Chauhan',
        farmer_village: 'Pur Kalan',
        operation: 'Wheat Harvesting',
        acreage: 4.2,
        deadline: '2026-10-17',
        priority_score: 82,
        status: 'COMPLETED_PRESERVED',
        is_completed: true,
        preserved_badge: '100% Preserved (Untouched)'
      }
    ],

    alternative_plans: [
      {
        plan_id: 'PLAN-001-A',
        is_recommended: true,
        title: 'Plan A: Immediate Intra-CHC Substitute (Recommended)',
        replacement_machine_id: 'M0002',
        replacement_machine: 'M0002 (Multicrop Combine Harvester 55HP Backup)',
        source_centre: 'CHC Pur Kalan (Host CHC)',
        operator_name: 'Santosh Jatav (Certified Combine Specialist)',
        operator_status: 'Available Immediately',
        attachment_fit: 'Standard 55HP Cutter Bar Mounted & Verified',
        travel_distance_km: 4.2,
        travel_time_mins: 12,
        expected_delay: '0 hrs (Same-Day Window)',
        extra_cost_inr: 0,
        deadline_feasibility: 'Feasible (24h Buffer Intact)',
        match_score: 94.2,
        rejection_reason: null
      },
      {
        plan_id: 'PLAN-001-B',
        is_recommended: false,
        title: 'Plan B: Evening Reschedule Post-Belt Repair',
        replacement_machine_id: 'M0001',
        replacement_machine: 'M0001 (Post-Belt Repair in CHC Workshop)',
        source_centre: 'CHC Pur Kalan',
        operator_name: 'Original Operator (On Standby)',
        operator_status: 'Assigned',
        attachment_fit: 'Belt re-tensioning in progress',
        travel_distance_km: 0.0,
        travel_time_mins: 0,
        expected_delay: '+6.5 hrs (Late Evening Dispatch)',
        extra_cost_inr: 0,
        deadline_feasibility: 'Feasible (Within Deadline)',
        match_score: 72.8,
        rejection_reason: null
      }
    ],

    infeasible_alternatives: [
      {
        machine_id: 'M0008',
        machine_name: 'Sonalika 45HP Tractor',
        centre_name: 'CHC Pur Kalan',
        category: 'Attachment & Power Mismatch',
        rejection_reason: 'Under-powered (45HP vs 55HP requirement) and lacks compatible hydraulic lift mount for 12-ft cutter bar.'
      },
      {
        machine_id: 'M0015',
        machine_name: 'Claas Combine Harvester 75HP',
        centre_name: 'CHC Mathura South (42 km away)',
        category: 'Transit Deadline Violation',
        rejection_reason: 'Transit corridor estimate (85 mins transit + flatbed trailer loading) violates pre-rain biological harvest deadline.'
      },
      {
        machine_id: 'M0009',
        machine_name: 'Kubota Harvester 50HP',
        centre_name: 'CHC Pur Kalan',
        category: 'Schedule Conflict',
        rejection_reason: 'Pre-assigned on 14-acre continuous wheat harvesting job until 19:30.'
      }
    ],

    manager_approval: {
      required_role: 'CHC_MANAGER',
      authorized_manager: 'Ramesh Kumar (CHC Pur Kalan Manager)',
      approved_at: null,
      status: 'AWAITING_APPROVAL'
    },

    farmer_notification: {
      channels: ['SMS', 'IVR Automated Voice'],
      recipient_name: 'Ajay Verma',
      recipient_phone: '+91 98*** **210',
      status: 'AWAITING_APPROVAL',
      delivered_at: null,
      message_preview: 'नमस्ते अजय जी, आपकी गेहूं कटाई बुकिंग (BK-TEST-MVD61KHK) के लिए मशीन M0001 में खराबी आने पर तुरंत बैकअप मशीन M0002 ऑपरेटर संतोष जाटव के साथ बिना किसी अतिरिक्त शुल्क (₹0) के रवाना कर दी गई है।'
    },

    solution_type: 'SAME_CHC_SUBSTITUTE',
    solution_summary: 'Substitute idle Combine Harvester M0002 dispatched immediately from CHC001 fleet with Operator Santosh Jatav.',
    substitute_machine_id: 'M0002',
    substitute_machine: 'M0002 (Multicrop Combine Harvester Backup Unit)',
    substitute_chc: 'CHC001 (Same CHC)',
    substitute_operator: 'Santosh Jatav (Certified Combine Specialist)',
    transit_distance_km: 4.2,
    delay_days: 0,
    additional_cost_inr: 0,
    status: 'RESOLVED_INTERNAL',
    judge_notes: 'Demonstrates zero-delay same-centre asset interchangeability. Farmer suffers no downtime; crop harvested on time with ₹0 penalty.'
  },
  {
    id: 'BD-CASE-002',
    incident_number: 'INC-2026-002',
    level: 2,
    level_title: 'Level 2: Intra-CHC Slot Rescheduling',
    title: 'Heavy Tractor PTO Clutch Slippage (Acceptable Slot Reschedule)',
    machine_id: 'M0005',
    machine_name: 'Mahindra 60HP 4WD Tractor + Rotavator',
    centre_id: 'CHC001',
    centre_name: 'CHC Pur Kalan, Aligarh',
    failure_type: 'Hydraulic PTO Clutch Slippage',
    severity: 'LOW',
    downtime_hours: 18.0,
    detected_at: '18 Oct 2026, 08:30 AM IST',
    location_node: 'Mohanpur Jagir (27.9120° N, 78.1150° E)',
    lat: 27.9120,
    lng: 78.1150,
    affected_pending_count: 1,
    completed_preserved_count: 1,
    feasible_alternatives_count: 2,
    deadline_risk_status: 'Low Risk (3 Days Farmer Buffer)',
    recovery_step: 5,
    execution_status: 'READY_TO_EXECUTE',

    affected_farmer: 'Hari Mishra',
    farmer_id: 'F0472',
    village: 'Mohanpur Jagir',
    district: 'Aligarh',
    operation: 'Mustard Land Preparation / Tillage',
    acreage: 8.0,
    booking_id: 'B00031',
    deadline: '2026-10-23',
    priority_score: 62,
    priority_level: 'STANDARD_PRIORITY',
    priority_factors: {
      urgency: { pts: 15, max: 40, weight: '40%', reason: 'Farmer has 3 days weather buffer remaining before sowing deadline' },
      criticality: { pts: 14, max: 25, weight: '25%', reason: 'Land preparation / tillage has standard operational scheduling tolerance' },
      downtime: { pts: 14, max: 20, weight: '20%', reason: '18h repair window with replacement oil seal available in workshop' },
      acreage: { pts: 19, max: 15, weight: '15%', reason: '8.0 acres scale with moderate operational volume' }
    },
    formula_string: 'Score = (15/40 * 40%) + (14/25 * 25%) + (14/20 * 20%) + (9/15 * 15%) = 62/100',

    affected_bookings: [
      {
        booking_id: 'B00031',
        farmer_name: 'Hari Mishra',
        farmer_village: 'Mohanpur Jagir',
        operation: 'Mustard Land Prep',
        acreage: 8.0,
        deadline: '2026-10-23',
        priority_score: 62,
        status: 'DISRUPTED_PENDING',
        is_completed: false
      },
      {
        booking_id: 'BK-COMP-014',
        farmer_name: 'Devendra Singh',
        farmer_village: 'Kalyanpur',
        operation: 'Rotavator Tillage',
        acreage: 6.0,
        deadline: '2026-10-17',
        priority_score: 58,
        status: 'COMPLETED_PRESERVED',
        is_completed: true,
        preserved_badge: '100% Preserved (Untouched)'
      }
    ],

    alternative_plans: [
      {
        plan_id: 'PLAN-002-A',
        is_recommended: true,
        title: 'Plan A: Next-Day Morning Slot Reschedule (08:00 AM)',
        replacement_machine_id: 'M0005',
        replacement_machine: 'M0005 (Serviced & Tested Post-Clutch Seal Replacement)',
        source_centre: 'CHC Pur Kalan (Host CHC)',
        operator_name: 'Original Operator (Continuity Preserved)',
        operator_status: 'Assigned',
        attachment_fit: 'Rotavator attachment remains hitched',
        travel_distance_km: 6.8,
        travel_time_mins: 20,
        expected_delay: '+1 Day (Within 3-Day Farmer Window)',
        extra_cost_inr: 0,
        deadline_feasibility: 'Feasible (2 Full Days Buffer Left)',
        match_score: 89.0,
        rejection_reason: null
      },
      {
        plan_id: 'PLAN-002-B',
        is_recommended: false,
        title: 'Plan B: Substitute Medium Tractor 50HP',
        replacement_machine_id: 'M0018',
        replacement_machine: 'M0018 (Swaraj 50HP Tractor)',
        source_centre: 'CHC Pur Kalan',
        operator_name: 'Kallu Ram',
        operator_status: 'Available',
        attachment_fit: 'Requires unhitching 7-ft rotavator to 5-ft rotavator',
        travel_distance_km: 7.2,
        travel_time_mins: 25,
        expected_delay: '+4 hrs (Same Day)',
        extra_cost_inr: 0,
        deadline_feasibility: 'Feasible',
        match_score: 75.4,
        rejection_reason: null
      }
    ],

    infeasible_alternatives: [
      {
        machine_id: 'M0012',
        machine_name: 'Combine Harvester 60HP',
        centre_name: 'CHC Pur Kalan',
        category: 'Operation Incompatible',
        rejection_reason: 'Harvester cannot perform soil tillage / rotavator operations.'
      },
      {
        machine_id: 'M0027',
        machine_name: 'John Deere 55HP Tractor',
        centre_name: 'CHC Pur Kalan',
        category: 'Under Maintenance',
        rejection_reason: 'Under scheduled 500-hour engine overhaul; transmission disassembled.'
      }
    ],

    manager_approval: {
      required_role: 'CHC_MANAGER',
      authorized_manager: 'Ramesh Kumar (CHC Pur Kalan Manager)',
      approved_at: null,
      status: 'AWAITING_APPROVAL'
    },

    farmer_notification: {
      channels: ['SMS', 'IVR Automated Voice'],
      recipient_name: 'Hari Mishra',
      recipient_phone: '+91 94*** **472',
      status: 'AWAITING_APPROVAL',
      delivered_at: null,
      message_preview: 'नमस्ते हरी जी, महिंद्रा ट्रैक्टर M0005 के क्लच रखरखाव के कारण आपका रोटावेटर कार्य कल सुबह 08:00 बजे पुनर्निर्धारित किया गया है। आपकी बुवाई समय-सीमा सुरक्षित है और कोई अतिरिक्त शुल्क (₹0) नहीं है।'
    },

    solution_type: 'INTRA_CHC_RESCHEDULE',
    solution_summary: 'Rescheduled +1 day to next morning (08:00 AM) using original machine and certified operator within farmer buffer.',
    substitute_machine_id: 'M0005',
    substitute_machine: 'M0005 (Serviced & Tested Post-Repair)',
    substitute_chc: 'CHC001',
    substitute_operator: 'Original Operator (Continuity Preserved)',
    transit_distance_km: 6.8,
    delay_days: 1,
    additional_cost_inr: 0,
    status: 'RESOLVED_RESCHEDULED',
    judge_notes: 'Optimizes resource utilization without unnecessary external capital deployment. Farmer had a 3-day buffer, so a 1-day reschedule cost ₹0 and was accepted seamlessly.'
  },
  {
    id: 'BD-CASE-003',
    incident_number: 'INC-2026-003',
    level: 3,
    level_title: 'Level 3: Cross-CHC Grid Inter-Lending',
    title: 'Paddy Transplanter Catastrophic Failure (Cross-Centre Network Routing)',
    machine_id: 'M0003',
    machine_name: 'Paddy Transplanter 8-Row Self-Propelled',
    centre_id: 'CHC001',
    centre_name: 'CHC Pur Kalan, Aligarh',
    failure_type: 'Transmission Gearbox Seizure & Hydraulic Rupture',
    severity: 'CRITICAL',
    downtime_hours: 72.0,
    detected_at: '18 Oct 2026, 06:45 AM IST',
    location_node: 'Khair Majra (27.9340° N, 78.0520° E)',
    lat: 27.9340,
    lng: 78.0520,
    affected_pending_count: 1,
    completed_preserved_count: 1,
    feasible_alternatives_count: 2,
    deadline_risk_status: 'Critical Urgency (<24h Biological Root Viability)',
    recovery_step: 5,
    execution_status: 'READY_TO_EXECUTE',

    affected_farmer: 'Ram Kumar',
    farmer_id: 'F0003',
    village: 'Khair Majra',
    district: 'Aligarh',
    operation: 'Paddy Transplanting',
    acreage: 15.0,
    booking_id: 'BK-MVD66D9X',
    deadline: '2026-10-20',
    priority_score: 96,
    priority_level: 'CRITICAL_URGENCY',
    priority_factors: {
      urgency: { pts: 36, max: 40, weight: '40%', reason: 'Nursery seedling root viability window expires in 24 hours (0 buffer days)' },
      criticality: { pts: 25, max: 25, weight: '25%', reason: 'Paddy transplanting has strict biological window to prevent root shock & seedling mortality' },
      downtime: { pts: 20, max: 20, weight: '20%', reason: 'Catastrophic failure (72.0h) completely exceeds farmer buffer by 48h' },
      acreage: { pts: 15, max: 15, weight: '15%', reason: '15.0 acres large farm parcel with high economic exposure (₹1.8L crop value)' }
    },
    formula_string: 'Score = (36/40 * 40%) + (25/25 * 25%) + (20/20 * 20%) + (15/15 * 15%) = 96/100',

    affected_bookings: [
      {
        booking_id: 'BK-MVD66D9X',
        farmer_name: 'Ram Kumar',
        farmer_village: 'Khair Majra',
        operation: 'Paddy Transplanting',
        acreage: 15.0,
        deadline: '2026-10-20',
        priority_score: 96,
        status: 'DISRUPTED_PENDING',
        is_completed: false
      },
      {
        booking_id: 'BK-COMP-021',
        farmer_name: 'Harish Chandra',
        farmer_village: 'Lodha',
        operation: 'Paddy Transplanting',
        acreage: 12.0,
        deadline: '2026-10-17',
        priority_score: 92,
        status: 'COMPLETED_PRESERVED',
        is_completed: true,
        preserved_badge: '100% Preserved (Untouched)'
      }
    ],

    alternative_plans: [
      {
        plan_id: 'PLAN-003-A',
        is_recommended: true,
        title: 'Plan A: Cross-CHC Borrowing from CHC Gaon Majra (Recommended)',
        replacement_machine_id: 'M0041',
        replacement_machine: 'M0041 (Paddy Transplanter 8-Row High-Speed Unit)',
        source_centre: 'CHC002 (CHC Gaon Majra, 8.4 km away)',
        operator_name: 'Suresh Chandra (Certified Transplanter Specialist)',
        operator_status: 'Available & Dispatched',
        attachment_fit: 'Native 8-row automated seedling tray feed mounted',
        travel_distance_km: 8.4,
        travel_time_mins: 24,
        expected_delay: '+24 mins (Transit Time via OSRM Corridor)',
        extra_cost_inr: 0,
        deadline_feasibility: 'Feasible (Arrives inside 24h seedling viability)',
        match_score: 97.4,
        rejection_reason: null
      },
      {
        plan_id: 'PLAN-003-B',
        is_recommended: false,
        title: 'Plan B: Borrowing from CHC Sasni Hub (19.5 km away)',
        replacement_machine_id: 'M0052',
        replacement_machine: 'M0052 (Kubota 6-Row Transplanter)',
        source_centre: 'CHC004 (CHC Sasni, 19.5 km away)',
        operator_name: 'Mahesh Pal',
        operator_status: 'On Standby',
        attachment_fit: '6-row configuration (requires +2.5 hrs extra field time)',
        travel_distance_km: 19.5,
        travel_time_mins: 45,
        expected_delay: '+2.5 hrs (Operational Slower Feed)',
        extra_cost_inr: 0,
        deadline_feasibility: 'Feasible',
        match_score: 79.1,
        rejection_reason: null
      }
    ],

    infeasible_alternatives: [
      {
        machine_id: 'M0003',
        machine_name: 'Original Transplanter M0003',
        centre_name: 'CHC Pur Kalan',
        category: 'Catastrophic Failure',
        rejection_reason: 'Downtime 72 hours; transmission broken. Host CHC has 0 other idle transplanters.'
      },
      {
        machine_id: 'M0038',
        machine_name: 'Yan-Mar 8-Row Transplanter',
        centre_name: 'CHC Kasganj (48 km away)',
        category: 'Transit Distance Threshold',
        rejection_reason: 'Transit distance (48 km) exceeds 30 km inter-lending radius; transit cost & transit time exceed threshold.'
      }
    ],

    manager_approval: {
      required_role: 'CHC_MANAGER',
      authorized_manager: 'Ramesh Kumar (CHC Pur Kalan Manager)',
      approved_at: null,
      status: 'AWAITING_APPROVAL'
    },

    farmer_notification: {
      channels: ['SMS', 'IVR Automated Voice'],
      recipient_name: 'Ram Kumar',
      recipient_phone: '+91 97*** **003',
      status: 'AWAITING_APPROVAL',
      delivered_at: null,
      message_preview: 'नमस्ते राम कुमार जी, धान रोपाई मशीन M0003 में खराबी के कारण निकटवर्ती CHC गांव माजरा से 8-रो ट्रांसप्लांटर M0041 ऑपरेटर सुरेश चंद्र के साथ रवाना कर दिया गया है। 24 मिनट में पहुंचेगा। ₹0 अतिरिक्त शुल्क।'
    },

    solution_type: 'CROSS_CHC_BORROWING',
    solution_summary: 'CHC001 has no idle transplanters. NITI Grid routes idle Transplanter M0041 from CHC002 (8.4 km away) via OSRM highway corridor (24 min transit).',
    substitute_machine_id: 'M0041',
    substitute_machine: 'M0041 (Paddy Transplanter High-Speed Unit)',
    substitute_chc: 'CHC002 (CHC Gaon Majra, 8.4 km away)',
    substitute_operator: 'Suresh Chandra (Certified Transplanter Specialist)',
    transit_distance_km: 8.4,
    transit_time_minutes: 24,
    delay_days: 0.1,
    additional_cost_inr: 0,
    status: 'RESOLVED_CROSS_CHC',
    judge_notes: 'Core architectural USP: eliminates single-centre capacity bottlenecks by treating all 50 UP CHCs as a synchronized cooperative mesh network.'
  },
  {
    id: 'BD-CASE-004',
    incident_number: 'INC-2026-004',
    level: 4,
    level_title: 'Level 4: Agronomic Impasse & Clean Farmer Alert',
    title: 'Laser Leveler Electronic Burnout + Regional Grid Saturation (Impasse Protocol)',
    machine_id: 'M0010',
    machine_name: 'Laser Land Leveler & Precision Transmitter Unit',
    centre_id: 'CHC001',
    centre_name: 'CHC Pur Kalan, Aligarh',
    failure_type: 'Electronic Transmitter Short-Circuit + Transit Road Inundation',
    severity: 'CRITICAL',
    downtime_hours: 120.0,
    detected_at: '18 Oct 2026, 06:00 AM IST',
    location_node: 'Dhanipur Rural (27.8420° N, 78.1400° E)',
    lat: 27.8420,
    lng: 78.1400,
    affected_pending_count: 1,
    completed_preserved_count: 1,
    feasible_alternatives_count: 0,
    deadline_risk_status: 'Deadlock Impasse (Zero Regional Candidates Available)',
    recovery_step: 4, // Stops before normal approval because no feasible alternative exists
    execution_status: 'DEADLOCK_IMPASSE',

    affected_farmer: 'Suresh Yadav',
    farmer_id: 'F0004',
    village: 'Dhanipur Rural',
    district: 'Agra',
    operation: 'Precision Laser Land Leveling',
    acreage: 25.0,
    booking_id: 'BK-MVD5MVUH',
    deadline: '2026-10-19',
    priority_score: 98,
    priority_level: 'EMERGENCY_IMPASSE',
    priority_factors: {
      urgency: { pts: 40, max: 40, weight: '40%', reason: 'Past requested weather deadline; pre-monsoon moisture risk imminent' },
      criticality: { pts: 25, max: 25, weight: '25%', reason: 'Laser leveling precision window before scheduled canal irrigation' },
      downtime: { pts: 20, max: 20, weight: '20%', reason: 'Major controller burnout requiring 5-day manufacturer servicing' },
      acreage: { pts: 13, max: 15, weight: '15%', reason: '25.0 acres commercial scale field' }
    },
    formula_string: 'Score = (40/40 * 40%) + (25/25 * 25%) + (20/20 * 20%) + (13/15 * 15%) = 98/100',
    deadlock_reason: 'All 6 laser levelers across Agra-Aligarh CHC cluster are 100% booked for next 7 days. Connecting arterial road NH-509 flooded. No feasible candidate exists within 35 km before biological deadline.',

    affected_bookings: [
      {
        booking_id: 'BK-MVD5MVUH',
        farmer_name: 'Suresh Yadav',
        farmer_village: 'Dhanipur Rural',
        operation: 'Precision Laser Leveling',
        acreage: 25.0,
        deadline: '2026-10-19',
        priority_score: 98,
        status: 'IMPASSE_DISTRESS_ALERTED',
        is_completed: false
      },
      {
        booking_id: 'BK-COMP-003',
        farmer_name: 'Mahendra Pal',
        farmer_village: 'Dhanipur Kalan',
        operation: 'Laser Land Leveling',
        acreage: 18.0,
        deadline: '2026-10-16',
        priority_score: 90,
        status: 'COMPLETED_PRESERVED',
        is_completed: true,
        preserved_badge: '100% Preserved (Untouched)'
      }
    ],

    alternative_plans: [], // Zero feasible alternatives!

    infeasible_alternatives: [
      {
        machine_id: 'M0010',
        machine_name: 'Laser Transmitter M0010 (Host CHC)',
        centre_name: 'CHC Pur Kalan',
        category: 'Controller Burnout',
        rejection_reason: 'Requires specialized optical sensor replacement from manufacturer (downtime 120 hrs).'
      },
      {
        machine_id: 'M0011',
        machine_name: 'Spectra Precision Laser Leveler',
        centre_name: 'CHC Gaon Majra (8.4 km)',
        category: 'Grid Saturation',
        rejection_reason: 'Fully scheduled on 35-acre state seed farm leveling until 25 Oct 2026.'
      },
      {
        machine_id: 'M0024',
        machine_name: 'Trimble Ag Laser Leveler',
        centre_name: 'CHC Hathras Junction (28 km)',
        category: 'Transit Route Inundation',
        rejection_reason: 'NH-509 transit corridor waterlogged and impassable for heavy tow trailers.'
      }
    ],

    manager_approval: {
      required_role: 'CHC_MANAGER',
      authorized_manager: 'Ramesh Kumar (CHC Pur Kalan Manager)',
      approved_at: '18 Oct 2026, 06:10 AM IST',
      status: 'IMPASSE_REFUND_APPROVED'
    },

    farmer_notification: {
      channels: ['SMS', 'IVR Automated Voice', 'Direct Call Center'],
      recipient_name: 'Suresh Yadav',
      recipient_phone: '+91 99*** **004',
      status: 'DELIVERED_VERIFIED',
      delivered_at: '18 Oct 2026, 06:12 AM IST',
      message_preview: '🚨 NITI प्राथमिकता सूचना: लेजर लेवलर M0010 में तकनीकी खराबी और सभी क्षेत्रीय यूनिट्स व्यस्त होने के कारण, आपकी बुकिंग BK-MVD5MVUH पर 100% रिफंड (₹26,250) जारी कर दिया गया है एवं स्थानीय आपातकालीन ट्रैक्टर पूल से संपर्क स्थापित कराया जा रहा है।'
    },

    solution_type: 'CLEAN_FARMER_ALERT',
    solution_summary: 'System triggers Automated Clean Distress Alert to farmer with ₹26,250 instant refund, voucher guarantee, and connects to emergency tractor pool.',
    clean_alert_message: '🚨 NITI Priority Dispatch Alert: Regrettably, Laser Leveler M0010 suffered a major electrical failure. All regional backup units within 35 km are fully engaged. To protect your crop, we have initiated an automatic 100% refund (₹26,250), waived platform fees, and dispatched an emergency tillage contingency.',
    refund_amount_inr: 26250,
    status: 'RESOLVED_ALERT_REFUND',
    judge_notes: 'Addresses real-world edge cases where no solution is possible. Instead of silent cancellation or farmer abandonment, NITI provides 100% transparent algorithmic accountability, instant refund, and emergency escalation.'
  }
];

export const breakdownService = {
  getDemoCases() {
    try {
      const stored = localStorage.getItem(BREAKDOWN_DEMO_CASES_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    localStorage.setItem(BREAKDOWN_DEMO_CASES_KEY, JSON.stringify(INITIAL_DEMO_CASES));
    return INITIAL_DEMO_CASES;
  },

  async simulateRecovery(caseId, selectedPlanId = null, managerName = 'Ramesh Kumar (CHC Pur Kalan Manager)') {
    const cases = this.getDemoCases();
    const target = cases.find(c => c.id === caseId);
    if (!target) return null;

    target.executed_at = new Date().toISOString();
    target.execution_status = 'COMPLETED';
    target.recovery_step = 7; // Finished: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
    
    // Update manager approval state
    target.manager_approval = {
      required_role: 'CHC_MANAGER',
      authorized_manager: managerName,
      approved_at: new Date().toISOString(),
      status: 'APPROVED_DISPATCHED'
    };

    // Update farmer notification state (verifiable delivery)
    target.farmer_notification = {
      ...target.farmer_notification,
      status: 'DELIVERED_VERIFIED',
      delivered_at: new Date().toISOString()
    };

    // Update the disrupted pending booking to recovered
    if (target.affected_bookings && target.affected_bookings[0]) {
      target.affected_bookings[0].status = 'RECOVERED_SCHEDULED';
    }

    // Mark broken machine as Maintenance in Supabase if live
    try {
      const client = checkClient();
      if (client && target.machine_id) {
        await client
          .from('machinery')
          .update({ status: 'Maintenance' })
          .eq('machine_id', target.machine_id);
      }
    } catch (e) {
      console.warn('[breakdownService] Supabase machinery update notice:', e);
    }

    // Update booking in Supabase with substitute machine and scheduled status
    try {
      const client = checkClient();
      if (client && target.booking_id) {
        await client
          .from('bookings')
          .update({
            machine_id: target.substitute_machine_id || target.machine_id,
            operator_id: 'OP001',
            status: 'Scheduled',
            hours: 1
          })
          .or(`booking_id.eq.${target.booking_id},id.eq.${target.booking_id}`);
      }
    } catch (e) {
      console.warn('[breakdownService] Supabase booking update notice:', e);
    }

    localStorage.setItem(BREAKDOWN_DEMO_CASES_KEY, JSON.stringify(cases));

    // Broadcast live recovery event to all connected devices via Supabase Realtime channel
    try {
      const ch = getSyncChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'breakdown_recovery_approved',
          payload: target
        });
      }
    } catch (e) {
      console.warn('[breakdownService] broadcast warning:', e);
    }

    return target;
  },

  resetDemoCases() {
    localStorage.setItem(BREAKDOWN_DEMO_CASES_KEY, JSON.stringify(INITIAL_DEMO_CASES));
    return INITIAL_DEMO_CASES;
  }
};

// ==========================================
// 8. ON-DEMAND OPERATOR DISPATCH SERVICE (AUDIO 3)
// ==========================================
const OPERATOR_JOB_OFFERS_KEY = 'niti_operator_job_offers';

const INITIAL_JOB_OFFERS = [
  {
    offer_id: 'JOB-REQ-001',
    booking_id: 'BK-TEST-MVD61KHK',
    farmer_name: 'Ajay Verma',
    farmer_village: 'Dhanipur Kalan',
    farmer_district: 'Agra',
    operation: 'Wheat Harvesting',
    machine_type: 'Combine Harvester 55HP',
    acreage: 5.0,
    scheduled_date: '2026-10-19',
    scheduled_time: '08:00 – 12:00',
    payout_inr: 1250,
    distance_km: 4.2,
    status: 'OPEN',
    broadcasted_at: '2026-10-18T07:15:00Z',
    chc_name: 'CHC Pur Kalan'
  },
  {
    offer_id: 'JOB-REQ-002',
    booking_id: 'BK-MVD66D9X',
    farmer_name: 'Ajay Verma',
    farmer_village: 'Khair Majra',
    farmer_district: 'Aligarh',
    operation: 'Paddy Transplanting',
    machine_type: 'Combine Harvester / Transplanter',
    acreage: 5.0,
    scheduled_date: '2026-10-19',
    scheduled_time: '13:00 – 17:00',
    payout_inr: 1400,
    distance_km: 7.1,
    status: 'OPEN',
    broadcasted_at: '2026-10-18T07:20:00Z',
    chc_name: 'CHC Pur Kalan'
  }
];

export const operatorDispatchService = {
  getOpenJobOffers() {
    try {
      const stored = localStorage.getItem(OPERATOR_JOB_OFFERS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    localStorage.setItem(OPERATOR_JOB_OFFERS_KEY, JSON.stringify(INITIAL_JOB_OFFERS));
    return INITIAL_JOB_OFFERS;
  },

  broadcastJobOffer(booking) {
    const current = this.getOpenJobOffers();
    const newOffer = {
      offer_id: `JOB-REQ-${Date.now().toString(36).toUpperCase()}`,
      booking_id: booking.booking_id || booking.id,
      farmer_name: booking.farmers?.name || booking.farmer_name || booking.farmer || 'Farmer',
      farmer_village: booking.farmers?.village || booking.field_location || 'Village',
      farmer_district: booking.farmers?.district || 'Aligarh',
      operation: booking.operation || 'Harvesting Work',
      machine_type: booking.machinery?.machine_type || booking.machine_type || 'Tractor / Machine',
      acreage: booking.farm_area || booking.area_worked_acre || 1.19,
      scheduled_date: booking.scheduled_date || booking.booking_date || new Date().toISOString().split('T')[0],
      scheduled_time: booking.scheduled_time || '08:00 – 12:00',
      payout_inr: Math.round((booking.amount_inr || booking.total_price || 1200) * 0.35),
      distance_km: 5.5,
      status: 'OPEN',
      broadcasted_at: new Date().toISOString(),
      chc_name: booking.centres?.name || 'Local CHC Hub'
    };

    const updated = [newOffer, ...current.filter(o => o.booking_id !== newOffer.booking_id)];
    localStorage.setItem(OPERATOR_JOB_OFFERS_KEY, JSON.stringify(updated));

    try {
      const ch = getSyncChannel();
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'operator_job_broadcasted',
          payload: newOffer
        });
      }
    } catch (e) {
      console.warn('[operatorDispatchService] Broadcast warning:', e);
    }

    return newOffer;
  },

  async acceptJobOffer(offerId, operatorId = 'OP001', operatorName = 'Santosh Jatav') {
    const current = this.getOpenJobOffers();
    const offer = current.find(o => o.offer_id === offerId);
    if (!offer) return { success: false, message: 'Offer not found' };

    offer.status = 'ACCEPTED';
    offer.accepted_by = operatorId;
    offer.accepted_operator_name = operatorName;
    offer.accepted_at = new Date().toISOString();

    const remaining = current.filter(o => o.offer_id !== offerId);
    localStorage.setItem(OPERATOR_JOB_OFFERS_KEY, JSON.stringify(remaining));

    // Update booking in Supabase with this operator ID
    try {
      const client = checkClient();
      await client
        .from('bookings')
        .update({ operator_id: operatorId, hours: 1 })
        .or(`booking_id.eq.${offer.booking_id},id.eq.${offer.booking_id}`);
    } catch (e) {
      console.warn('[operatorDispatchService] Supabase operator update warning:', e);
    }

    // Broadcast acceptance across devices
    try {
      const ch = getSyncChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'operator_job_accepted',
          payload: {
            offer_id: offerId,
            booking_id: offer.booking_id,
            operator_id: operatorId,
            operator_name: operatorName
          }
        });
      }
    } catch (e) {
      console.warn('[operatorDispatchService] Acceptance broadcast warning:', e);
    }

    return { success: true, offer };
  }
};

