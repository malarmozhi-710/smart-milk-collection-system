if (!requireAuth('ADMIN')) throw new Error('auth');

// user chip
document.getElementById('userName').textContent = localStorage.getItem('username') || 'admin';
document.getElementById('userAvatar').textContent = (localStorage.getItem('username') || 'A').charAt(0).toUpperCase();

// ---------- Navigation ----------
const navItems = document.querySelectorAll('.nav-item');
const pageTitles = { dashboard: 'Dashboard', collection: 'Milk Collection', farmers: 'Farmers', payments: 'Payments', reports: 'Reports', settings: 'Settings' };
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const p = item.dataset.page;
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.getElementById('page-' + p).classList.add('active');
    document.getElementById('topbarTitle').textContent = pageTitles[p];
    document.getElementById('sidebar').classList.remove('open');
    if (p === 'dashboard') loadDashboard();
    if (p === 'collection') loadCollections();
    if (p === 'farmers') loadFarmers();
    if (p === 'payments') loadPayments();
    if (p === 'settings') loadSettings();
  });
});

// ---------- Notifications ----------
const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifPanel.classList.toggle('show'); loadNotifications(); });
document.addEventListener('click', (e) => { if (!notifPanel.contains(e.target) && e.target !== notifBtn) notifPanel.classList.remove('show'); });
document.getElementById('notifRead').addEventListener('click', async () => {
  try { await api.post('/api/notifications/read', {}); document.getElementById('notifDot').style.display = 'none'; loadNotifications(); } catch (e) {}
});

