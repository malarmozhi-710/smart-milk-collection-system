if (!requireAuth('FARMER')) throw new Error('auth');

const farmerId = localStorage.getItem('farmer_id');
let farmerChart = null;

// nav
// nav
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {

    document.querySelectorAll('.nav-item')
      .forEach(n => n.classList.remove('active'));

    item.classList.add('active');

    const p = item.dataset.page;

    document.querySelectorAll('.page')
      .forEach(pg => pg.classList.remove('active'));

    document.getElementById('page-' + p).classList.add('active');

    document.getElementById('topbarTitle').textContent =
      item.textContent.trim();

    // Load the selected page
    if (p === 'dashboard') loadFarmerDashboard();
    if (p === 'profile') loadProfile();
    if (p === 'history') loadHistory();
    if (p === 'payments') loadPayments();
  });
});

async function loadFarmerDashboard() {
  try {
    const d = await api.get(`/api/farmer/${farmerId}/dashboard`);
    document.getElementById('welcomeMsg').textContent = `Welcome, ${d.farmer.name.split(' ')[0]} 👋`;
    document.getElementById('welcomeSub').textContent = `Farmer ID: ${d.farmer.farmer_id} • ${d.farmer.village || ''}`;
    document.getElementById('userName').textContent = d.farmer.name;
    document.getElementById('userAvatar').textContent = d.farmer.name.charAt(0).toUpperCase();

    const todayAmt = d.todayCol.reduce((s, c) => s + c.amount, 0);
    const todayQty = d.todayCol.reduce((s, c) => s + c.quantity, 0);
    document.getElementById('farmerKpis').innerHTML = `
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Today's Quantity</div><div class="kpi-icon amber">🥛</div></div><div class="kpi-value">${fmtNum(todayQty)} L</div><div class="kpi-foot">${d.todayCol.length} entries today</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Today's Amount</div><div class="kpi-icon green">💰</div></div><div class="kpi-value">${fmtMoney(todayAmt)}</div><div class="kpi-foot">Earned today</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Monthly Quantity</div><div class="kpi-icon teal">📊</div></div><div class="kpi-value">${fmtNum(d.monthly.qty)} L</div><div class="kpi-foot">This month total</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Monthly Earnings</div><div class="kpi-icon blue">💵</div></div><div class="kpi-value">${fmtMoney(d.monthly.amt)}</div><div class="kpi-foot">This month</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Average Fat %</div><div class="kpi-icon teal">🧪</div></div><div class="kpi-value">${fmtNum(d.monthly.fat)}%</div><div class="kpi-foot">This month average</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Avg Rate / L</div><div class="kpi-icon amber">🏷️</div></div><div class="kpi-value">${fmtMoney((d.monthly.fat || 0) * 8)}</div><div class="kpi-foot">Based on avg fat</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Total Entries</div><div class="kpi-icon lime">📋</div></div><div class="kpi-value">${d.history.length}</div><div class="kpi-foot">Recent records</div></div>
      <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Member Since</div><div class="kpi-icon red">📅</div></div><div class="kpi-value" style="font-size:18px">${d.farmer.registration_date}</div><div class="kpi-foot">Registration date</div></div>
    `;

    // today table
    const tb = document.getElementById('todayBody');
    if (!d.todayCol.length) tb.innerHTML = `<tr><td colspan="6" class="table-empty"><div class="icon">🥛</div>No collection recorded today</td></tr>`;
    else tb.innerHTML = d.todayCol.map(c => `<tr><td>${c.date}</td><td>${sessionBadge(c.session)}</td><td>${fmtNum(c.quantity)} L</td><td>${fmtNum(c.fat_percent)}%</td><td>${fmtMoney(c.rate)}</td><td><strong>${fmtMoney(c.amount)}</strong></td></tr>`).join('');

    // chart
    if (farmerChart) farmerChart.destroy();
    farmerChart = new Chart(document.getElementById('farmerChart'), {
      type: 'bar',
      data: {
        labels: d.monthlyChart.map(m => m.m),
        datasets: [{ label: 'Earnings ₹', data: d.monthlyChart.map(m => Math.round(m.amt)), backgroundColor: '#0f766e', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  } catch (e) { toast(e.message, 'error'); }
}

async function loadProfile() {
  try {
    const f = await api.get(`/api/farmers/${farmerId}`);
    document.getElementById('profileCard').innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div class="user-avatar" style="width:64px;height:64px;font-size:26px">${f.name.charAt(0).toUpperCase()}</div>
        <div><div style="font-size:20px;font-weight:800">${escapeHtml(f.name)}</div><div style="color:var(--text-muted)">Farmer ID: <strong>${escapeHtml(f.farmer_id)}</strong></div></div>
      </div>
      <div class="hero-card-row"><span>Phone</span><span>${escapeHtml(f.phone || '-')}</span></div>
      <div class="hero-card-row"><span>Village</span><span>${escapeHtml(f.village || '-')}</span></div>
      <div class="hero-card-row"><span>Address</span><span>${escapeHtml(f.address || '-')}</span></div>
      <div class="hero-card-row"><span>Bank / Payment</span><span>${escapeHtml(f.bank_details || '-')}</span></div>
      <div class="hero-card-row"><span>Registered on</span><span>${f.registration_date}</span></div>
    `;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadHistory() {
  try {
    const rows = await api.get(`/api/farmer/${farmerId}/collections`);
    const body = document.getElementById('historyBody');
    if (!rows.length) body.innerHTML = `<tr><td colspan="6" class="table-empty"><div class="icon">📋</div>No collection history</td></tr>`;
    else body.innerHTML = rows.map(c => `<tr><td>${c.date}</td><td>${sessionBadge(c.session)}</td><td>${fmtNum(c.quantity)} L</td><td>${fmtNum(c.fat_percent)}%</td><td>${fmtMoney(c.rate)}</td><td><strong>${fmtMoney(c.amount)}</strong></td></tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadPayments() {
  try {
    const rows = await api.get(`/api/farmer/${farmerId}/payments`);
    const body = document.getElementById('payBody');
    if (!rows.length) body.innerHTML = `<tr><td colspan="5" class="table-empty"><div class="icon">💰</div>No payment records</td></tr>`;
    else body.innerHTML = rows.map(p => `<tr><td>${fmtMoney(p.total_amount)}</td><td>${fmtMoney(p.paid_amount)}</td><td>${fmtMoney(p.pending_amount)}</td><td>${statusBadge(p.status)}</td><td>${p.payment_date || '-'}</td></tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

loadFarmerDashboard();
