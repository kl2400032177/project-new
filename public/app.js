let state = {};
let registering = false;
let locations = new Map();
const $ = selector => document.querySelector(selector);

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showAuth(message = '') {
  $('#authOverlay').classList.remove('hidden');
  $('#authMessage').textContent = message;
  $('#nameField').classList.toggle('hidden', !registering);
  $('#authName').required = registering;
  $('#authTitle').textContent = registering ? 'Create your account' : 'Sign in to continue';
  $('#authSubmit').textContent = registering ? 'Create account' : 'Sign in';
  $('#authToggle').textContent = registering ? 'Already have an account? Sign in' : 'New here? Create a customer account';
}

function renderCart() {
  const items = state.cart?.items || [];
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.quantity * item.price, 0);
  $('#cartCount').textContent = count;
  $('#cartItems').innerHTML = items.length ? items.map(item => `<div class="cart-item"><div><b>${item.name}</b><small>${item.farmerName} | Rs. ${item.price} x ${item.quantity}</small></div><div><button onclick="changeCart('${item.productId}', ${item.quantity - 1})">-</button> ${item.quantity} <button onclick="changeCart('${item.productId}', ${item.quantity + 1})">+</button></div></div>`).join('') : '<p class="muted">Your basket is empty.</p>';
  $('#cartTotal').textContent = items.length ? `Items subtotal: Rs. ${subtotal}` : '';
  $('#checkoutButton').disabled = !items.length;
}

function allowedTransitions(order) {
  const permissions = { farmer: ['Accepted', 'Preparing', 'Ready for Pickup'], delivery: ['Picked Up', 'Out for Delivery', 'Delivered', 'Delivery Failed'], admin: ['Cancelled', 'Refund Pending', 'Refunded'] };
  const next = (state.lifecycle[order.status] || []).filter(status => (permissions[state.user.role] || []).includes(status));
  return next.length ? `<select onchange="changeOrder('${order.id}', this.value)"><option value="">Update</option>${next.map(status => `<option>${status}</option>`).join('')}</select>` : '';
}

function renderDashboard() {
  const isAdmin = state.user.role === 'admin';
  const isCustomer = state.user.role === 'customer';
  const active = state.orders.filter(order => !['Delivered', 'Cancelled', 'Refunded'].includes(order.status));
  $('#accountName').textContent = `${state.user.name} | ${state.user.role}`;
  $('#roleLabel').textContent = `Signed in as ${state.user.role}`;
  $('#logoutButton').classList.remove('hidden');
  $('#cartButton').classList.toggle('hidden', !isCustomer);
  $('#inventoryButton').classList.toggle('hidden', state.user.role !== 'farmer');
  $('#metrics').innerHTML = `<div class="metric"><b>${active.length}</b><span>Active fulfilments</span></div><div class="metric"><b>Rs. ${state.orders.reduce((total, order) => total + order.total, 0)}</b><span>Order value</span></div><div class="metric"><b>${state.complaints.filter(item => item.status === 'Open').length}</b><span>Open cases</span></div>`;
  $('#commission').value = state.settings.commissionRate;
  $('#delivery').value = state.settings.deliveryBase;
  $('#radius').value = state.settings.discoveryRadiusKm;
  $('#permissionNote').textContent = isAdmin ? 'Authorised' : 'Read-only';
  $('#saveSettings').disabled = !isAdmin;
  $('#resolveComplaint').disabled = !isAdmin;
  $('#orders').innerHTML = state.orders.map(order => { const farmer = state.farmers.find(item => item.id === order.farmer_id); const assign = isAdmin && ['Ready for Pickup', 'Assigned for Delivery'].includes(order.status) ? `<select onchange="assignDelivery('${order.id}', this.value)"><option value="">Assign delivery</option>${state.deliveryPartners.map(partner => `<option value="${partner.id}">${partner.name}</option>`).join('')}</select>` : ''; return `<div class="order"><div><b>${order.id} | ${order.customer}</b><small>${farmer?.name || 'Farm'} | Rs. ${order.total}</small></div><div><span class="status">${order.status}</span>${assign}${allowedTransitions(order)}</div></div>`; }).join('');
  $('#complaints').innerHTML = state.complaints.map(item => `<div class="complaint"><b>${item.subject}</b><span>${item.id} | ${item.customer} | ${item.status}</span></div>`).join('');
  $('#audit').innerHTML = isAdmin ? (state.auditLog.length ? state.auditLog.map(item => `<div class="audit-entry">${item.action.replaceAll('_', ' ')}</div>`).join('') : '<div class="audit-entry">No actions recorded.</div>') : '<div class="audit-entry">Audit history is restricted to administrators.</div>';
  if (isCustomer) renderCart();
  if (state.user.role === 'farmer') renderInventory();
}

function renderInventory() {
  const mine = state.products.filter(product => product.farmer_id === state.user.farmer_id);
  $('#inventoryItems').innerHTML = mine.length ? mine.map(product => `<div class="inventory-row"><b>${product.name}</b><br>Rs. <input id="price-${product.id}" type="number" value="${product.price}" min="0"> Stock <input id="stock-${product.id}" type="number" value="${product.stock}" min="0"><button class="text-button" onclick="saveInventory('${product.id}')">Save</button></div>`).join('') : '<p class="muted">No products yet.</p>';
}

