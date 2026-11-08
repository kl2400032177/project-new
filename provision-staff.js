// Trusted-only staff provisioning. Example:
// $env:BOOTSTRAP_ADMIN_SECRET='long-secret'; node provision-staff.js farmer farmer@example.com "Green Basket Owner" "StrongPassword123!" f1
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');
const [role, email, name, password, farmerId] = process.argv.slice(2);
if (!process.env.BOOTSTRAP_ADMIN_SECRET || !['farmer', 'delivery'].includes(role) || !email || !name || !password || password.length < 12 || (role === 'farmer' && !farmerId)) {
  console.error('Provide role (farmer or delivery), email, name, 12+ character password, and farmer ID for farmer accounts. Set BOOTSTRAP_ADMIN_SECRET.'); process.exit(1);
}
const db = new Database(path.join(__dirname, 'fieldlink.db'));
if (role === 'farmer' && !db.prepare('SELECT id FROM farmers WHERE id=?').get(farmerId)) { console.error('Farm ID does not exist. Use f1, f2, or f3 for the included sample farms.'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
try { db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), name, email.trim().toLowerCase(), `${salt}:${hash}`, role, role === 'farmer' ? farmerId : null, new Date().toISOString()); console.log(`${role} account created through trusted provisioning.`); } catch { console.error('Could not create account: email may already exist.'); process.exit(1); }
