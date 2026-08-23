/* ============================================================
   marketplace.js — Product browsing & filtering
   ============================================================ */
let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
  const user = Api.getUser();
  if (user) {
    document.getElementById('navActions').innerHTML = `
      <a href="${user.role}-dashboard.html" class="btn btn-outline">My Dashboard</a>
      <button class="btn btn-primary" onclick="logout()">Logout</button>
    `;
  }

  loadProducts();

  document.getElementById('filterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    loadProducts();
  });
});

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<p class="empty-state">Loading fresh produce...</p>';

  const fd = new FormData(document.getElementById('filterForm'));
  const params = new URLSearchParams();
  ['cropName', 'district', 'category', 'minPrice', 'maxPrice'].forEach(k => {
    const v = fd.get(k);
    if (v) params.set(k, v);
  });
  if (fd.get('upcomingOnly')) params.set('upcomingOnly', 'true');

  try {
    allProducts = await Api.get(`/marketplace/products?${params.toString()}`);
    renderProducts(allProducts);
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">Could not load products: ${err.message}</p>`;
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products.length) {
    grid.innerHTML = '<p class="empty-state">No produce matches your filters right now. Try widening your search.</p>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <div class="card product-card">
      <div class="product-image">${p.cover_image ? `<img src="${apiOrigin()}${p.cover_image}" alt="${p.crop_name}">` : '🥬'}</div>
      <div class="product-body">
        <div class="p-name">${p.title}</div>
        <div class="p-farmer">by ${p.farmer_name} · ${p.district || p.farm_location || 'Location N/A'}</div>
        <div class="product-meta-row">
          <span class="product-price">₹${p.price_per_kg}/kg</span>
          <span class="badge ${p.is_upcoming ? 'badge-medium' : 'badge-good'}">${p.is_upcoming ? 'Upcoming' : 'Available'}</span>
        </div>
        <div class="product-meta-row" style="color:var(--color-ink-soft);">
          <span>Available: ${p.available_quantity_kg}kg</span>
          <span>${p.expected_harvest_date ? formatDate(p.expected_harvest_date) : ''}</span>
        </div>
        <div class="product-actions">
          ${p.is_upcoming
            ? `<button class="btn btn-primary btn-sm btn-block" onclick="openPrebookModal(${p.crop_id}, '${escapeHtml(p.title)}')">Pre-Book</button>`
            : `<button class="btn btn-primary btn-sm btn-block" onclick="addToCart(${p.id}, '${escapeHtml(p.title)}', ${p.price_per_kg}, ${p.available_quantity_kg})">Buy Now</button>`}
          <a href="crop-details.html?id=${p.crop_id}" class="btn btn-outline btn-sm">View</a>
        </div>
      </div>
    </div>
  `).join('');
}

function apiOrigin() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
}
function escapeHtml(str) { return String(str).replace(/'/g, "\\'"); }
function formatDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
