/* ============================================================
   farmer.js — Farmer Dashboard logic
   ============================================================ */
let currentUser = null;
let myFarms = [];
let myCrops = [];

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth(['farmer']);
  if (!currentUser) return;

  document.getElementById('userName').textContent = currentUser.fullName;
  document.getElementById('avatarInitial').textContent = currentUser.fullName.charAt(0).toUpperCase();

  setupSidebarNav();
  setupSidebarToggle();
  setupForms();
  await loadUnreadCount();

  goToSection(window.location.hash.replace('#', '') || 'dashboard');
});

// ---------------- Section routing ----------------
function setupSidebarNav() {
  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToSection(link.dataset.section);
    });
  });
}

async function goToSection(section) {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  const target = document.getElementById(`section-${section}`);
  if (!target) { goToSection('dashboard'); return; }
  target.style.display = 'block';

  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.toggle('active', a.dataset.section === section));
  const titles = {
    dashboard: 'Dashboard', farm: 'My Farm', soil: 'Soil Analysis', recommendations: 'Crop Recommendations',
    crops: 'My Crops', growth: 'Crop Growth', harvest: 'Upcoming Harvest', prebookings: 'Pre-Bookings',
    orders: 'Orders', analytics: 'Analytics', notifications: 'Notifications', profile: 'Profile'
  };
  document.getElementById('sectionTitle').textContent = titles[section] || 'Dashboard';
  window.location.hash = section;

  const loaders = {
    dashboard: loadDashboardOverview, farm: loadFarms, soil: loadFarmsForSelect.bind(null, 'soilFarmSelect'),
    recommendations: loadFarmsForSelect.bind(null, 'recoFarmSelect'), crops: loadCrops,
    growth: loadGrowthSection, harvest: loadHarvestSection, prebookings: loadAllBookings,
    orders: loadOrders, analytics: loadAnalytics, notifications: loadNotifications, profile: loadProfile
  };
  if (loaders[section]) await loaders[section]();
}

function setupSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

