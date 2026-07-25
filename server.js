const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'sih-milk-dairy-secret-2026-change-in-prod';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Database setup ----------
const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(path.join(DB_DIR, 'milk.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','FARMER')),
  farmer_id TEXT
);

CREATE TABLE IF NOT EXISTS farmers (
  farmer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  village TEXT,
  address TEXT,
  bank_details TEXT,
  registration_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milk_collection (
  entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  date TEXT NOT NULL,
  session TEXT NOT NULL CHECK(session IN ('Morning','Evening')),
  quantity REAL NOT NULL,
  fat_percent REAL NOT NULL,
  rate REAL NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Recorded',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  pending_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  payment_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  read INTEGER DEFAULT 0
);
`);

// ---------- Settings helpers ----------
const DEFAULT_SETTINGS = { rate_multiplier: '8', rate_base: '0', analyzer_mode: 'simulated' };
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  rows.forEach(r => { s[r.key] = r.value; });
  s.rate_multiplier = parseFloat(s.rate_multiplier) || 8;
  s.rate_base = parseFloat(s.rate_base) || 0;
  return s;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

// ---------- Rate calculation ----------
// Rate = Fat% × multiplier + base
function calcRate(fatPercent) {
  const s = getSettings();
  return fatPercent * s.rate_multiplier + s.rate_base;
}
function calcAmount(quantity, rate) {
  return Math.round(quantity * rate * 100) / 100;
}
// Simulated analyzer reading: 3.0 - 5.5%, weighted around 4.0
function simulateFat() {
  const base = 3.0 + Math.random() * 2.5;
  return Math.round(base * 10) / 10;
}

// ---------- Seed sample data ----------
function seed() {
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount > 0) return;

  // settings
  setSetting('rate_multiplier', '8');
  setSetting('rate_base', '0');
  setSetting('analyzer_mode', 'simulated');

  // admin user
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users(username,password,role,farmer_id) VALUES(?,?,?,?)').run('admin', adminHash, 'ADMIN', null);

  const farmerHash = bcrypt.hashSync('farmer123', 10);

  const villages = ['Anand','Nashik','Karnal','Baramati','Erode','Mandsaur','Nadia','Tumkur'];
  const names = [
    'Ravi Kumar','Suresh Patel','Mahesh Yadav','Dinesh Singh','Arjun Reddy',
    'Vijay Pawar','Kiran Deshmukh','Gopal Nair','Rajesh Gowda','Manoj Verma',
    'Pradeep Shetty','Naresh Jat','Sai Krishna','Deepak Meena','Anil Chauhan',
    'Sanjay Rana','Harish Tiwari','Baldev Singh','Lokesh Hegde','Ramesh Bhat'
  ];

  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);

  names.forEach((nm, i) => {
    const fid = 'M' + String(i + 1).padStart(3, '0');
    const regDate = fmt(new Date(today.getFullYear(), today.getMonth() - 2, (i % 28) + 1));
    db.prepare('INSERT INTO farmers(farmer_id,name,phone,village,address,bank_details,registration_date) VALUES(?,?,?,?,?,?,?)')
      .run(fid, nm, '98765' + String(43210 + i), villages[i % villages.length], 'House ' + (i + 1) + ', ' + villages[i % villages.length], 'SBI-' + (100200 + i), regDate);
    db.prepare('INSERT INTO users(username,password,role,farmer_id) VALUES(?,?,?,?)').run(fid, farmerHash, 'FARMER', fid);
  });

  // Seed collections for last 30 days for all farmers, random morning/evening
  const insertCol = db.prepare(`INSERT INTO milk_collection(farmer_id,farmer_name,date,session,quantity,fat_percent,rate,amount,status)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  const farmers = db.prepare('SELECT farmer_id, name FROM farmers').all();
  for (let d = 29; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(today.getDate() - d);
    const dstr = fmt(day);
    farmers.forEach(f => {
      // morning
      if (Math.random() > 0.15) {
        const q = Math.round((6 + Math.random() * 8) * 10) / 10;
        const fat = simulateFat();
        const rate = calcRate(fat);
        insertCol.run(f.farmer_id, f.name, dstr, 'Morning', q, fat, rate, calcAmount(q, rate), 'Recorded');
      }
      // evening
      if (Math.random() > 0.25) {
        const q = Math.round((4 + Math.random() * 6) * 10) / 10;
        const fat = simulateFat();
        const rate = calcRate(fat);
        insertCol.run(f.farmer_id, f.name, dstr, 'Evening', q, fat, rate, calcAmount(q, rate), 'Recorded');
      }
    });
  }

  // Seed payments: for each farmer compute total and mark ~60% paid, rest pending/partial
  const payInsert = db.prepare(`INSERT INTO payments(farmer_id,total_amount,paid_amount,pending_amount,status,payment_date) VALUES(?,?,?,?,?,?)`);
  farmers.forEach(f => {
    const agg = db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM milk_collection WHERE farmer_id=?`).get(f.farmer_id);
    const total = agg.total;
    const r = Math.random();
    if (r > 0.4) {
      payInsert.run(f.farmer_id, total, total, 0, 'Paid', fmt(today));
    } else if (r > 0.2) {
      const paid = Math.round(total * 0.5);
      payInsert.run(f.farmer_id, total, paid, total - paid, 'Partially Paid', fmt(today));
    } else {
      payInsert.run(f.farmer_id, total, 0, total, 'Pending', null);
    }
  });

  // Seed notifications
  const notifInsert = db.prepare('INSERT INTO notifications(type,message) VALUES(?,?)');
  notifInsert.run('collection', 'Morning collection session started for Anand village');
  notifInsert.run('payment', '3 farmers have pending payments this cycle');
  notifInsert.run('system', 'Simulated milk analyzer is online');
}
seed();

// ---------- Auth middleware ----------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, farmer_id: user.farmer_id }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, role: user.role, farmer_id: user.farmer_id, username: user.username });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- Farmers ----------
app.get('/api/farmers', auth, (req, res) => {
  const { search, village } = req.query;
  let sql = 'SELECT * FROM farmers WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (farmer_id LIKE ? OR name LIKE ? OR phone LIKE ?)'; const w = `%${search}%`; params.push(w, w, w); }
  if (village) { sql += ' AND village = ?'; params.push(village); }
  sql += ' ORDER BY farmer_id';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/farmers/:id', auth, (req, res) => {
  const f = db.prepare('SELECT * FROM farmers WHERE farmer_id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Farmer not found' });
  res.json(f);
});

app.post('/api/farmers', auth, adminOnly, (req, res) => {
  const { farmer_id, name, phone, village, address, bank_details } = req.body || {};
  if (!farmer_id || !name) return res.status(400).json({ error: 'farmer_id and name required' });
  const exists = db.prepare('SELECT 1 FROM farmers WHERE farmer_id=?').get(farmer_id);
  if (exists) return res.status(409).json({ error: 'Farmer ID already exists' });
  const regDate = new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO farmers(farmer_id,name,phone,village,address,bank_details,registration_date) VALUES(?,?,?,?,?,?,?)')
    .run(farmer_id, name, phone || '', village || '', address || '', bank_details || '', regDate);
  // create farmer login with default password
  const hash = bcrypt.hashSync('farmer123', 10);
  try { db.prepare('INSERT INTO users(username,password,role,farmer_id) VALUES(?,?,?,?)').run(farmer_id, hash, 'FARMER', farmer_id); } catch (e) {}
  res.status(201).json(db.prepare('SELECT * FROM farmers WHERE farmer_id=?').get(farmer_id));
});

app.put('/api/farmers/:id', auth, adminOnly, (req, res) => {
  const { name, phone, village, address, bank_details } = req.body || {};
  const f = db.prepare('SELECT * FROM farmers WHERE farmer_id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Farmer not found' });
  db.prepare('UPDATE farmers SET name=?,phone=?,village=?,address=?,bank_details=? WHERE farmer_id=?')
    .run(name || f.name, phone !== undefined ? phone : f.phone, village || f.village, address || f.address, bank_details || f.bank_details, req.params.id);
  res.json(db.prepare('SELECT * FROM farmers WHERE farmer_id=?').get(req.params.id));
});

app.delete('/api/farmers/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM farmers WHERE farmer_id=?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE farmer_id=?').run(req.params.id);
  res.json({ success: true });
});

// ---------- Collections ----------
app.get('/api/collections', auth, (req, res) => {
  const { farmer_id, date, session, search, sort, order, limit, offset } = req.query;
  let sql = `SELECT c.* FROM milk_collection c WHERE 1=1`;
  const params = [];
  if (farmer_id) { sql += ' AND c.farmer_id = ?'; params.push(farmer_id); }
  if (date) { sql += ' AND c.date = ?'; params.push(date); }
  if (session) { sql += ' AND c.session = ?'; params.push(session); }
  if (search) { sql += ' AND (c.farmer_id LIKE ? OR c.farmer_name LIKE ?)'; const w = `%${search}%`; params.push(w, w); }
  const validSort = { entry_id: 1, date: 1, quantity: 1, fat_percent: 1, amount: 1 };
  const sortBy = validSort[sort] ? sort : 'entry_id';
  const dir = String(order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY c.${sortBy} ${dir}`;
  const lim = Math.min(parseInt(limit) || 100, 500);
  const off = parseInt(offset) || 0;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(lim, off);
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/collections/:id', auth, (req, res) => {
  const c = db.prepare('SELECT * FROM milk_collection WHERE entry_id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.post('/api/collections', auth, adminOnly, (req, res) => {
  const { farmer_id, date, session, quantity, fat_percent } = req.body || {};
  if (!farmer_id || !date || !session || quantity === undefined) return res.status(400).json({ error: 'farmer_id, date, session, quantity required' });
  const farmer = db.prepare('SELECT * FROM farmers WHERE farmer_id=?').get(farmer_id);
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  // Simulated analyzer reading if fat not provided
  const fat = (fat_percent !== undefined && fat_percent !== null && fat_percent !== '') ? parseFloat(fat_percent) : simulateFat();
  const rate = calcRate(fat);
  const amount = calcAmount(quantity, rate);
  const info = db.prepare(`INSERT INTO milk_collection(farmer_id,farmer_name,date,session,quantity,fat_percent,rate,amount,status) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(farmer_id, farmer.name, date, session, quantity, fat, rate, amount, 'Recorded');
  // notification
  db.prepare('INSERT INTO notifications(type,message) VALUES(?,?)').run('collection', `New collection: ${farmer.name} - ${quantity}L (${session}) - ₹${amount}`);
  res.status(201).json(db.prepare('SELECT * FROM milk_collection WHERE entry_id=?').get(info.lastInsertRowid));
});

app.put('/api/collections/:id', auth, adminOnly, (req, res) => {
  const c = db.prepare('SELECT * FROM milk_collection WHERE entry_id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { farmer_id, date, session, quantity, fat_percent, status } = req.body || {};
  const fid = farmer_id || c.farmer_id;
  const farmer = db.prepare('SELECT name FROM farmers WHERE farmer_id=?').get(fid);
  const fat = (fat_percent !== undefined && fat_percent !== null) ? parseFloat(fat_percent) : c.fat_percent;
  const q = quantity !== undefined ? quantity : c.quantity;
  const rate = calcRate(fat);
  const amount = calcAmount(q, rate);
  db.prepare(`UPDATE milk_collection SET farmer_id=?, farmer_name=?, date=?, session=?, quantity=?, fat_percent=?, rate=?, amount=?, status=? WHERE entry_id=?`)
    .run(fid, farmer ? farmer.name : c.farmer_name, date || c.date, session || c.session, q, fat, rate, amount, status || c.status, req.params.id);
  res.json(db.prepare('SELECT * FROM milk_collection WHERE entry_id=?').get(req.params.id));
});

app.delete('/api/collections/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM milk_collection WHERE entry_id=?').run(req.params.id);
  res.json({ success: true });
});

// Simulated analyzer reading endpoint (for future device integration)
app.post('/api/analyzer/reading', auth, adminOnly, (req, res) => {
  const { fat_percent } = req.body || {};
  const fat = (fat_percent !== undefined) ? parseFloat(fat_percent) : simulateFat();
  const rate = calcRate(fat);
  res.json({ fat_percent: fat, rate, source: 'simulated', note: 'Simulated analyzer reading. Real device can POST fat_percent here.' });
});

// ---------- Payments ----------
app.get('/api/payments', auth, (req, res) => {
  const { status, farmer_id } = req.query;
  let sql = `SELECT p.*, f.name as farmer_name, f.village
    FROM payments p JOIN farmers f ON p.farmer_id = f.farmer_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (farmer_id) { sql += ' AND p.farmer_id = ?'; params.push(farmer_id); }
  sql += ' ORDER BY p.payment_id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/payments', auth, adminOnly, (req, res) => {
  const { farmer_id, paid_amount, payment_date } = req.body || {};
  if (!farmer_id || paid_amount === undefined) return res.status(400).json({ error: 'farmer_id and paid_amount required' });
  const agg = db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM milk_collection WHERE farmer_id=?`).get(farmer_id);
  const total = agg.total;
  // update or insert payment record
  const existing = db.prepare('SELECT * FROM payments WHERE farmer_id=?').get(farmer_id);
  if (existing) {
    const newPaid = existing.paid_amount + parseFloat(paid_amount);
    const pending = Math.max(0, total - newPaid);
    const st = pending <= 0 ? 'Paid' : (newPaid > 0 ? 'Partially Paid' : 'Pending');
    db.prepare('UPDATE payments SET total_amount=?, paid_amount=?, pending_amount=?, status=?, payment_date=? WHERE farmer_id=?')
      .run(total, newPaid, pending, st, payment_date || new Date().toISOString().slice(0, 10), farmer_id);
    res.json(db.prepare('SELECT * FROM payments WHERE farmer_id=?').get(farmer_id));
  } else {
    const paid = parseFloat(paid_amount);
    const pending = Math.max(0, total - paid);
    const st = pending <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Pending');
    db.prepare('INSERT INTO payments(farmer_id,total_amount,paid_amount,pending_amount,status,payment_date) VALUES(?,?,?,?,?,?)')
      .run(farmer_id, total, paid, pending, st, payment_date || new Date().toISOString().slice(0, 10));
    res.status(201).json(db.prepare('SELECT * FROM payments WHERE farmer_id=?').get(farmer_id));
  }
});

app.get('/api/farmer/:id/payments', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM payments WHERE farmer_id=?').all(req.params.id));
});

// ---------- Dashboard ----------
app.get('/api/dashboard', auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const totalFarmers = db.prepare('SELECT COUNT(*) c FROM farmers').get().c;
  const todayCol = db.prepare(`SELECT
    COALESCE(SUM(quantity),0) qty,
    COALESCE(SUM(amount),0) amt,
    COALESCE(AVG(fat_percent),0) avg_fat
    FROM milk_collection WHERE date=?`).get(today);
  const morning = db.prepare(`SELECT COALESCE(SUM(quantity),0) qty, COALESCE(SUM(amount),0) amt FROM milk_collection WHERE date=? AND session='Morning'`).get(today);
  const evening = db.prepare(`SELECT COALESCE(SUM(quantity),0) qty, COALESCE(SUM(amount),0) amt FROM milk_collection WHERE date=? AND session='Evening'`).get(today);
  const pendingPayments = db.prepare(`SELECT COALESCE(SUM(pending_amount),0) total FROM payments WHERE status IN ('Pending','Partially Paid')`).get().total;

  // 14-day trend
  const trend = db.prepare(`SELECT date, SUM(quantity) qty, SUM(amount) amt, AVG(fat_percent) fat
    FROM milk_collection WHERE date >= date(?, '-13 days') GROUP BY date ORDER BY date`).all(today);

  // morning vs evening last 7 days
  const mv = db.prepare(`SELECT session, SUM(quantity) qty FROM milk_collection WHERE date >= date(?, '-6 days') GROUP BY session`).all(today);

  // farmer-wise top 10 (last 30 days)
  const farmerWise = db.prepare(`SELECT farmer_name, SUM(quantity) qty, SUM(amount) amt
    FROM milk_collection GROUP BY farmer_id ORDER BY qty DESC LIMIT 10`).all();

  // monthly payment summary (last 6 months)
  const monthlyPay = db.prepare(`SELECT strftime('%Y-%m', date) m, SUM(amount) amt
    FROM milk_collection GROUP BY m ORDER BY m DESC LIMIT 6`).all().reverse();

  res.json({
    kpis: {
      totalFarmers,
      todayQuantity: todayCol.qty,
      todayAmount: todayCol.amt,
      morningQuantity: morning.qty,
      eveningQuantity: evening.qty,
      avgFat: todayCol.avg_fat,
      pendingPayments
    },
    trend,
    morningEvening: mv,
    farmerWise,
    monthlyPay
  });
});

// ---------- Farmer dashboard ----------
app.get('/api/farmer/:id/dashboard', auth, (req, res) => {
  const fid = req.params.id;
  const farmer = db.prepare('SELECT * FROM farmers WHERE farmer_id=?').get(fid);
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  const today = new Date().toISOString().slice(0, 10);
  const todayCol = db.prepare(`SELECT * FROM milk_collection WHERE farmer_id=? AND date=?`).all(fid, today);
  const monthStart = today.slice(0, 8) + '01';
  const monthly = db.prepare(`SELECT COALESCE(SUM(quantity),0) qty, COALESCE(SUM(amount),0) amt, COALESCE(AVG(fat_percent),0) fat
    FROM milk_collection WHERE farmer_id=? AND date>=?`).get(fid, monthStart);
  const history = db.prepare(`SELECT * FROM milk_collection WHERE farmer_id=? ORDER BY date DESC, entry_id DESC LIMIT 30`).all(fid);
  // monthly chart last 6 months
  const monthlyChart = db.prepare(`SELECT strftime('%Y-%m', date) m, SUM(amount) amt, SUM(quantity) qty
    FROM milk_collection WHERE farmer_id=? GROUP BY m ORDER BY m DESC LIMIT 6`).all(fid).reverse();
  res.json({ farmer, todayCol, monthly, history, monthlyChart });
});

app.get('/api/farmer/:id/collections', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM milk_collection WHERE farmer_id=? ORDER BY date DESC, entry_id DESC').all(req.params.id));
});

// ---------- Reports ----------
function dateRange(type) {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  if (type === 'daily') return [fmt(today), fmt(today)];
  if (type === 'weekly') {
    const w = new Date(today); w.setDate(today.getDate() - 6);
    return [fmt(w), fmt(today)];
  }
  if (type === 'monthly') {
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    return [fmt(m), fmt(today)];
  }
  return [null, null];
}

app.get('/api/reports/daily', auth, (req, res) => {
  const [from, to] = dateRange('daily');
  const rows = db.prepare(`SELECT * FROM milk_collection WHERE date BETWEEN ? AND ? ORDER BY date DESC`).all(from, to);
  res.json({ type: 'daily', from, to, rows });
});

app.get('/api/reports/weekly', auth, (req, res) => {
  const [from, to] = dateRange('weekly');
  const rows = db.prepare(`SELECT * FROM milk_collection WHERE date BETWEEN ? AND ? ORDER BY date DESC`).all(from, to);
  res.json({ type: 'weekly', from, to, rows });
});

app.get('/api/reports/monthly', auth, (req, res) => {
  const [from, to] = dateRange('monthly');
  const rows = db.prepare(`SELECT * FROM milk_collection WHERE date BETWEEN ? AND ? ORDER BY date DESC`).all(from, to);
  res.json({ type: 'monthly', from, to, rows });
});

app.get('/api/reports/farmer-wise', auth, (req, res) => {
  const rows = db.prepare(`SELECT farmer_id, farmer_name,
    COUNT(*) entries, SUM(quantity) qty, AVG(fat_percent) avg_fat, SUM(amount) amt
    FROM milk_collection GROUP BY farmer_id ORDER BY amt DESC`).all();
  res.json({ type: 'farmer-wise', rows });
});

app.get('/api/reports/payment', auth, (req, res) => {
  const rows = db.prepare(`SELECT p.*, f.name farmer_name, f.village
    FROM payments p JOIN farmers f ON p.farmer_id=f.farmer_id ORDER BY p.status`).all();
  res.json({ type: 'payment', rows });
});

app.get('/api/reports/quality', auth, (req, res) => {
  const rows = db.prepare(`SELECT farmer_id, farmer_name, AVG(fat_percent) avg_fat, MIN(fat_percent) min_fat, MAX(fat_percent) max_fat
    FROM milk_collection GROUP BY farmer_id ORDER BY avg_fat DESC`).all();
  res.json({ type: 'quality', rows });
});

// CSV export
app.get('/api/reports/export', auth, (req, res) => {
  const type = req.query.type || 'daily';
  let rows = [];
  let headers = [];
  if (type === 'farmer-wise') {
    rows = db.prepare(`SELECT farmer_id, farmer_name, COUNT(*) entries, SUM(quantity) qty, AVG(fat_percent) avg_fat, SUM(amount) amt FROM milk_collection GROUP BY farmer_id ORDER BY amt DESC`).all();
    headers = ['farmer_id','farmer_name','entries','qty','avg_fat','amt'];
  } else if (type === 'payment') {
    rows = db.prepare(`SELECT p.farmer_id, f.name farmer_name, p.total_amount, p.paid_amount, p.pending_amount, p.status, p.payment_date FROM payments p JOIN farmers f ON p.farmer_id=f.farmer_id`).all();
    headers = ['farmer_id','farmer_name','total_amount','paid_amount','pending_amount','status','payment_date'];
  } else if (type === 'quality') {
    rows = db.prepare(`SELECT farmer_id, farmer_name, AVG(fat_percent) avg_fat, MIN(fat_percent) min_fat, MAX(fat_percent) max_fat FROM milk_collection GROUP BY farmer_id`).all();
    headers = ['farmer_id','farmer_name','avg_fat','min_fat','max_fat'];
  } else {
    const [from, to] = dateRange(type);
    rows = db.prepare(`SELECT entry_id,farmer_id,farmer_name,date,session,quantity,fat_percent,rate,amount,status FROM milk_collection WHERE date BETWEEN ? AND ? ORDER BY date DESC`).all(from, to);
    headers = ['entry_id','farmer_id','farmer_name','date','session','quantity','fat_percent','rate','amount','status'];
  }
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => r[h]).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
  res.send(csv);
});

// ---------- Settings ----------
app.get('/api/settings', auth, (req, res) => res.json(getSettings()));

app.put('/api/settings', auth, adminOnly, (req, res) => {
  const { rate_multiplier, rate_base, analyzer_mode } = req.body || {};
  if (rate_multiplier !== undefined) setSetting('rate_multiplier', rate_multiplier);
  if (rate_base !== undefined) setSetting('rate_base', rate_base);
  if (analyzer_mode !== undefined) setSetting('analyzer_mode', analyzer_mode);
  res.json(getSettings());
});

// ---------- Notifications ----------
app.get('/api/notifications', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all());
});

app.post('/api/notifications/read', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE notifications SET read=1').run();
  res.json({ success: true });
});

// ---------- Villages (for filters) ----------
app.get('/api/villages', auth, (req, res) => {
  res.json(db.prepare('SELECT DISTINCT village FROM farmers WHERE village IS NOT NULL ORDER BY village').all().map(r => r.village));
});

// ---------- Fallback to index ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.json());

app.post("/login", (req, res) => {
    const { id, password, role } = req.body;

    if (role === "admin") {
        if (id === "admin" && password === "admin123") {
            return res.json({
                success: true,
                message: "Admin login successful"
            });
        }
    }

    if (role === "farmer") {
        if (id.startsWith("M") && password === "farmer123") {
            return res.json({
                success: true,
                message: "Farmer login successful"
            });
        }
    }

    res.status(401).json({
        success: false,
        message: "Invalid ID or password"
    });
});

app.listen(PORT, () => {
  console.log(`Smart Milk Collection System running on http://localhost:${PORT}`);
});
