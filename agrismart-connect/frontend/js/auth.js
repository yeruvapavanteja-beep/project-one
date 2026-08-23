/* ============================================================
   auth.js — Login, Register, role tab switching, redirects
   ============================================================ */

function redirectToDashboard(role) {
  if (role === 'farmer') window.location.href = 'farmer-dashboard.html';
  else if (role === 'customer') window.location.href = 'customer-dashboard.html';
  else if (role === 'admin') window.location.href = 'admin-dashboard.html';
  else window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, skip straight to dashboard
  const existingUser = Api.getUser();
  if (existingUser && Api.getToken() && (document.getElementById('loginForm') || document.getElementById('farmerRegisterForm'))) {
    // Don't force-redirect automatically to avoid surprising the user on a shared device;
    // they can navigate manually. (Left intentionally passive.)
  }

  // ---------------- LOGIN PAGE ----------------
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    let loginMode = 'standard'; // 'standard' | 'admin'
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loginMode = tab.dataset.role === 'admin' ? 'admin' : 'standard';
      });
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      btn.textContent = 'Logging in...';
      btn.disabled = true;
      try {
        const endpoint = loginMode === 'admin' ? '/auth/admin/login' : '/auth/login';
        const result = await Api.post(endpoint, { email, password });
        Api.setToken(result.token);
        Api.setUser(result.user);
        showToast(`Welcome back, ${result.user.fullName}!`, 'success');
        setTimeout(() => redirectToDashboard(result.user.role), 600);
      } catch (err) {
        showToast(err.message, 'error');
        btn.textContent = 'Log In';
        btn.disabled = false;
      }
    });
  }

  // ---------------- REGISTER PAGE ----------------
  const farmerForm = document.getElementById('farmerRegisterForm');
  const customerForm = document.getElementById('customerRegisterForm');
  if (farmerForm && customerForm) {
    const urlRole = new URLSearchParams(window.location.search).get('role');

    function showRole(role) {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.role === role));
      farmerForm.style.display = role === 'farmer' ? 'block' : 'none';
      customerForm.style.display = role === 'customer' ? 'block' : 'none';
    }
    if (urlRole === 'customer') showRole('customer'); else showRole('farmer');

    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => showRole(tab.dataset.role));
    });

    farmerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(farmerForm);
      const payload = Object.fromEntries(fd.entries());
      if (payload.farmArea) payload.farmArea = parseFloat(payload.farmArea);
      try {
        const result = await Api.post('/auth/register/farmer', payload);
        Api.setToken(result.token);
        Api.setUser(result.user);
        showToast('Account created! Redirecting to your dashboard...', 'success');
        setTimeout(() => redirectToDashboard('farmer'), 700);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(customerForm);
      const payload = Object.fromEntries(fd.entries());
      try {
        const result = await Api.post('/auth/register/customer', payload);
        Api.setToken(result.token);
        Api.setUser(result.user);
        showToast('Account created! Redirecting to your dashboard...', 'success');
        setTimeout(() => redirectToDashboard('customer'), 700);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
});

/** Reusable logout handler used by all dashboard sidebars. */
function logout() {
  Api.clearSession();
  window.location.href = 'login.html';
}