// ---------------- Dashboard overview ----------------
async function loadDashboardOverview() {
  try {
    const [crops, bookings, analytics] = await Promise.all([
      Api.get('/crops'), Api.get('/prebookings/farmer'), Api.get('/analytics/farmer')
    ]);
    myCrops = crops;

    const active = crops.filter(c => ['planned', 'growing', 'ready_for_harvest'].includes(c.status));
    const upcoming = crops.filter(c => ['growing', 'ready_for_harvest'].includes(c.status));
    const estQty = crops.reduce((sum, c) => sum + (parseFloat(c.estimated_quantity_kg) || 0), 0);

    document.getElementById('statTotalCrops').textContent = crops.length;
    document.getElementById('statActiveCrops').textContent = active.length;
    document.getElementById('statUpcomingHarvests').textContent = upcoming.length;
    document.getElementById('statPrebookings').textContent = bookings.length;
    document.getElementById('statCompletedOrders').textContent = analytics.orderSummary.completedOrders || 0;
    document.getElementById('statEstQuantity').textContent = estQty.toLocaleString();
    document.getElementById('statDemand').textContent = bookings.length > 5 ? 'High' : bookings.length > 0 ? 'Moderate' : 'Low';

    const recent = bookings.slice(0, 5);
    document.getElementById('recentBookingsBody').innerHTML = recent.length ? recent.map(b => `
      <tr><td>${b.customer_name}</td><td>${b.crop_name}</td><td>${b.quantity_kg}kg</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td><td>${formatDate(b.created_at)}</td></tr>
    `).join('') : `<tr><td colspan="5" class="empty-state">No pre-bookings yet.</td></tr>`;
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------- Farm ----------------
function setupForms() {
  document.getElementById('farmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    if (payload.farmArea) payload.farmArea = parseFloat(payload.farmArea);
    if (payload.farmingExperienceYears) payload.farmingExperienceYears = parseInt(payload.farmingExperienceYears);
    try {
      await Api.post('/farms', payload);
      showToast('Farm saved successfully.', 'success');
      e.target.reset();
      await loadFarms();
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('soilForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    ['soilPh', 'nitrogen', 'phosphorus', 'potassium', 'organicMatter'].forEach(k => { if (payload[k]) payload[k] = parseFloat(payload[k]); });
    try {
      const result = await Api.post('/soil', payload);
      renderSoilResult(result.analysis);
      showToast('Soil analysis complete.', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('recoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      farmId: fd.get('farmId'), season: fd.get('season'), waterAvailability: fd.get('waterAvailability'),
      soil: {
        soilPh: parseFloat(fd.get('soilPh')),
        nitrogen: fd.get('nitrogen') ? parseFloat(fd.get('nitrogen')) : null,
        phosphorus: fd.get('phosphorus') ? parseFloat(fd.get('phosphorus')) : null,
        potassium: fd.get('potassium') ? parseFloat(fd.get('potassium')) : null,
        soilType: fd.get('soilType') || null
      },
      weather: fd.get('rainfall') ? { rainfall: fd.get('rainfall') } : null
    };
    try {
      const result = await Api.post('/recommendations', payload);
      renderRecommendations(result.recommendations);
      showToast('Recommendations generated.', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('cropForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await Api.post('/crops', fd, true);
      showToast('Crop added successfully.', 'success');
      e.target.reset();
      await loadCrops();
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('growthForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cropId = fd.get('cropId');
    fd.delete('cropId');
    try {
      await Api.post(`/growth/${cropId}`, fd, true);
      showToast('Growth update recorded.', 'success');
      e.target.reset();
      await loadGrowthTimeline(cropId);
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    await Api.patch('/notifications/read-all');
    await loadNotifications();
    await loadUnreadCount();
  });

  document.getElementById('timelineCropSelect').addEventListener('change', (e) => loadGrowthTimeline(e.target.value));
}

async function loadFarms() {
  try {
    myFarms = await Api.get('/farms');
    document.getElementById('farmsBody').innerHTML = myFarms.length ? myFarms.map(f => `
      <tr><td>${f.farm_name}</td><td>${f.location || '—'}</td><td>${f.farm_area} acres</td><td>${f.soil_type || '—'}</td><td>${f.water_availability}</td></tr>
    `).join('') : `<tr><td colspan="5" class="empty-state">No farms yet. Add one above.</td></tr>`;
    populateFarmSelects();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadFarmsForSelect(selectId) {
  if (!myFarms.length) { try { myFarms = await Api.get('/farms'); } catch (e) {} }
  populateFarmSelects();
}

function populateFarmSelects() {
  const options = myFarms.map(f => `<option value="${f.id}">${f.farm_name}</option>`).join('');
  ['soilFarmSelect', 'recoFarmSelect', 'cropFarmSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options || '<option value="">Add a farm first</option>';
  });
}

function renderSoilResult(analysis) {
  const panel = document.getElementById('soilResultPanel');
  panel.style.display = 'block';
  document.getElementById('soilResultContent').innerHTML = `
    <p><strong>Soil Condition:</strong> <span class="badge badge-${analysis.condition.toLowerCase().replace(' ', '-')}">${analysis.condition}</span> &nbsp; <strong>pH Category:</strong> ${analysis.phLabel}</p>
    <p class="mt-sm"><strong>Suitable Categories:</strong> ${analysis.suitableCategories.join(', ') || 'General crops'}</p>
    <p class="mt-sm"><strong>Observations:</strong></p><ul style="padding-left:1.2rem;">${analysis.observations.map(o => `<li>${o}</li>`).join('')}</ul>
    <p class="mt-sm"><strong>Recommended Next Steps:</strong></p><ul style="padding-left:1.2rem;">${analysis.nextSteps.map(o => `<li>${o}</li>`).join('')}</ul>
    <p style="font-size:0.82rem;color:var(--color-ink-soft);margin-top:var(--space-md);border-top:1px solid var(--color-border);padding-top:var(--space-sm);">${analysis.disclaimer}</p>
  `;
  panel.scrollIntoView({ behavior: 'smooth' });
}

function renderRecommendations(list) {
  const panel = document.getElementById('recoResultsPanel');
  panel.style.display = 'block';
  document.getElementById('recoResultsContent').innerHTML = list.map((r, i) => `
    <div class="reco-card">
      <span class="reco-rank">#${i + 1} Recommended</span>
      <h3>${r.cropName} — Suitability: <span class="badge badge-${r.suitability.toLowerCase()}">${r.suitability}</span></h3>
      <div class="reco-meta">
        <span>⏱ Harvest in ~${r.expectedHarvestDays || '—'} days</span>
        <span>💧 Water: ${r.waterRequirement}</span>
        <span>📈 Demand: ${r.demandOutlook}${r.isDemandSampleData ? ' (sample data)' : ''}</span>
        <span>Score: ${r.overallScore}/10</span>
      </div>
      <div class="reco-why">${r.whyThisCrop}</div>
    </div>
  `).join('');
  panel.scrollIntoView({ behavior: 'smooth' });
}

// ---------------- Crops ----------------
async function loadCrops() {
  try {
    myCrops = await Api.get('/crops');
    document.getElementById('cropsBody').innerHTML = myCrops.length ? myCrops.map(c => `
      <tr>
        <td>${c.crop_name}</td>
        <td><span class="badge badge-${statusBadgeClass(c.status)}">${c.status.replace(/_/g, ' ')}</span></td>
        <td>${c.expected_harvest_date ? formatDate(c.expected_harvest_date) : '—'}</td>
        <td>${c.estimated_quantity_kg || 0}kg</td>
        <td>${c.prebooked_quantity_kg || 0}kg</td>
        <td>
          <select onchange="updateCropStatus(${c.id}, this.value)" class="btn-sm" style="border:1px solid var(--color-border);border-radius:6px;padding:0.3rem;">
            <option value="">Change Status</option>
            <option value="planned">Planned</option><option value="growing">Growing</option>
            <option value="ready_for_harvest">Ready for Harvest</option><option value="harvested">Harvested</option>
            <option value="sold">Sold</option><option value="completed">Completed</option>
          </select>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6" class="empty-state">No crops yet. Add one above.</td></tr>`;
    populateFarmSelects();
  } catch (err) { showToast(err.message, 'error'); }
}

async function updateCropStatus(cropId, status) {
  if (!status) return;
  try {
    await Api.patch(`/crops/${cropId}/status`, { status });
    showToast('Crop status updated.', 'success');
    await loadCrops();
  } catch (err) { showToast(err.message, 'error'); }
}

function statusBadgeClass(status) {
  if (['ready_for_harvest', 'harvested', 'sold', 'completed'].includes(status)) return 'good';
  if (status === 'growing') return 'medium';
  return 'info';
}

// ---------------- Growth ----------------
async function loadGrowthSection() {
  if (!myCrops.length) { try { myCrops = await Api.get('/crops'); } catch (e) {} }
  const options = myCrops.map(c => `<option value="${c.id}">${c.crop_name}</option>`).join('');
  document.getElementById('growthCropSelect').innerHTML = options || '<option value="">Add a crop first</option>';
  document.getElementById('timelineCropSelect').innerHTML = `<option value="">Select crop</option>${options}`;
}

async function loadGrowthTimeline(cropId) {
  if (!cropId) return;
  try {
    const updates = await Api.get(`/growth/${cropId}`);
    document.getElementById('growthTimelineContent').innerHTML = updates.length ? updates.map(u => `
      <div class="timeline-item">
        <div class="t-stage">${u.growth_stage.replace(/_/g, ' ')} — ${u.growth_percentage}%</div>
        <div class="t-date">${formatDate(u.update_date)} · Health: ${u.health_status}</div>
        ${u.notes ? `<div class="t-notes">${u.notes}</div>` : ''}
      </div>
    `).join('') : '<p class="empty-state">No growth updates yet.</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------- Harvest ----------------
async function loadHarvestSection() {
  if (!myCrops.length) { try { myCrops = await Api.get('/crops'); } catch (e) {} }
  const upcoming = myCrops.filter(c => ['growing', 'ready_for_harvest', 'planned'].includes(c.status));
  const rows = await Promise.all(upcoming.map(async (c) => {
    try {
      const summary = await Api.get(`/prebookings/crop/${c.id}/summary`);
      return `<tr><td>${c.crop_name}</td><td>${c.expected_harvest_date ? formatDate(c.expected_harvest_date) : '—'}</td>
        <td>${summary.expectedQuantityKg || 0}kg</td><td>${summary.prebookedKg || 0}kg</td>
        <td>${summary.remainingKg || 0}kg</td><td>${summary.numberOfCustomers || 0}</td></tr>`;
    } catch (e) { return ''; }
  }));
  document.getElementById('harvestBody').innerHTML = rows.filter(Boolean).join('') || '<tr><td colspan="6" class="empty-state">No upcoming harvests.</td></tr>';
}

// ---------------- Pre-bookings ----------------
async function loadAllBookings() {
  try {
    const bookings = await Api.get('/prebookings/farmer');
    document.getElementById('allBookingsBody').innerHTML = bookings.length ? bookings.map(b => `
      <tr><td>${b.customer_name}</td><td>${b.crop_name}</td><td>${b.quantity_kg}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td><td>${formatDate(b.created_at)}</td>
      <td>${b.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="confirmBooking(${b.id})">Confirm</button>` : '—'}</td></tr>
    `).join('') : `<tr><td colspan="6" class="empty-state">No pre-bookings yet.</td></tr>`;
  } catch (err) { showToast(err.message, 'error'); }
}

async function confirmBooking(id) {
  try {
    await Api.patch(`/prebookings/${id}/confirm`);
    showToast('Booking confirmed.', 'success');
    await loadAllBookings();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------- Orders ----------------
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
async function loadOrders() {
  try {
    const orders = await Api.get('/orders/my/farmer');
    document.getElementById('ordersBody').innerHTML = orders.length ? orders.map(o => `
      <tr><td>${o.order_number}</td><td>${o.customer_name}</td><td>₹${o.total_amount}</td>
      <td><span class="badge badge-${statusBadgeClass(o.status)}">${o.status.replace(/_/g, ' ')}</span></td>
      <td><select onchange="updateOrderStatus(${o.id}, this.value)" class="btn-sm" style="border:1px solid var(--color-border);border-radius:6px;padding:0.3rem;">
        <option value="">Update</option>${ORDER_STATUSES.map(s => `<option value="${s}">${s.replace(/_/g, ' ')}</option>`).join('')}
      </select></td></tr>
    `).join('') : `<tr><td colspan="5" class="empty-state">No orders yet.</td></tr>`;
  } catch (err) { showToast(err.message, 'error'); }
}

async function updateOrderStatus(orderId, status) {
  if (!status) return;
  try {
    await Api.patch(`/orders/${orderId}/status`, { status });
    showToast('Order status updated.', 'success');
    await loadOrders();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------- Analytics ----------------
let chartMonthly, chartPrebook;
async function loadAnalytics() {
  try {
    const data = await Api.get('/analytics/farmer');
    document.getElementById('cropPerfBody').innerHTML = data.cropPerformance.map(c => `
      <tr><td>${c.crop_name}</td><td>${c.status.replace(/_/g, ' ')}</td><td>${c.estimated_quantity_kg || 0}kg</td>
      <td>${c.sold_quantity_kg || 0}kg</td><td>${c.prebooked_quantity_kg || 0}kg</td></tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No crop data yet.</td></tr>';

    const months = data.monthlySales.map(m => m.month);
    const revenue = data.monthlySales.map(m => parseFloat(m.revenue));
    if (chartMonthly) chartMonthly.destroy();
    chartMonthly = new Chart(document.getElementById('chartMonthlySales'), {
      type: 'line',
      data: { labels: months.length ? months : ['No data'], datasets: [{ label: 'Revenue (₹)', data: revenue.length ? revenue : [0], borderColor: '#40916C', backgroundColor: 'rgba(64,145,108,0.15)', fill: true, tension: 0.35 }] },
      options: { responsive: true, maintainAspectRatio: false }
    });

    const pr = data.prebookingRate;
    if (chartPrebook) chartPrebook.destroy();
    chartPrebook = new Chart(document.getElementById('chartPrebookRate'), {
      type: 'doughnut',
      data: { labels: ['Confirmed', 'Cancelled', 'Pending/Other'], datasets: [{ data: [pr.confirmedBookings || 0, pr.cancelledBookings || 0, Math.max(0, (pr.totalBookings || 0) - (pr.confirmedBookings || 0) - (pr.cancelledBookings || 0))], backgroundColor: ['#40916C', '#B3261E', '#D4A017'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------- Notifications ----------------
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

// ---------------- Profile ----------------
async function loadProfile() {
  try {
    const { user, profile } = await Api.get('/auth/me');
    document.getElementById('profileContent').innerHTML = `
      <div class="form-grid">
        <div><strong>Name:</strong> ${user.full_name}</div>
        <div><strong>Email:</strong> ${user.email}</div>
        <div><strong>Phone:</strong> ${user.phone}</div>
        <div><strong>Location:</strong> ${profile?.location || '—'}</div>
        <div><strong>District:</strong> ${profile?.district || '—'}</div>
        <div><strong>Farm Area:</strong> ${profile?.farm_area || '—'} acres</div>
        <div><strong>Farmer Type:</strong> ${profile?.farmer_type || '—'}</div>
        <div><strong>Verified:</strong> ${profile?.verified ? 'Yes ✅' : 'Not yet verified'}</div>
      </div>
    `;
  } catch (err) { showToast(err.message, 'error'); }
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
