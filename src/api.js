/**
 * The single place the frontend talks to the API.
 *
 * Every fetch in the app used to be hand-rolled, with no shared error
 * handling — a failed request usually ended up as a console.error and a
 * screen that silently showed nothing. These helpers send the session cookie,
 * turn a non-2xx response into a thrown ApiError carrying the server's
 * message, and give the UI something to display.
 */

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** True when the right response is to send the person back to the login screen. */
  get isAuthError() {
    return this.status === 401;
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      // Without this the session cookie is not sent and every call is a 401.
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "Could not reach the server. Is it running?");
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.error || `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload?.details);
  }

  return payload;
}

const query = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const api = {
  // auth
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  // employees
  employees: () => request("/api/employees"),
  createEmployee: (employee) =>
    request("/api/employees", { method: "POST", body: employee }),
  updateEmployee: (id, employee) =>
    request(`/api/employees/${id}`, { method: "PUT", body: employee }),

  // clock
  clockIn: (empName) => request("/clock-in", { method: "POST", body: { empName } }),
  clockOut: (empName) => request("/clock-out", { method: "POST", body: { empName } }),
  activeSession: (empName) => request(`/clock-in/${encodeURIComponent(empName)}`),
  clearActiveSession: (empName) =>
    request(`/clock-in/${encodeURIComponent(empName)}`, { method: "DELETE" }),

  // time entries
  employeeLogs: (params) => request(`/api/employee-logs${query(params)}`),
  timeEntries: (params) => request(`/api/time-entries${query(params)}`),
  updateTimeEntry: (id, patch) =>
    request(`/api/time-entry/${id}`, { method: "PUT", body: patch }),
  timeEntryEdits: (id) => request(`/api/time-entry/${id}/edits`),

  // notes & stats
  adminNotes: (params) => request(`/api/admin-notes${query(params)}`),
  createAdminNote: (note) =>
    request("/api/admin-notes", { method: "POST", body: note }),
  employeeStats: (employeeName) =>
    request(`/api/employee-stats${query({ employeeName })}`),
  emails: () => request("/api/emails"),
};

export default api;
