/**
 * NITI Unified API Client for Backend Communication
 */

const API_BASE = "/api/v1";

class NitiClient {
  constructor() {
    this.token = localStorage.getItem("niti_token") || null;
    try {
      this.currentUser = JSON.parse(localStorage.getItem("niti_user") || "null");
    } catch {
      this.currentUser = null;
    }
    this.currentRole = localStorage.getItem("niti_role") || null;
  }

  getCurrentUser() {
    if (!this.currentUser) {
      try {
        this.currentUser = JSON.parse(localStorage.getItem("niti_user") || "null");
      } catch {
        this.currentUser = null;
      }
    }
    return this.currentUser;
  }

  getCurrentRole() {
    if (!this.currentRole) {
      this.currentRole = localStorage.getItem("niti_role") || null;
    }
    return this.currentRole;
  }

  setSession(token, user, role) {
    this.token = token;
    this.currentUser = user;
    this.currentRole = role;
    if (token) localStorage.setItem("niti_token", token);
    if (user) localStorage.setItem("niti_user", JSON.stringify(user));
    if (role) localStorage.setItem("niti_role", role);
  }

  clearSession() {
    this.token = null;
    this.currentUser = null;
    this.currentRole = null;
    localStorage.removeItem("niti_token");
    localStorage.removeItem("niti_user");
    localStorage.removeItem("niti_role");
  }

  logout() {
    this.clearSession();
  }

  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // --- Auth & OTP ---
  async sendOtp(phoneNumber, role = "FARMER") {
    return this.request("/auth/niti/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone_number: phoneNumber, role }),
    });
  }

  async verifyOtp(phoneNumber, otpCode, role = "FARMER") {
    return this.request("/auth/niti/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode, role }),
    });
  }

  async loginFarmer({ phoneNumber, otpCode, email, password }) {
    const data = await this.request("/auth/niti/farmer/login", {
      method: "POST",
      body: JSON.stringify({
        phone_number: phoneNumber,
        otp_code: otpCode,
        email,
        password,
      }),
    });
    this.setSession(data.access_token, data.user || data, "FARMER");
    return data;
  }

  async loginChc({ email, password, phoneNumber, otpCode }) {
    const data = await this.request("/auth/niti/chc/login", {
      method: "POST",
      body: JSON.stringify({ email, password, phone_number: phoneNumber, otp_code: otpCode }),
    });
    this.setSession(data.access_token, data.user || data, "CHC_MANAGER");
    return data;
  }

  async loginOperator({ phoneNumber, otpCode, email, password }) {
    const data = await this.request("/auth/niti/operator/login", {
      method: "POST",
      body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode, email, password }),
    });
    this.setSession(data.access_token, data.user || data, "OPERATOR");
    return data;
  }

  // --- Profiles ---
  async getFarmerProfile() {
    return this.request("/auth/niti/farmer/profile");
  }

  async updateFarmerProfile(payload) {
    return this.request("/auth/niti/farmer/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async getOperatorProfile() {
    return this.request("/auth/niti/operator/profile");
  }

  async updateOperatorProfile(payload) {
    return this.request("/auth/niti/operator/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // --- Voice Assistant ---
  async parseVoiceTranscript(text, language = "hi") {
    return this.request("/voice/parse", {
      method: "POST",
      body: JSON.stringify({ text, language }),
    });
  }

  async explainOffers(offerIds, acreage = 5.0, question = "", language = "hi") {
    return this.request("/voice/explain-offers", {
      method: "POST",
      body: JSON.stringify({ offer_ids: offerIds, acreage, question, language }),
    });
  }

  async explainOffersVoice(offerA, offerB, question = "", language = "hi") {
    const offerIds = [offerA?.offer_id, offerB?.offer_id].filter(Boolean);
    return this.explainOffers(offerIds, 5.0, question, language);
  }

  // --- Offers & Search ---
  async searchOffers(params) {
    return this.request("/offers/search", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // --- Bookings ---
  async createBooking(bookingData) {
    return this.request("/bookings/niti/create", {
      method: "POST",
      body: JSON.stringify(bookingData),
    });
  }

  async getMyBookings(statusFilter = null) {
    const query = statusFilter ? `?status_filter=${statusFilter}` : "";
    return this.request(`/bookings/niti/my-bookings${query}`);
  }

  async getFarmerBookings() {
    return this.getMyBookings();
  }

  async updateBookingStatus(bookingId, newStatus, note = "") {
    const query = `?new_status=${newStatus}${note ? `&note=${encodeURIComponent(note)}` : ""}`;
    return this.request(`/bookings/niti/${bookingId}/status${query}`, {
      method: "POST",
    });
  }

  // --- CHC Dashboard ---
  async getChcStats() {
    return this.request("/chc/dashboard/stats");
  }

  async getChcMachines() {
    return this.request("/chc/dashboard/machines");
  }

  async addChcMachine(machineData) {
    return this.request("/chc/dashboard/machines", {
      method: "POST",
      body: JSON.stringify(machineData),
    });
  }

  async getChcOperators() {
    return this.request("/chc/dashboard/operators");
  }

  async getChcBookings() {
    return this.request("/chc/dashboard/bookings");
  }

  async getChcTodaySchedule() {
    return this.request("/chc/dashboard/today-schedule");
  }

  async getChcRecentRequests() {
    return this.request("/chc/dashboard/recent-requests");
  }

  async getChcMapData() {
    return this.request("/chc/dashboard/map-data");
  }

  async reviewChcServiceRequest(requestId, action, notes = "") {
    return this.request(`/chc/dashboard/requests/${requestId}/review`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    });
  }

  async manageBookingAction(bookingId, action, operatorId = null) {
    const query = `?action=${action}${operatorId ? `&operator_id=${operatorId}` : ""}`;
    return this.request(`/chc/dashboard/bookings/${bookingId}/action${query}`, {
      method: "POST",
    });
  }

  async chcBookingAction(bookingId, action, note = "") {
    return this.manageBookingAction(bookingId, action);
  }

  async reportBreakdown(payload) {
    return this.request("/breakdowns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async reportMachineBreakdown(machineId, payload) {
    return this.reportBreakdown({ machine_id: machineId, ...payload });
  }

  // --- Operator Dashboard ---
  async getOperatorAssignedJobs() {
    return this.request("/operator/dashboard/assigned-jobs");
  }

  async getOperatorJobs() {
    return this.getOperatorAssignedJobs();
  }

  async updateJobStatus(bookingId, newStatus, note = "") {
    const query = `?new_status=${newStatus}${note ? `&note=${encodeURIComponent(note)}` : ""}`;
    return this.request(`/operator/dashboard/jobs/${bookingId}/update-status${query}`, {
      method: "POST",
    });
  }

  async reportJobIssue(bookingId, issuePayload) {
    const issueType = typeof issuePayload === 'object' ? issuePayload.issue_type : issuePayload;
    const description = typeof issuePayload === 'object' ? issuePayload.description : '';
    const query = `?issue_type=${issueType}&description=${encodeURIComponent(description || "")}`;
    return this.request(`/operator/dashboard/jobs/${bookingId}/report-issue${query}`, {
      method: "POST",
    });
  }

  async toggleOperatorAvailability() {
    return this.request("/operator/dashboard/toggle-availability", {
      method: "POST",
    });
  }
}

export const nitiClient = new NitiClient();
export default nitiClient;