async function loadApp() {
  try {
    state = await api('/api/dashboard');
    const [locationData, productData] = await Promise.all([api('/api/locations'), api('/api/products')]);
    locations = new Map(locationData.locations.map(item => [item.name.toLowerCase(), item]));
    $('#areaOptions').innerHTML = locationData.locations.map(item => `<option value="${item.name}"></option>`).join('');
    state.products = productData.products;
    state.cart = state.user.role === 'customer' ? await api('/api/cart') : { items: [] };
    state.deliveryPartners = state.user.role === 'admin' ? (await api('/api/delivery-partners')).partners : [];
    $('#authOverlay').classList.add('hidden');
    renderDashboard();
  } catch {
    showAuth();
  }
}

function farmerProducts(farmerId) {
  return state.products.filter(product => product.farmer_id === farmerId).map(product => `<div class="products">${product.name} | Rs. ${product.price}/${product.unit} ${state.user.role === 'customer' ? `<button class="text-button" onclick="addToCart('${product.id}')">Add</button>` : ''}</div>`).join('');
}

async function discover(lat, lng, label) {
  try {
    const result = await api(`/api/farmers/nearby?lat=${lat}&lng=${lng}&radius=${state.settings.discoveryRadiusKm}`);
    $('#locationText').textContent = `Showing farms around ${label} within ${result.radius} km`;
    $('#farmerGrid').innerHTML = result.farmers.length ? result.farmers.map(farmer => `<article class="farmer"><span class="distance">${farmer.distanceKm} km away</span><h3>${farmer.name}</h3><p>${farmer.area}</p>${farmerProducts(farmer.id)}</article>`).join('') : '<div class="empty">No farms are currently within this radius.</div>';
  } catch (error) { alert(error.message); }
}

window.addToCart = async productId => { try { await api('/api/cart', { method: 'POST', body: JSON.stringify({ productId }) }); state.cart = await api('/api/cart'); renderCart(); $('#cartPanel').classList.remove('hidden'); } catch (error) { alert(error.message); } };
window.changeCart = async (productId, quantity) => { try { await api(`/api/cart/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }); state.cart = await api('/api/cart'); renderCart(); } catch (error) { alert(error.message); } };
window.changeOrder = async (id, status) => { if (!status) return; try { await api(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadApp(); } catch (error) { alert(error.message); } };
window.assignDelivery = async (id, deliveryUserId) => { if (!deliveryUserId) return; try { await api(`/api/orders/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ deliveryUserId }) }); await loadApp(); } catch (error) { alert(error.message); } };
window.saveInventory = async productId => { try { await api(`/api/products/${productId}`, { method: 'PATCH', body: JSON.stringify({ price: +$(`#price-${productId}`).value, stock: +$(`#stock-${productId}`).value }) }); await loadApp(); } catch (error) { alert(error.message); } };

$('#authToggle').onclick = () => { registering = !registering; showAuth(); };
$('#authForm').onsubmit = async event => { event.preventDefault(); try { const data = { email: $('#authEmail').value, password: $('#authPassword').value }; if (registering) data.name = $('#authName').value; await api(registering ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: JSON.stringify(data) }); if (registering) { registering = false; showAuth('Account created. Please sign in.'); } else await loadApp(); } catch (error) { $('#authMessage').textContent = error.message; } };
$('#logoutButton').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); state = {}; $('#cartPanel').classList.add('hidden'); $('#logoutButton').classList.add('hidden'); showAuth(); };
$('#cartButton').onclick = () => $('#cartPanel').classList.toggle('hidden');
$('#closeCart').onclick = () => $('#cartPanel').classList.add('hidden');
$('#inventoryButton').onclick = () => $('#inventoryPanel').classList.toggle('hidden');
$('#closeInventory').onclick = () => $('#inventoryPanel').classList.add('hidden');
$('#productForm').onsubmit = async event => { event.preventDefault(); try { await api('/api/products', { method: 'POST', body: JSON.stringify({ name: $('#productName').value, price: +$('#productPrice').value, stock: +$('#productStock').value, unit: $('#productUnit').value }) }); event.target.reset(); await loadApp(); } catch (error) { alert(error.message); } };
$('#checkoutButton').onclick = async () => { try { const result = await api('/api/checkout', { method: 'POST', body: '{}' }); alert(`Order placed: ${result.orders.map(order => order.id).join(', ')}`); $('#cartPanel').classList.add('hidden'); await loadApp(); } catch (error) { alert(error.message); } };
$('#manualLocation').onchange = event => { const place = locations.get(event.target.value.trim().toLowerCase()); if (place) discover(place.lat, place.lng, place.name); };
$('#useLocation').onclick = () => { if (!navigator.geolocation) return alert('Location is not supported. Choose an area instead.'); navigator.geolocation.getCurrentPosition(position => discover(position.coords.latitude, position.coords.longitude, 'your location'), () => { $('#locationText').textContent = 'Location permission was denied. Choose an area instead.'; }); };
$('#saveSettings').onclick = async () => { try { await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ commissionRate: +$('#commission').value, deliveryBase: +$('#delivery').value, discoveryRadiusKm: +$('#radius').value }) }); await loadApp(); } catch (error) { alert(error.message); } };
$('#resolveComplaint').onclick = async () => { const complaint = state.complaints.find(item => item.status === 'Open'); if (!complaint) return; try { await api(`/api/complaints/${complaint.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) }); await loadApp(); } catch (error) { alert(error.message); } };
loadApp();
