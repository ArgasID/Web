require('./config');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const tripayConfig = require('./config/tripay');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Database handler
const db = {
  async query(sql, params) {
    const conn = await mysql.createConnection(global.dbConfig);
    try {
      const [rows] = await conn.execute(sql, params || []);
      return rows;
    } finally {
      await conn.end();
    }
  }
};

// ROUTES

// Cek username
app.post('/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ exists: false });

  try {
    const rows = await db.query("SELECT name FROM players WHERE name = ?", [username]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ exists: false });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'Username kosong.' });

  try {
    const rows = await db.query("SELECT * FROM players WHERE name = ?", [username]);
    res.json({ success: rows.length > 0, message: rows.length ? null : 'Username tidak ditemukan.' });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Beli rank
app.post('/buy', async (req, res) => {
  const { username, rank } = req.body;
  if (!username || !rank) {
    return res.status(400).json({ success: false, message: "Data tidak lengkap." });
  }

  try {
    let userIdentifier = username;

    if (username.startsWith('.')) {
      const rows = await db.query("SELECT uuid FROM players WHERE name = ?", [username]);
      if (!rows.length || !rows[0].uuid) {
        return res.status(404).json({ success: false, message: "UUID untuk Bedrock player tidak ditemukan." });
      }
      userIdentifier = rows[0].uuid;
    }

    const command = `lp user ${userIdentifier} parent set ${rank}`;
    await db.query("INSERT INTO pending_commands (command) VALUES (?)", [command]);

    console.log(`Command disimpan: ${command}`);
    res.json({ success: true, message: `Berhasil membeli rank ${rank} untuk ${username}` });
  } catch (err) {
    console.error("Buy error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// Buat pembayaran Tripay
app.post('/api/bayar-rank', async (req, res) => {
  const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { rank, harga, name, email, phone, paymentMethod } = req.body;
  
  if (!rank || !harga || !name || !email || !phone || !paymentMethod) {
    return res.status(400).json({ success: false, message: "Semua field harus diisi" });
  }

  try {
    const merchant_ref = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const signature = crypto.createHmac('sha256', tripayConfig.privateKey)
      .update(tripayConfig.kodeMerchant + merchant_ref + harga)
      .digest('hex');

    const data = {
      method: paymentMethod,
      merchant_ref,
      amount: harga,
      customer_name: name,
      customer_email: email,
      customer_phone: phone.replace(/^0/, '62'),
      order_items: [{ name: `Rank ${rank}`, price: harga, quantity: 1 }],
      callback_url: tripayConfig.callbackUrl,
      return_url: tripayConfig.returnUrl,
      expired_time: Math.floor(Date.now() / 1000) + 3600,
      signature
    };

    const response = await fetch(tripayConfig.urlBuatTransaksi, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tripayConfig.apiKey}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Gagal buat pembayaran");

    const logEntry = {
      timestamp: new Date().toISOString(),
      transaction_id: transactionId,
      merchant_ref,
      name, email, phone,
      amount: harga,
      payment_method: paymentMethod,
      checkout_url: result.data.checkout_url,
      status: 'PENDING'
    };

    fs.appendFileSync('transactions.log', JSON.stringify(logEntry) + '\n');

    res.json({ success: true, data: { checkout_url: result.data.checkout_url, transaction_id: transactionId } });
  } catch (err) {
    console.error(`[${transactionId}] Error pembayaran:`, err);
    res.status(500).json({ success: false, message: 'Gagal memproses pembayaran' });
  }
});

// Callback Tripay
app.post('/callback', async (req, res) => {
  const callbackId = `CB-${Date.now()}`;
  const signatureHeader = req.headers['x-callback-signature'];
  const event = req.headers['x-callback-event'];
  const payload = req.body;

  if (!signatureHeader || !event) return res.status(400).send('Missing headers');

  const generatedSignature = crypto.createHmac('sha256', tripayConfig.privateKey)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signatureHeader !== generatedSignature) {
    console.error(`[${callbackId}] Invalid signature`);
    return res.status(403).send('Forbidden');
  }

  if (event !== 'payment_status') return res.status(400).send('Invalid Event');

  const { reference, status, merchant_ref, amount } = payload;
  const log = {
    timestamp: new Date().toISOString(),
    reference, status, merchant_ref, amount,
    event, callback_id: callbackId
  };

  let filename = 'unknown_payments.log';
  if (status === 'PAID') filename = 'paid_payments.log';
  else if (status === 'FAILED') filename = 'failed_payments.log';
  else if (status === 'EXPIRED') filename = 'expired_payments.log';

  fs.appendFileSync(filename, JSON.stringify(log) + '\n');
  res.status(200).json({ success: true, callback_id: callbackId });
});

// Redirect hasil pembayaran
app.get('/redirect', (req, res) => {
  const { status } = req.query;
  if (status === 'PAID') {
    res.redirect('/success.html');
  } else {
    res.redirect(`/failed.html?reason=${encodeURIComponent(status || 'unknown')}`);
  }
});

// Global Error Handling
process.on('uncaughtException', err => {
  console.error("Unhandled Exception:", err);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});