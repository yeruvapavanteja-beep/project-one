/* ============================================================
   booking.js — Pre-booking + Cart + Checkout
   ============================================================ */
let cart = [];
let activePrebookCropId = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cartFab').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  document.getElementById('checkoutBtn').addEventListener('click', openCheckoutModal);
  document.getElementById('closeCheckoutModal').addEventListener('click', () => toggleModal('checkoutModal', false));
  document.getElementById('confirmCheckoutBtn').addEventListener('click', placeOrder);
  document.getElementById('closePrebookModal').addEventListener('click', () => toggleModal('prebookModal', false));
  document.getElementById('confirmPrebookBtn').addEventListener('click', confirmPrebooking);
  document.getElementById('fulfillmentType').addEventListener('change', (e) => {
    document.getElementById('addressField').style.display = e.target.value === 'delivery' ? 'block' : 'none';
  });
});

// ---------------- Pre-booking ----------------
function openPrebookModal(cropId, title) {
  if (!requireCustomerAuth()) return;
  activePrebookCropId = cropId;
  document.getElementById('prebookProductName').textContent = title;
  document.getElementById('prebookQty').value = '';
  toggleModal('prebookModal', true);
}

async function confirmPrebooking() {
  const qty = parseFloat(document.getElementById('prebookQty').value);
  if (!qty || qty <= 0) return showToast('Enter a valid quantity.', 'error');
  try {
    await Api.post('/prebookings', { cropId: activePrebookCropId, quantityKg: qty });
    showToast('Pre-booking request confirmed.', 'success');
    toggleModal('prebookModal', false);
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- Cart ----------------
function addToCart(productId, title, price, maxQty) {
  if (!requireCustomerAuth()) return;
  const existing = cart.find(i => i.productId === productId);
  if (existing) {
    if (existing.qty + 1 > maxQty) return showToast(`Only ${maxQty}kg available.`, 'error');
    existing.qty += 1;
  } else {
    cart.push({ productId, title, price, qty: 1, maxQty });
  }
  renderCart();
  showToast(`${title} added to cart.`, 'success');
}

function renderCart() {
  document.getElementById('cartCount').textContent = cart.reduce((s, i) => s + i.qty, 0);
  const body = document.getElementById('cartBody');
  if (!cart.length) {
    body.innerHTML = '<p class="empty-state">Your cart is empty.</p>';
    document.getElementById('cartTotal').textContent = '₹0';
    return;
  }
  body.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div>${item.title}<br><span style="color:var(--color-ink-soft);font-size:0.8rem;">₹${item.price}/kg</span></div>
      <div class="flex gap-sm" style="align-items:center;">
        <button onclick="changeCartQty(${idx}, -1)">−</button>
        <span class="data">${item.qty}kg</span>
        <button onclick="changeCartQty(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  document.getElementById('cartTotal').textContent = `₹${total.toFixed(2)}`;
}

function changeCartQty(idx, delta) {
  const item = cart[idx];
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart.splice(idx, 1); }
  else if (newQty > item.maxQty) { showToast(`Only ${item.maxQty}kg available.`, 'error'); return; }
  else { item.qty = newQty; }
  renderCart();
}

function openCart() { document.getElementById('cartDrawer').classList.add('open'); document.getElementById('cartOverlay').classList.add('open'); }
function closeCart() { document.getElementById('cartDrawer').classList.remove('open'); document.getElementById('cartOverlay').classList.remove('open'); }

function openCheckoutModal() {
  if (!cart.length) return showToast('Your cart is empty.', 'error');
  if (!requireCustomerAuth()) return;
  toggleModal('checkoutModal', true);
}

async function placeOrder() {
  const fulfillmentType = document.getElementById('fulfillmentType').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value;
  const items = cart.map(i => ({ productId: i.productId, quantityKg: i.qty }));
  try {
    const result = await Api.post('/orders', { items, fulfillmentType, deliveryAddress });
    showToast(`Order ${result.order.order_number} placed successfully!`, 'success');
    cart = [];
    renderCart();
    closeCart();
    toggleModal('checkoutModal', false);
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleModal(id, open) {
  document.getElementById(id).classList.toggle('open', open);
}

function requireCustomerAuth() {
  const user = Api.getUser();
  if (!user || !Api.getToken()) {
    showToast('Please log in as a customer to continue.', 'info');
    setTimeout(() => window.location.href = 'login.html', 1200);
    return false;
  }
  if (user.role !== 'customer') {
    showToast('Only customer accounts can pre-book or purchase produce.', 'error');
    return false;
  }
  return true;
}
