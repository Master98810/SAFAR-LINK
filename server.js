
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

if (!ADMIN_KEY || ADMIN_KEY.length < 32) {
  console.error("ADMIN_KEY must be at least 32 characters.");
  process.exit(1);
}

if (process.env.NODE_ENV === "production" &&
    !PUBLIC_BASE_URL.startsWith("https://")) {
  console.error("PUBLIC_BASE_URL must use HTTPS.");
  process.exit(1);
}

// Firebase service account key stays on the server.
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "/etc/secrets/serviceAccountKey.json";

if (!require("fs").existsSync(keyPath)) {
  console.error("Firebase service account key file was not found.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath))
});

const db = admin.firestore();
const sessions = db.collection("sessions");

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security",
      "max-age=31536000; includeSubDomains");
  }
  next();
});

function makeId(bytes = 18) {
  return crypto.randomBytes(bytes).toString("hex");
}

function adminAuth(req, res, next) {
  const key = req.get("x-admin-key") || req.query.key || "";
  const a = Buffer.from(String(key));
  const b = Buffer.from(ADMIN_KEY);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "منتظم کی چابی درست نہیں۔" });
  }
  next();
}

async function findByShareToken(token) {
  const snap = await sessions
    .where("shareToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
}

// Create a new location-sharing link.
app.post("/api/sessions", adminAuth, async (req, res) => {
  try {
    const sessionId = makeId(10);
    const shareToken = makeId(24);
    const dashboardToken = makeId(24);
    const minutes = Math.min(
      Math.max(Number(req.body.durationMinutes) || 60, 5),
      1440
    );

    const session = {
      sessionId,
      shareToken,
      dashboardToken,
      label: String(req.body.label || "لوکیشن").slice(0, 60),
      phone: String(req.body.phone || "").slice(0, 30),
      personName: String(req.body.personName || "").slice(0, 60),
      createdAt: Date.now(),
      expiresAt: Date.now() + minutes * 60000,
      consent: false,
      stopped: false,
      location: null,
      lastUpdate: null
    };

    await sessions.doc(sessionId).set(session);

    const base = PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;

    res.json({
      sessionId,
      shareUrl: `${base}/share/${shareToken}`,
      dashboardUrl: `${base}/dashboard/${sessionId}?key=${dashboardToken}`,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "لنک بنانے میں مسئلہ پیش آیا۔" });
  }
});

// Find a share link.
app.get("/api/share/:token", async (req, res) => {
  try {
    const found = await findByShareToken(req.params.token);
    if (!found || found.data.expiresAt < Date.now() || found.data.stopped) {
      return res.status(404).json({
        error: "یہ لنک ختم ہو چکا ہے یا بند کر دیا گیا ہے۔"
      });
    }

    res.json({
      label: found.data.label,
      expiresAt: found.data.expiresAt,
      consent: found.data.consent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "سرور میں مسئلہ ہے۔" });
  }
});

// Save recipient's explicit consent.
app.post("/api/share/:token/consent", async (req, res) => {
  try {
    const found = await findByShareToken(req.params.token);

    if (!found || found.data.expiresAt < Date.now() ||
        found.data.stopped) {
      return res.status(404).json({ error: "لنک دستیاب نہیں۔" });
    }

    await found.ref.update({
      consent: true,
      consentedAt: Date.now()
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "اجازت محفوظ نہیں ہو سکی۔" });
  }
});

// Revoke consent. Keep the existing history.
app.post("/api/share/:token/revoke", async (req, res) => {
  try {
    const found = await findByShareToken(req.params.token);

    if (!found) {
      return res.status(404).json({ error: "لنک دستیاب نہیں۔" });
    }

    await found.ref.update({
      consent: false,
      revokedAt: Date.now()
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "اجازت واپس نہیں ہو سکی۔" });
  }
});

// Save every location update as a separate history record.
app.post("/api/share/:token/location", async (req, res) => {
  try {
    const found = await findByShareToken(req.params.token);

    if (!found || found.data.expiresAt < Date.now() ||
        found.data.stopped) {
      return res.status(404).json({ error: "لنک دستیاب نہیں۔" });
    }

    if (!found.data.consent) {
      return res.status(403).json({
        error: "پہلے واضح اجازت ضروری ہے۔"
      });
    }

    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    const accuracy = Number(req.body.accuracy) || null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({
        error: "لوکیشن کوآرڈینیٹس درست نہیں۔"
      });
    }

    const receivedAt = Date.now();
    const location = {
      latitude: lat,
      longitude: lng,
      accuracy,
      receivedAt
    };

    await found.ref.collection("history").add(location);

    await found.ref.update({
      location,
      lastUpdate: receivedAt
    });

    res.json({ ok: true, receivedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "لوکیشن محفوظ نہیں ہو سکی۔" });
  }
});

