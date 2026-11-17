const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
if (!ADMIN_KEY || ADMIN_KEY.length < 32) {
  console.error("Set ADMIN_KEY to a random secret of at least 32 characters before starting SAFAR LINK.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !PUBLIC_BASE_URL.startsWith("https://")) {
  console.error("In production, PUBLIC_BASE_URL must be your HTTPS domain.");
  process.exit(1);
}
const DB_FILE = path.join(__dirname, "data.json");

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return {}; }
}
function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function id(bytes = 18) { return crypto.randomBytes(bytes).toString("hex"); }
function admin(req, res, next) {
  const key = req.get("x-admin-key") || req.query.key;
  const a = Buffer.from(String(key || ""));
  const b = Buffer.from(ADMIN_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "منتظم کی چابی درست نہیں۔" });
  next();
}
function cleanExpired(db) {
  const now = Date.now();
  for (const [k, v] of Object.entries(db)) {
    if (v.expiresAt < now) delete db[k];
  }
}

app.post("/api/sessions", admin, (req, res) => {
  const db = load(); cleanExpired(db);
  const sessionId = id(10), shareToken = id(24), dashboardToken = id(24);
  const minutes = Math.min(Math.max(Number(req.body.durationMinutes) || 60, 5), 1440);
  db[sessionId] = {
    sessionId, shareToken, dashboardToken,
    label: String(req.body.label || "لوکیشن").slice(0, 60),
    createdAt: Date.now(), expiresAt: Date.now() + minutes * 60000,
    consent: false, location: null, lastUpdate: null
  };
  save(db);
  const base = PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  res.json({ sessionId, shareUrl: `${base}/share/${shareToken}`,
    dashboardUrl: `${base}/dashboard/${sessionId}?key=${dashboardToken}`,
    expiresAt: db[sessionId].expiresAt });
});

app.get("/api/share/:token", (req, res) => {
  const db = load(); cleanExpired(db); save(db);
  const s = Object.values(db).find(x => x.shareToken === req.params.token);
  if (!s) return res.status(404).json({ error: "یہ لنک ختم ہو چکا ہے یا درست نہیں۔" });
  res.json({ label: s.label, expiresAt: s.expiresAt, consent: s.consent });
});

app.post("/api/share/:token/consent", (req, res) => {
  const db = load();
  const s = Object.values(db).find(x => x.shareToken === req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(404).json({ error: "لنک ختم ہو چکا ہے۔" });
  s.consent = true; s.consentedAt = Date.now(); save(db);
  res.json({ ok: true });
});

app.post("/api/share/:token/revoke", (req, res) => {
  const db = load();
  const s = Object.values(db).find(x => x.shareToken === req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(404).json({ error: "لنک ختم ہو چکا ہے۔" });
  s.consent = false; s.location = null; s.lastUpdate = null; s.revokedAt = Date.now(); save(db);
  res.json({ ok: true });
});

app.post("/api/share/:token/location", (req, res) => {
  const db = load();
  const s = Object.values(db).find(x => x.shareToken === req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(404).json({ error: "لنک ختم ہو چکا ہے۔" });
  if (!s.consent) return res.status(403).json({ error: "پہلے واضح اجازت ضروری ہے۔" });
  const lat = Number(req.body.latitude), lng = Number(req.body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return res.status(400).json({ error: "لوکیشن کوآرڈینیٹس درست نہیں۔" });
  s.location = { latitude: lat, longitude: lng, accuracy: Number(req.body.accuracy) || null };
  s.lastUpdate = Date.now(); save(db);
  res.json({ ok: true });
});

app.get("/api/dashboard/:id", (req, res) => {
  const db = load(); cleanExpired(db); save(db);
  const s = db[req.params.id];
  if (!s || req.query.key !== s.dashboardToken) return res.status(404).json({ error: "ڈیش بورڈ دستیاب نہیں۔" });
  res.json({ label: s.label, consent: s.consent, location: s.location, lastUpdate: s.lastUpdate, expiresAt: s.expiresAt });
});

app.post("/api/dashboard/:id/stop", (req, res) => {
  const db = load(); const s = db[req.params.id];
  if (!s || req.body.key !== s.dashboardToken) return res.status(404).json({ error: "ڈیش بورڈ دستیاب نہیں۔" });
  s.expiresAt = Date.now(); save(db); res.json({ ok: true });
});

app.get("/share/:token", (_, res) => res.sendFile(path.join(__dirname, "public", "share.html")));
app.get("/dashboard/:id", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`SAFAR LINK running on port ${PORT}`));
