// API helper with JWT
const API_BASE = '';

async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401) {
      // session expired
      localStorage.clear();
      window.location.href = 'login.html';
      throw new Error('Session expired');
    }
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};

// ---------- Toast ----------
function toast(msg, type = 'success') {
  const wrap = document.getElementById('toastWrap') || (() => {
    const w = document.createElement('div');
    w.className = 'toast-wrap'; w.id = 'toastWrap';
    document.body.appendChild(w); return w;
  })();
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icons = { success: '✓', error: '✕', warning: '⚠' };
  el.innerHTML = `<span class="icon">${icons[type] || '•'}</span><span class="msg">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 250); }, 3000);
}

// ---------- Confirm dialog ----------
function confirmDialog(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header"><div class="modal-title">Please confirm</div></div>
      <div class="modal-body"><p style="color:var(--text-muted)">${message}</p></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cCancel">Cancel</button>
        <button class="btn btn-danger" id="cOk">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cCancel').onclick = () => overlay.remove();
  overlay.querySelector('#cOk').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ---------- Modal ----------
function openModal(title, bodyHtml, footerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="icon-btn" id="mClose">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${footerHtml || ''}</div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#mClose').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  return { overlay, close };
}

// ---------- Auth guard ----------
function requireAuth(role) {
  const token = localStorage.getItem('token');
  const r = localStorage.getItem('role');
  if (!token) { window.location.href = 'login.html'; return false; }
  if (role && r !== role) { window.location.href = r === 'ADMIN' ? 'admin.html' : 'farmer.html'; return false; }
  return true;
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// ---------- Helpers ----------
function fmtMoney(n) { return '₹' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtNum(n, d = 1) { return (Math.round((n || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtDate(d) { return d; }
function sessionBadge(s) {
  return s === 'Morning' ? '<span class="badge badge-morning"><span class="badge-dot-sm"></span>Morning</span>'
    : '<span class="badge badge-evening"><span class="badge-dot-sm"></span>Evening</span>';
}
function statusBadge(s) {
  const map = { 'Paid': 'badge-paid', 'Pending': 'badge-pending', 'Partially Paid': 'badge-partial', 'Recorded': 'badge-recorded' };
  return `<span class="badge ${map[s] || 'badge-pending'}"><span class="badge-dot-sm"></span>${s}</span>`;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
