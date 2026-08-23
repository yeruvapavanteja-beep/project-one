/* ============================================================
   api.js — Shared fetch wrapper used by every page.
   Handles base URL, JWT attachment, and consistent error shape.
   ============================================================ */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

const Api = {
  getToken() {
    return localStorage.getItem('asc_token');
  },

  setToken(token) {
    localStorage.setItem('asc_token', token);
  },

  clearSession() {
    localStorage.removeItem('asc_token');
    localStorage.removeItem('asc_user');
  },

  getUser() {
    const raw = localStorage.getItem('asc_user');
    return raw ? JSON.parse(raw) : null;
  },

  setUser(user) {
    localStorage.setItem('asc_user', JSON.stringify(user));
  },

  /**
   * @param {string} path - e.g. '/auth/login'
   * @param {object} options - { method, body, isFormData }
   */
  async request(path, options = {}) {
    const { method = 'GET', body = null, isFormData = false } = options;
    const headers = {};
    const token = Api.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
      });
    } catch (networkErr) {
      throw new Error('Could not reach the server. Please check your connection and try again.');
    }

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error('Unexpected server response.');
    }

    if (!res.ok || data.success === false) {
      const err = new Error(data.message || 'Something went wrong.');
      err.status = res.status;
      err.errors = data.errors || null;
      throw err;
    }

    return data.data;
  },

  get(path) { return Api.request(path, { method: 'GET' }); },
  post(path, body, isFormData = false) { return Api.request(path, { method: 'POST', body, isFormData }); },
  put(path, body, isFormData = false) { return Api.request(path, { method: 'PUT', body, isFormData }); },
  patch(path, body) { return Api.request(path, { method: 'PATCH', body }); },
  delete(path) { return Api.request(path, { method: 'DELETE' }); }
};

/** Redirects to login if there is no token (used on dashboard pages). */
function requireAuth(allowedRoles = []) {
  const token = Api.getToken();
  const user = Api.getUser();
  if (!token || !user) {
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

/** Small toast helper reused across pages. Requires a <div id="toast-root"></div>. */
function showToast(message, type = 'success') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  const bg = type === 'error' ? '#B3261E' : type === 'info' ? '#2B5C7A' : '#2D6A4F';
  toast.textContent = message;
  toast.style.cssText = `background:${bg};color:#fff;padding:12px 18px;border-radius:10px;font-family:'Inter',sans-serif;font-size:0.92rem;box-shadow:0 8px 24px rgba(0,0,0,0.15);max-width:320px;animation:toastIn 0.25s ease;`;
  root.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const styleTag = document.createElement('style');
styleTag.textContent = '@keyframes toastIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform:translateY(0); } }';
document.head.appendChild(styleTag);