// Get current location and recent history for the dashboard.
app.get("/api/dashboard/:id", async (req, res) => {
  try {
    const ref = sessions.doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "ڈیش بورڈ دستیاب نہیں۔" });
    }

    const s = snap.data();
    if (req.query.key !== s.dashboardToken) {
      return res.status(401).json({ error: "ڈیش بورڈ کی چابی درست نہیں۔" });
    }

    const historySnap = await ref.collection("history")
      .orderBy("receivedAt", "desc")
      .limit(200)
      .get();

    const history = historySnap.docs.map(doc => doc.data());

    res.json({
      label: s.label,
      phone: s.phone || "",
      personName: s.personName || "",
      consent: s.consent,
      stopped: s.stopped || false,
      location: s.location,
      lastUpdate: s.lastUpdate,
      expiresAt: s.expiresAt,
      history
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ڈیش بورڈ لوڈ نہیں ہو سکا۔" });
  }
});

// Get location history separately.
app.get("/api/dashboard/:id/history", async (req, res) => {
  try {
    const ref = sessions.doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists ||
        req.query.key !== snap.data().dashboardToken) {
      return res.status(404).json({ error: "ہسٹری دستیاب نہیں۔" });
    }

    const historySnap = await ref.collection("history")
      .orderBy("receivedAt", "desc")
      .limit(500)
      .get();

    res.json({
      history: historySnap.docs.map(doc => doc.data())
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ہسٹری لوڈ نہیں ہو سکی۔" });
  }
});

// Stop future sharing without deleting saved history.
app.post("/api/dashboard/:id/stop", async (req, res) => {
  try {
    const ref = sessions.doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists ||
        req.body.key !== snap.data().dashboardToken) {
      return res.status(404).json({ error: "ڈیش بورڈ دستیاب نہیں۔" });
    }

    await ref.update({
      consent: false,
      stopped: true,
      stoppedAt: Date.now(),
      expiresAt: Date.now()
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "شیئرنگ بند نہیں ہو سکی۔" });
  }
});

app.get("/share/:token", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "share.html"))
);

app.get("/dashboard/:id", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);

app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.listen(PORT, () => {
  console.log(`SAFAR LINK running on port ${PORT}`);
});



// Native Android administrator API, using the existing Firestore sessions collection.
function androidSession(s) { return { sessionId: s.sessionId, label: s.label, phone: s.phone || "", createdAt: s.createdAt, expiresAt: s.expiresAt, consent: !!s.consent, stopped: !!s.stopped, lastUpdate: s.lastUpdate || null, location: s.location || null }; }
app.get("/api/sessions", adminAuth, async (_req, res) => {
  try { const snap = await sessions.orderBy("createdAt", "desc").limit(200).get(); res.json({ sessions: snap.docs.map(doc => androidSession(doc.data())) }); }
  catch (error) { console.error(error); res.status(500).json({ error: "لنکس کی فہرست حاصل نہیں ہو سکی۔" }); }
});
app.get("/api/sessions/:id/history", adminAuth, async (req, res) => {
  try { const ref = sessions.doc(req.params.id); const snap = await ref.get(); if (!snap.exists) return res.status(404).json({ error: "یہ ریکارڈ موجود نہیں۔" });
    const hs = await ref.collection("history").limit(500).get(); const history = hs.docs.map(doc => { const p = doc.data(); return { recordId: doc.id, ...p, recordedAt: p.recordedAt || p.receivedAt || null }; }).sort((a,b) => (b.recordedAt || 0) - (a.recordedAt || 0));
    res.json({ session: androidSession(snap.data()), history });
  } catch (error) { console.error(error); res.status(500).json({ error: "لوکیشن ہسٹری حاصل نہیں ہو سکی۔" }); }
});
app.post("/api/sessions/:id/stop", adminAuth, async (req, res) => {
  try { const ref = sessions.doc(req.params.id); const snap = await ref.get(); if (!snap.exists) return res.status(404).json({ error: "یہ ریکارڈ موجود نہیں۔" }); await ref.update({ stopped: true, consent: false, stoppedAt: Date.now() }); res.json({ ok: true }); }
  catch (error) { console.error(error); res.status(500).json({ error: "سیشن بند نہیں ہو سکا۔" }); }
});
app.delete("/api/sessions/:id", adminAuth, async (req, res) => {
  try { const ref = sessions.doc(req.params.id); const snap = await ref.get(); if (!snap.exists) return res.status(404).json({ error: "یہ ریکارڈ موجود نہیں۔" }); await admin.firestore().recursiveDelete(ref); res.json({ ok: true }); }
  catch (error) { console.error(error); res.status(500).json({ error: "ریکارڈ حذف نہیں ہو سکا۔" }); }
});
