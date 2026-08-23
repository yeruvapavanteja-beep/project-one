/* ============================================================
   admin.js — Admin Dashboard logic
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth(['admin']);
  if (!user) return;

  document.getElementById('userName').textContent = user.fullName;
  document.getElementById('avatarInitial').textContent = user.fullName.charAt(0).toUpperCase();

  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); goToSection(link.dataset.section); });
  });
  document.getElementById('sidebarToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try { await Api.post('/admin/categories', payload); showToast('Category added.', 'success'); e.target.reset(); }
    catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('locationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try { await Api.post('/admin/locations', payload); showToast('Location added.', 'success'); e.target.reset(); }
    catch (err) { showToast(err.message, 'error'); }
  });

  goToSection('dashboard');
});

async function goToSection(section) {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.getElementById(`section-${section}`).style.display = 'block';
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.toggle('active', a.dataset.section === section));
  const titles = { dashboard: 'Dashboard', farmers: 'Farmers', customers: 'Customers', crops: 'Crops', orders: 'Orders', prebookings: 'Pre-Bookings', complaints: 'Complaints', settings: 'Categories & Locations' };
  document.getElementById('sectionTitle').textContent = titles[section];

  const loaders = { dashboard: loadStats, farmers: loadFarmers, customers: loadCustomers, crops: loadCrops, orders: loadOrders, prebookings: loadPrebookings, complaints: loadComplaints };
  if (loaders[section]) await loaders[section]();
}

async function loadStats() {
  try {
    const s = await Api.get('/admin/dashboard');
    document.getElementById('statFarmers').textContent = s.totalFarmers;
    document.getElementById('statCustomers').textContent = s.totalCustomers;
    document.getElementById('statActiveCrops').textContent = s.activeCrops;
    document.getElementById('statUpcoming').textContent = s.upcomingHarvests;
    document.getElementById('statOrders').textContent = s.totalOrders;
    document.getElementById('statPrebookings').textContent = s.totalPrebookings;
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadFarmers() {
  try {
    const farmers = await Api.get('/admin/farmers');
    document.getElementById('farmersBody').innerHTML = farmers.map(f => `
      <tr><td>${f.full_name}</td><td>${f.email}</td><td>${f.district || '—'}</td>
      <td><span class="badge badge-${f.status === 'active' ? 'good' : 'cancelled'}">${f.status}</span></td>
      <td>${f.verified ? '✅' : '—'}</td>
      <td>
        ${!f.verified ? `<button class="btn btn-sm btn-outline" onclick="verifyFarmer(${f.farmer_id})">Verify</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="toggleUserStatus(${f.id}, '${f.status}')">${f.status === 'active' ? 'Suspend' : 'Activate'}</button>
      </td></tr>
    `).join('') || '<tr><td colspan="6" class="empty-state">No farmers yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function verifyFarmer(farmerId) {
  try { await Api.patch(`/admin/farmers/${farmerId}/verify`); showToast('Farmer verified.', 'success'); loadFarmers(); }
  catch (err) { showToast(err.message, 'error'); }
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  try { await Api.patch(`/admin/users/${userId}/status`, { status: newStatus }); showToast('Status updated.', 'success'); loadFarmers(); loadCustomers(); }
  catch (err) { showToast(err.message, 'error'); }
}

async function loadCustomers() {
  try {
    const customers = await Api.get('/admin/customers');
    document.getElementById('customersBody').innerHTML = customers.map(c => `
      <tr><td>${c.full_name}</td><td>${c.email}</td><td>${c.location || '—'}</td>
      <td><span class="badge badge-${c.status === 'active' ? 'good' : 'cancelled'}">${c.status}</span></td>
      <td><button class="btn btn-sm btn-outline" onclick="toggleUserStatus(${c.id}, '${c.status}')">${c.status === 'active' ? 'Suspend' : 'Activate'}</button></td></tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No customers yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadCrops() {
  try {
    const crops = await Api.get('/admin/crops');
    document.getElementById('cropsBody').innerHTML = crops.map(c => `
      <tr><td>${c.crop_name}</td><td>${c.farmer_name}</td><td>${c.status.replace(/_/g,' ')}</td>
      <td>${c.expected_harvest_date ? new Date(c.expected_harvest_date).toLocaleDateString() : '—'}</td><td>${c.estimated_quantity_kg || 0}kg</td></tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No crops yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadOrders() {
  try {
    const orders = await Api.get('/admin/orders');
    document.getElementById('ordersBody').innerHTML = orders.map(o => `
      <tr><td>${o.order_number}</td><td>${o.customer_name}</td><td>${o.farmer_name}</td><td>₹${o.total_amount}</td>
      <td><span class="badge badge-medium">${o.status.replace(/_/g,' ')}</span></td></tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No orders yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadPrebookings() {
  try {
    const bookings = await Api.get('/admin/prebookings');
    document.getElementById('prebookingsBody').innerHTML = bookings.map(b => `
      <tr><td>${b.crop_name}</td><td>${b.customer_name}</td><td>${b.farmer_name}</td><td>${b.quantity_kg}kg</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td></tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No pre-bookings yet.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadComplaints() {
  try {
    const complaints = await Api.get('/admin/complaints');
    document.getElementById('complaintsBody').innerHTML = complaints.map(c => `
      <tr><td>${c.subject}</td><td>${c.raised_by_name}</td><td><span class="badge badge-medium">${c.status}</span></td>
      <td><select onchange="updateComplaint(${c.id}, this.value)" class="btn-sm"><option value="">Update</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></td></tr>
    `).join('') || '<tr><td colspan="4" class="empty-state">No complaints.</td></tr>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function updateComplaint(id, status) {
  if (!status) return;
  try { await Api.patch(`/admin/complaints/${id}`, { status }); showToast('Complaint updated.', 'success'); loadComplaints(); }
  catch (err) { showToast(err.message, 'error'); }
}
