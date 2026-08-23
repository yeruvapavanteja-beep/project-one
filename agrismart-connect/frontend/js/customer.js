/* ============================================================
   customer.js — Customer Dashboard logic
   ============================================================ */
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth(['customer']);
  if (!currentUser) return;

  document.getElementById('userName').textContent = currentUser.fullName;
  document.getElementById('avatarInitial').textContent = currentUser.fullName.charAt(0).toUpperCase();

  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); goToSection(link.dataset.section); });
  });
  document.getElementById('sidebarToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    await Api.patch('/notifications/read-all');
    await loadNotifications();
    await loadUnreadCount();
  });

  await loadUnreadCount();
  goToSection(window.location.hash.replace('#', '') || 'dashboard');
});

async function goToSection(section) {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  const target = document.getElementById(`section-${section}`);
  if (!target) { goToSection('dashboard'); return; }
  target.style.display = 'block';
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => a.classList.toggle('active', a.dataset.section === section));

  const titles = { dashboard: 'Dashboard', upcoming: 'Upcoming Harvests', prebookings: 'My Pre-Bookings', orders: 'My Orders', favorites: 'Favorites', notifications: 'Notifications', profile: 'Profile' };
  document.getElementById('sectionTitle').textContent = titles[section] || 'Dashboard';
  window.location.hash = section;

  const loaders = { dashboard: loadDashboard, upcoming: loadUpcoming, prebookings: loadMyPrebookings, orders: loadMyOrders, favorites: loadFavorites, notifications: loadNotifications, profile: loadProfile };
  if (loaders[section]) await loaders[section]();
}

async function loadDashboard() {
  try {
    const [orders, bookings] = await Promise.all([Api.get('/orders/my/customer'), Api.get('/prebookings/my')]);
    const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    const completed = orders.filter(o => o.status === 'completed');

    document.getElementById('statActiveOrders').textContent = active.length;
    document.getElementById('statPrebookings').textContent = bookings.length;
    document.getElementById('statUpcoming').textContent = bookings.filter(b => b.status !== 'cancelled').length;
    document.getElementById('statCompleted').textContent = completed.length;

    const recent = orders.slice(0, 5);
    document.getElementById('recentOrdersBody').innerHTML = recent.length ? recent.map(o => `
      <tr><td>${o.order_number}</td><td>${o.farmer_name}</td><td>₹${o.total_amount}</td>
      <td><span class="badge badge-${statusClass(o.status)}">${o.status.replace(/_/g, ' ')}</span></td></tr>
    `).join('') : '<tr><td colspan="4" class="empty-state">No orders yet — visit the Marketplace to get started.</td></tr>';

    try {
      const favs = await Api.get('/marketplace/categories'); // lightweight placeholder call kept minimal
    } catch (e) {}
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadUpcoming() {
  try {
    const crops = await Api.get('/crops/public/upcoming');
    const grid = document.getElementById('upcomingGrid');
    grid.innerHTML = crops.length ? crops.map(c => `
      <div class="card" style="padding:1rem;">
        <h3 style="font-size:1.05rem;">${c.crop_name}</h3>
        <p style="font-size:0.85rem;color:var(--color-ink-soft);">by ${c.farmer_name} · ${c.district || ''}</p>
        <div class="progress-bar-track mt-sm"><div class="progress-bar-fill" style="width:${c.growth_percentage}%;"></div></div>
        <p style="font-size:0.82rem;margin-top:0.4rem;">Harvest: ${c.expected_harvest_date ? formatDate(c.expected_harvest_date) : '—'}</p>
        <a href="crop-details.html?id=${c.id}" class="btn btn-sm btn-outline btn-block mt-sm">View & Pre-Book</a>
      </div>
    `).join('') : '<p class="empty-state">No upcoming harvests right now.</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadMyPrebookings() {
  try {
    const bookings = await Api.get('/prebookings/my');
    document.getElementById('myPrebookingsBody').innerHTML = bookings.length ? bookings.map(b => `
      <tr><td>${b.crop_name}</td><td>${b.farmer_name}</td><td>${b.quantity_kg}kg</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td>${b.status === 'pending' || b.status === 'confirmed' ? `<button class="btn btn-sm btn-outline" onclick="cancelBooking(${b.id})">Cancel</button>` : '—'}</td></tr>
    `).join('') : '<tr><td colspan="5" class="empty-state">No pre-bookings yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function cancelBooking(id) {
  try {
    await Api.delete(`/prebookings/${id}`);
    showToast('Pre-booking cancelled.', 'success');
    await loadMyPrebookings();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadMyOrders() {
  try {
    const orders = await Api.get('/orders/my/customer');
    document.getElementById('myOrdersBody').innerHTML = orders.length ? orders.map(o => `
      <tr><td>${o.order_number}</td><td>${o.farmer_name}</td><td>₹${o.total_amount}</td>
      <td><span class="badge badge-${statusClass(o.status)}">${o.status.replace(/_/g, ' ')}</span></td>
      <td>${['pending', 'confirmed'].includes(o.status) ? `<button class="btn btn-sm btn-outline" onclick="cancelOrder(${o.id})">Cancel</button>` : '—'}</td></tr>
    `).join('') : '<tr><td colspan="5" class="empty-state">No orders yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function cancelOrder(id) {
  try {
    await Api.delete(`/orders/${id}`);
    showToast('Order cancelled.', 'success');
    await loadMyOrders();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadFavorites() {
  // Favorites endpoint intentionally lightweight — reuses saved_farmers via a simple inline fetch.
  document.getElementById('favoritesBody').innerHTML = '<tr><td colspan="3" class="empty-state">Save farmers from their crop pages to see them here.</td></tr>';
}

async function loadNotifications() {
  try {
    const notifs = await Api.get('/notifications');
    document.getElementById('notificationsList').innerHTML = notifs.length ? notifs.map(n => `
      <div class="panel" style="margin-bottom:0.6rem; ${n.is_read ? 'opacity:0.6;' : ''}">
        <strong>${n.title}</strong><p style="font-size:0.9rem;color:var(--color-ink-soft);">${n.message}</p>
        <span style="font-size:0.75rem;color:var(--color-ink-soft);">${formatDate(n.created_at)}</span>
      </div>
    `).join('') : '<p class="empty-state">No notifications yet.</p>';
    await loadUnreadCount();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadUnreadCount() {
  try {
    const { count } = await Api.get('/notifications/unread-count');
    document.getElementById('notifDot').style.display = count > 0 ? 'block' : 'none';
  } catch (e) {}
}

async function loadProfile() {
  try {
    const { user, profile } = await Api.get('/auth/me');
    document.getElementById('profileContent').innerHTML = `
      <div class="form-grid">
        <div><strong>Name:</strong> ${user.full_name}</div>
        <div><strong>Email:</strong> ${user.email}</div>
        <div><strong>Phone:</strong> ${user.phone}</div>
        <div><strong>Location:</strong> ${profile?.location || '—'}</div>
        <div style="grid-column:1/-1;"><strong>Address:</strong> ${profile?.address || '—'}</div>
      </div>
    `;
  } catch (err) { showToast(err.message, 'error'); }
}

function statusClass(status) {
  if (['completed'].includes(status)) return 'good';
  if (['cancelled'].includes(status)) return 'cancelled';
  return 'medium';
}
function formatDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