async function loadNotifications() {
  try {
    const list = await api.get('/api/notifications');
    const el = document.getElementById('notifList');
    if (!list.length) { el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No notifications</div>'; return; }
    const icons = { collection: 'collection', payment: 'payment', system: 'system' };
    el.innerHTML = list.map(n => `
      <div class="notif-item">
        <div class="ic ${icons[n.type] || 'system'}">${n.type === 'collection' ? '🥛' : n.type === 'payment' ? '💰' : '⚙️'}</div>
        <div><div class="t">${escapeHtml(n.message)}</div><div class="d">${n.created_at}</div></div>
      </div>`).join('');
    const unread = list.some(n => !n.read);
    document.getElementById('notifDot').style.display = unread ? 'block' : 'none';
  } catch (e) {}
}

// ---------- Dashboard ----------
let charts = {};
function destroyCharts() { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; }

async function loadDashboard() {
  try {
    const d = await api.get('/api/dashboard');
    const k = d.kpis;
    document.getElementById('kpiGrid').innerHTML = `
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Total Farmers</div><div class="kpi-icon teal">👥</div></div><div class="kpi-value">${k.totalFarmers}</div><div class="kpi-foot">Registered farmers</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Today's Collection</div><div class="kpi-icon amber">🥛</div></div><div class="kpi-value">${fmtNum(k.todayQuantity)} L</div><div class="kpi-foot">Total litres today</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Today's Amount</div><div class="kpi-icon green">💰</div></div><div class="kpi-value">${fmtMoney(k.todayAmount)}</div><div class="kpi-foot">Total payable today</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Morning Collection</div><div class="kpi-icon blue">🌅</div></div><div class="kpi-value">${fmtNum(k.morningQuantity)} L</div><div class="kpi-foot">Morning session</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Evening Collection</div><div class="kpi-icon lime">🌆</div></div><div class="kpi-value">${fmtNum(k.eveningQuantity)} L</div><div class="kpi-foot">Evening session</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Average Fat %</div><div class="kpi-icon teal">🧪</div></div><div class="kpi-value">${fmtNum(k.avgFat)}%</div><div class="kpi-foot">Today's average</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Pending Payments</div><div class="kpi-icon red">⏳</div></div><div class="kpi-value">${fmtMoney(k.pendingPayments)}</div><div class="kpi-foot">Outstanding amount</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Avg Rate / L</div><div class="kpi-icon amber">🏷️</div></div><div class="kpi-value">${fmtMoney((k.avgFat || 0) * 8)}</div><div class="kpi-foot">Based on avg fat</div></div>
    `;
    destroyCharts();
    // trend
    charts.trend = new Chart(document.getElementById('chartTrend'), {
      type: 'line',
      data: {
        labels: d.trend.map(t => t.date.slice(5)),
        datasets: [{ label: 'Litres', data: d.trend.map(t => Math.round(t.qty * 10) / 10), borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,0.1)', fill: true, tension: 0.35, pointRadius: 3 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    // morning vs evening
    const meData = { Morning: 0, Evening: 0 };
    d.morningEvening.forEach(m => meData[m.session] = m.qty);
    charts.me = new Chart(document.getElementById('chartME'), {
      type: 'doughnut',
      data: { labels: ['Morning', 'Evening'], datasets: [{ data: [meData.Morning, meData.Evening], backgroundColor: ['#f59e0b', '#6366f1'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });
    // farmer-wise
    charts.farmer = new Chart(document.getElementById('chartFarmer'), {
      type: 'bar',
      data: { labels: d.farmerWise.map(f => f.farmer_name.split(' ')[0]), datasets: [{ label: 'Litres', data: d.farmerWise.map(f => Math.round(f.qty * 10) / 10), backgroundColor: '#14b8a6', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    // monthly
    charts.monthly = new Chart(document.getElementById('chartMonthly'), {
      type: 'bar',
      data: { labels: d.monthlyPay.map(m => m.m), datasets: [{ label: 'Amount ₹', data: d.monthlyPay.map(m => Math.round(m.amt)), backgroundColor: '#0f766e', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  } catch (e) { toast(e.message, 'error'); }
}

// ---------- Collections ----------
let colPage = 1;
const colPerPage = 10;

async function loadCollections() {
  const search = document.getElementById('colSearch').value.trim();
  const session = document.getElementById('colFilterSession').value;
  const date = document.getElementById('colFilterDate').value;
  const sort = document.getElementById('colSort').value;
  let q = `/api/collections?limit=${colPerPage}&offset=${(colPage - 1) * colPerPage}&order=desc&sort=${sort}`;
  if (search) q += `&search=${encodeURIComponent(search)}`;
  if (session) q += `&session=${session}`;
  if (date) q += `&date=${date}`;
  try {
    const rows = await api.get(q);
    const body = document.getElementById('colBody');
    if (!rows.length) { body.innerHTML = `<tr><td colspan="11" class="table-empty"><div class="icon">🥛</div>No collection records found</td></tr>`; }
    else {
      body.innerHTML = rows.map(c => `<tr>
        <td>#${c.entry_id}</td><td><strong>${escapeHtml(c.farmer_id)}</strong></td><td>${escapeHtml(c.farmer_name)}</td>
        <td>${c.date}</td><td>${sessionBadge(c.session)}</td>
        <td>${fmtNum(c.quantity)}</td><td>${fmtNum(c.fat_percent)}%</td><td>${fmtMoney(c.rate)}</td><td><strong>${fmtMoney(c.amount)}</strong></td>
        <td>${statusBadge(c.status)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openCollectionModal(${c.entry_id})">✏️</button> <button class="btn btn-ghost btn-sm" onclick="deleteCollection(${c.entry_id})">🗑️</button></td>
      </tr>`).join('');
    }
    renderColPagination(rows.length);
  } catch (e) { toast(e.message, 'error'); }
}

function renderColPagination(count) {
  const el = document.getElementById('colPagination');
  const hasPrev = colPage > 1;
  const hasNext = count === colPerPage;
  el.innerHTML = `<div>Page ${colPage}</div>
    <div class="page-btns">
      <button class="page-btn" ${hasPrev ? '' : 'disabled'} onclick="colPage--;loadCollections()">‹</button>
      <button class="page-btn active">${colPage}</button>
      <button class="page-btn" ${hasNext ? '' : 'disabled'} onclick="colPage++;loadCollections()">›</button>
    </div>`;
}

function clearColFilters() {
  document.getElementById('colSearch').value = '';
  document.getElementById('colFilterSession').value = '';
  document.getElementById('colFilterDate').value = '';
  colPage = 1; loadCollections();
}

async function openCollectionModal(entryId) {
  let c = null;
  if (entryId) {
    c = await api.get(`/api/collections/${entryId}`);
  }
  // load farmers for select
  const farmers = await api.get('/api/farmers');
  const today = new Date().toISOString().slice(0, 10);
  const body = `
    <div class="form-grid">
      <div class="full">
        <label class="form-label">Farmer *</label>
        <select class="form-control" id="cFarmer" ${entryId ? 'disabled' : ''}>
          ${farmers.map(f => `<option value="${f.farmer_id}" ${c && c.farmer_id === f.farmer_id ? 'selected' : ''}>${f.farmer_id} — ${escapeHtml(f.name)} (${escapeHtml(f.village || '')})</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">Date *</label>
        <input type="date" class="form-control" id="cDate" value="${c ? c.date : today}">
      </div>
      <div>
        <label class="form-label">Session *</label>
        <select class="form-control" id="cSession">
          <option value="Morning" ${c && c.session === 'Morning' ? 'selected' : ''}>Morning</option>
          <option value="Evening" ${c && c.session === 'Evening' ? 'selected' : ''}>Evening</option>
        </select>
      </div>
      <div>
        <label class="form-label">Quantity (Litres) *</label>
        <input type="number" step="0.1" class="form-control" id="cQuantity" value="${c ? c.quantity : ''}" placeholder="e.g. 10">
      </div>
      <div>
        <label class="form-label">Fat % (Analyzer)</label>
        <input type="number" step="0.1" class="form-control" id="cFat" value="${c ? c.fat_percent : ''}" placeholder="Auto-simulated if blank">
      </div>
      <div class="full">
        <div class="analyzer-box">
          <div class="analyzer-row">
            <div class="analyzer-display">
              <span class="label">Milk Analyzer</span>
              <span id="analyzerReading">${c ? fmtNum(c.fat_percent) + '%' : '— — —'}</span>
            </div>
            <button class="btn btn-secondary" type="button" onclick="runAnalyzer()">🧪 Run Analyzer</button>
            <span class="analyzer-tag">SIMULATED</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Simulated analyzer generates fat between 3.0%–5.5%. A real device can POST to <code>/api/analyzer/reading</code>.</div>
        </div>
      </div>
    </div>`;
  const footer = `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    <button class="btn btn-primary" onclick="saveCollection(${entryId || 'null'})">${entryId ? 'Update' : 'Save'} Collection</button>`;
  const m = openModal(entryId ? 'Edit Collection' : 'Add Milk Collection', body, footer);
  m.overlay.dataset.modalId = 'collection';
}

async function runAnalyzer() {
  try {
    const r = await api.post('/api/analyzer/reading', {});
    document.getElementById('analyzerReading').textContent = fmtNum(r.fat_percent) + '%';
    document.getElementById('cFat').value = r.fat_percent;
    toast(`Analyzer reading: ${fmtNum(r.fat_percent)}% → Rate ${fmtMoney(r.rate)}/L`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function saveCollection(entryId) {
  const farmer_id = document.getElementById('cFarmer').value;
  const date = document.getElementById('cDate').value;
  const session = document.getElementById('cSession').value;
  const quantity = parseFloat(document.getElementById('cQuantity').value);
  const fat = document.getElementById('cFat').value;
  if (!farmer_id || !date || !session || !quantity) { toast('Farmer, date, session and quantity are required', 'warning'); return; }
  const payload = { farmer_id, date, session, quantity };
  if (fat) payload.fat_percent = parseFloat(fat);
  try {
    if (entryId) { await api.put(`/api/collections/${entryId}`, payload); toast('Collection updated', 'success'); }
    else { await api.post('/api/collections', payload); toast('Collection recorded — analyzer reading applied', 'success'); }
    document.querySelector('.modal-overlay').remove();
    loadCollections();
  } catch (e) { toast(e.message, 'error'); }
}

function deleteCollection(id) {
  confirmDialog('Delete this collection record?', async () => {
    try { await api.del(`/api/collections/${id}`); toast('Collection deleted', 'success'); loadCollections(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Farmers ----------
async function loadFarmers() {
  const search = document.getElementById('farmerSearch').value.trim();
  const village = document.getElementById('farmerVillage').value;
  let q = '/api/farmers?';
  if (search) q += `search=${encodeURIComponent(search)}&`;
  if (village) q += `village=${encodeURIComponent(village)}&`;
  try {
    const rows = await api.get(q);
    const body = document.getElementById('farmerBody');
    if (!rows.length) body.innerHTML = `<tr><td colspan="8" class="table-empty"><div class="icon">👥</div>No farmers found</td></tr>`;
    else body.innerHTML = rows.map(f => `<tr>
      <td><strong>${escapeHtml(f.farmer_id)}</strong></td><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.phone || '-')}</td>
      <td>${escapeHtml(f.village || '-')}</td><td>${escapeHtml(f.address || '-')}</td><td>${escapeHtml(f.bank_details || '-')}</td>
      <td>${f.registration_date}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="openFarmerModal('${f.farmer_id}')">✏️</button> <button class="btn btn-ghost btn-sm" onclick="deleteFarmer('${f.farmer_id}')">🗑️</button></td>
    </tr>`).join('');
    // villages
    if (!document.getElementById('farmerVillage').dataset.loaded) {
      const villages = await api.get('/api/villages');
      document.getElementById('farmerVillage').innerHTML = '<option value="">All Villages</option>' + villages.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      document.getElementById('farmerVillage').dataset.loaded = '1';
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function openFarmerModal(id) {
  let f = null;
  if (id) f = await api.get(`/api/farmers/${id}`);
  const nextId = id ? id : 'M' + String(Date.now()).slice(-3);
  const body = `
    <div class="form-grid">
      <div><label class="form-label">Farmer ID *</label><input type="text" class="form-control" id="fId" value="${f ? f.farmer_id : nextId}" ${f ? 'disabled' : ''}></div>
      <div><label class="form-label">Full Name *</label><input type="text" class="form-control" id="fName" value="${f ? escapeHtml(f.name) : ''}"></div>
      <div><label class="form-label">Phone</label><input type="text" class="form-control" id="fPhone" value="${f ? escapeHtml(f.phone || '') : ''}"></div>
      <div><label class="form-label">Village</label><input type="text" class="form-control" id="fVillage" value="${f ? escapeHtml(f.village || '') : ''}"></div>
      <div class="full"><label class="form-label">Address</label><input type="text" class="form-control" id="fAddress" value="${f ? escapeHtml(f.address || '') : ''}"></div>
      <div class="full"><label class="form-label">Bank / Payment Details</label><input type="text" class="form-control" id="fBank" value="${f ? escapeHtml(f.bank_details || '') : ''}"></div>
    </div>
    ${!f ? '<div style="font-size:13px;color:var(--text-muted);margin-top:12px">A farmer login is auto-created with default password <b>farmer123</b>.</div>' : ''}`;
  const footer = `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    <button class="btn btn-primary" onclick="saveFarmer('${id || ''}')">${id ? 'Update' : 'Register'} Farmer</button>`;
  openModal(id ? 'Edit Farmer' : 'Register Farmer', body, footer);
}

async function saveFarmer(id) {
  const payload = {
    farmer_id: document.getElementById('fId').value.trim(),
    name: document.getElementById('fName').value.trim(),
    phone: document.getElementById('fPhone').value.trim(),
    village: document.getElementById('fVillage').value.trim(),
    address: document.getElementById('fAddress').value.trim(),
    bank_details: document.getElementById('fBank').value.trim(),
  };
  if (!payload.farmer_id || !payload.name) { toast('Farmer ID and name are required', 'warning'); return; }
  try {
    if (id) { await api.put(`/api/farmers/${id}`, payload); toast('Farmer updated', 'success'); }
    else { await api.post('/api/farmers', payload); toast('Farmer registered — login created (password: farmer123)', 'success'); }
    document.querySelector('.modal-overlay').remove();
    loadFarmers();
  } catch (e) { toast(e.message, 'error'); }
}

function deleteFarmer(id) {
  confirmDialog(`Delete farmer ${id} and all related records?`, async () => {
    try { await api.del(`/api/farmers/${id}`); toast('Farmer deleted', 'success'); loadFarmers(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Payments ----------
async function loadPayments() {
  const status = document.getElementById('payFilterStatus').value;
  let q = '/api/payments?';
  if (status) q += `status=${status}&`;
  try {
    const rows = await api.get(q);
    const body = document.getElementById('payBody');
    if (!rows.length) body.innerHTML = `<tr><td colspan="9" class="table-empty"><div class="icon">💰</div>No payments found</td></tr>`;
    else body.innerHTML = rows.map(p => `<tr>
      <td><strong>${escapeHtml(p.farmer_id)}</strong></td><td>${escapeHtml(p.farmer_name)}</td><td>${escapeHtml(p.village || '-')}</td>
      <td>${fmtMoney(p.total_amount)}</td><td>${fmtMoney(p.paid_amount)}</td><td><strong style="color:var(--error)">${fmtMoney(p.pending_amount)}</strong></td>
      <td>${statusBadge(p.status)}</td><td>${p.payment_date || '-'}</td>
      <td><button class="btn btn-primary btn-sm" onclick="openPaymentModal('${p.farmer_id}','${escapeHtml(p.farmer_name)}',${p.pending_amount})">+ Record Payment</button></td>
    </tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

function openPaymentModal(farmerId, name, pending) {
  const today = new Date().toISOString().slice(0, 10);
  const body = `
    <div class="form-group"><label class="form-label">Farmer</label><input class="form-control" value="${escapeHtml(farmerId)} — ${escapeHtml(name)}" disabled></div>
    <div class="form-group"><label class="form-label">Pending Amount</label><input class="form-control" value="${fmtMoney(pending)}" disabled></div>
    <div class="form-group"><label class="form-label">Payment Amount (₹) *</label><input type="number" step="0.01" class="form-control" id="payAmount" value="${pending}"></div>
    <div class="form-group"><label class="form-label">Payment Date</label><input type="date" class="form-control" id="payDate" value="${today}"></div>`;
  const footer = `<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
    <button class="btn btn-primary" onclick="savePayment('${farmerId}')">Record Payment</button>`;
  openModal('Record Payment', body, footer);
}

async function savePayment(farmerId) {
  const paid = parseFloat(document.getElementById('payAmount').value);
  const date = document.getElementById('payDate').value;
  if (isNaN(paid) || paid <= 0) { toast('Enter a valid amount', 'warning'); return; }
  try {
    await api.post('/api/payments', { farmer_id: farmerId, paid_amount: paid, payment_date: date });
    toast('Payment recorded', 'success');
    document.querySelector('.modal-overlay').remove();
    loadPayments();
  } catch (e) { toast(e.message, 'error'); }
}

// ---------- Reports ----------
let currentReport = null;
async function loadReport(type) {
  currentReport = type;
  document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('btn-primary'));
  document.querySelector(`[data-report="${type}"]`).classList.add('btn-primary');
  const titles = { daily: 'Daily Collection Report', weekly: 'Weekly Collection Report', monthly: 'Monthly Collection Report', 'farmer-wise': 'Farmer-wise Report', payment: 'Payment Report', quality: 'Milk Quality Report' };
  document.getElementById('reportTitle').textContent = titles[type];
  try {
    const r = await api.get(`/api/reports/${type}`);
    document.getElementById('reportRange').textContent = r.from ? `${r.from} to ${r.to}` : '';
    const head = document.getElementById('reportHead');
    const body = document.getElementById('reportBody');
    const rows = r.rows || [];
    if (type === 'farmer-wise') {
      head.innerHTML = '<tr><th>Farmer ID</th><th>Name</th><th>Entries</th><th>Qty (L)</th><th>Avg Fat</th><th>Amount</th></tr>';
      body.innerHTML = rows.map(x => `<tr><td><strong>${escapeHtml(x.farmer_id)}</strong></td><td>${escapeHtml(x.farmer_name)}</td><td>${x.entries}</td><td>${fmtNum(x.qty)}</td><td>${fmtNum(x.avg_fat)}%</td><td>${fmtMoney(x.amt)}</td></tr>`).join('');
    } else if (type === 'payment') {
      head.innerHTML = '<tr><th>Farmer ID</th><th>Name</th><th>Village</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th><th>Date</th></tr>';
      body.innerHTML = rows.map(x => `<tr><td><strong>${escapeHtml(x.farmer_id)}</strong></td><td>${escapeHtml(x.farmer_name)}</td><td>${escapeHtml(x.village||'-')}</td><td>${fmtMoney(x.total_amount)}</td><td>${fmtMoney(x.paid_amount)}</td><td>${fmtMoney(x.pending_amount)}</td><td>${statusBadge(x.status)}</td><td>${x.payment_date||'-'}</td></tr>`).join('');
    } else if (type === 'quality') {
      head.innerHTML = '<tr><th>Farmer ID</th><th>Name</th><th>Avg Fat</th><th>Min Fat</th><th>Max Fat</th></tr>';
      body.innerHTML = rows.map(x => `<tr><td><strong>${escapeHtml(x.farmer_id)}</strong></td><td>${escapeHtml(x.farmer_name)}</td><td>${fmtNum(x.avg_fat)}%</td><td>${fmtNum(x.min_fat)}%</td><td>${fmtNum(x.max_fat)}%</td></tr>`).join('');
    } else {
      head.innerHTML = '<tr><th>Entry</th><th>Farmer ID</th><th>Name</th><th>Date</th><th>Session</th><th>Qty</th><th>Fat</th><th>Rate</th><th>Amount</th><th>Status</th></tr>';
      body.innerHTML = rows.map(c => `<tr><td>#${c.entry_id}</td><td>${escapeHtml(c.farmer_id)}</td><td>${escapeHtml(c.farmer_name)}</td><td>${c.date}</td><td>${sessionBadge(c.session)}</td><td>${fmtNum(c.quantity)}</td><td>${fmtNum(c.fat_percent)}%</td><td>${fmtMoney(c.rate)}</td><td>${fmtMoney(c.amount)}</td><td>${statusBadge(c.status)}</td></tr>`).join('');
    }
    if (!rows.length) body.innerHTML = `<tr><td colspan="10" class="table-empty">No records</td></tr>`;
  } catch (e) { toast(e.message, 'error'); }
}

function printReport() { window.print(); }
function exportCSV() {
  if (!currentReport) { toast('Select a report first', 'warning'); return; }
  const token = localStorage.getItem('token');
  fetch(`/api/reports/export?type=${currentReport}`, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${currentReport}-report.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('CSV export ready', 'success');
    })
    .catch(() => toast('Export failed', 'error'));
}

// ---------- Settings ----------
async function loadSettings() {
  try {
    const s = await api.get('/api/settings');
    document.getElementById('setMultiplier').value = s.rate_multiplier;
    document.getElementById('setBase').value = s.rate_base;
    document.getElementById('setAnalyzer').value = s.analyzer_mode;
  } catch (e) { toast(e.message, 'error'); }
}
async function saveSettings() {
  try {
    await api.put('/api/settings', {
      rate_multiplier: parseFloat(document.getElementById('setMultiplier').value),
      rate_base: parseFloat(document.getElementById('setBase').value),
      analyzer_mode: document.getElementById('setAnalyzer').value,
    });
    toast('Settings saved', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ---------- Global search ----------
document.getElementById('globalSearch').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const v = e.target.value.trim();
    if (!v) return;
    navItems[1].click(); // collection page
    document.getElementById('colSearch').value = v;
    loadCollections();
  }
});

// init
loadDashboard();
loadNotifications();
