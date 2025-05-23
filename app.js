require('./config');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Database configuration
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

// Username Check
app.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ exists: false });

    const rows = await db.query("SELECT name FROM players WHERE name = ?", [username]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ exists: false });
  }
});

// Login System
app.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username kosong.' 
      });
    }

    const rows = await db.query('SELECT * FROM players WHERE name = ?', [username]);
    
    if (rows.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ 
        success: false, 
        message: 'Username tidak ditemukan.' 
      });
    }
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error.' 
    });
  }
});

// Purchase System
app.post('/buy', async (req, res) => {
  try {
    const { username, rank } = req.body;
    if (!username || !rank) {
      return res.status(400).json({ 
        success: false,
        message: "Data tidak lengkap." 
      });
    }

    let userIdentifier = username;

    if (username.startsWith('.')) {
      const rows = await db.query(
        "SELECT uuid FROM players WHERE name = ?", 
        [username]
      );
      
      if (rows.length > 0 && rows[0].uuid) {
        userIdentifier = rows[0].uuid;
      } else {
        return res.status(404).json({ 
          success: false,
          message: "UUID untuk Bedrock player tidak ditemukan." 
        });
      }
    }

    const command = `lp user ${userIdentifier} parent set ${rank}`;
    await db.query(
      "INSERT INTO pending_commands (command) VALUES (?)", 
      [command]
    );

    console.log(`Command disimpan ke database: ${command}`);
    res.json({ 
      success: true,
      message: `Berhasil membeli rank ${rank} untuk ${username}` 
    });
  } catch (err) {
    console.error("Gagal menyimpan perintah:", err);
    res.status(500).json({ 
      success: false,
      message: "Terjadi kesalahan server." 
    });
  }
});

// Tripay Payment Configuration
const tripayConfig = {
  kodeMerchant: 'T40499',
  privateKey: 'WN7qd-YWXNB-B3Z43-Je36m-uKTGG',
  apiKey: 'PCYJ6jKIFZgmMlF26cm5SDLBmbeR678VuBzrZqIF',
  urlBuatTransaksi: 'https://tripay.co.id/api/transaction/create',
  callbackUrl: 'https://web.glowbit.fun/callback',
  returnUrl: 'https://web.glowbit.fun/redirect'
};

// API Endpoint untuk Pembayaran dari Frontend
app.post('/api/bayar-rank', async (req, res) => {
  const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    console.log(`[${transactionId}] Payment request received`);
    
    // Validasi input
    const { rank, harga, name, email, phone, paymentMethod, merchant_ref } = req.body;
    
    // Validasi field required
    if (!rank || !harga || !name || !email || !phone || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Semua field harus diisi'
      });
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    // Validasi nomor HP
    const phoneRegex = /^[0-9]{10,13}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Format nomor HP tidak valid'
      });
    }

    // Generate signature
    const signature = crypto.createHmac('sha256', tripayConfig.privateKey)
      .update(tripayConfig.kodeMerchant + merchant_ref + harga)
      .digest('hex');

    // Persiapkan data transaksi
    const transactionData = {
      method: paymentMethod,
      merchant_ref: merchant_ref || generateMerchantRef(),
      amount: harga,
      customer_name: name,
      customer_email: email,
      customer_phone: phone.replace(/^0/, '62'),
      order_items: [{
        name: `Rank ${rank}`,
        price: harga,
        quantity: 1
      }],
      callback_url: tripayConfig.callbackUrl,
      return_url: tripayConfig.returnUrl,
      expired_time: Math.floor(Date.now() / 1000) + 3600, // 1 jam
      signature
    };

    // Kirim ke API Tripay
    const tripayResponse = await fetch(tripayConfig.urlBuatTransaksi, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tripayConfig.apiKey}`
      },
      body: JSON.stringify(transactionData)
    });

    const result = await tripayResponse.json();

    if (!result.success) {
      throw new Error(result.message || 'Gagal memproses pembayaran');
    }

    // Simpan transaksi ke database
    await db.query(
      `INSERT INTO transactions 
      (transaction_id, merchant_ref, customer_name, email, phone, amount, status, payment_method, checkout_url)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [transactionId, transactionData.merchant_ref, name, email, phone, harga, paymentMethod, result.data.checkout_url]
    );

    return res.json({
      success: true,
      data: {
        checkout_url: result.data.checkout_url,
        transaction_id: transactionId
      }
    });

  } catch (error) {
    console.error(`[${transactionId}] Error:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan server'
    });
  }
});

// Fungsi pembantu untuk generate merchant reference
function generateMerchantRef() {
  return 'INV-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

// Tripay Callback Handler
app.post('/callback', async (req, res) => {
  const callbackId = `CB-${Date.now()}`;
  
  try {
    // 1. Validasi headers dan signature
    const callbackSignature = req.headers['x-callback-signature'];
    const callbackEvent = req.headers['x-callback-event'];
    const jsonData = req.body;

    if (!callbackSignature || !callbackEvent) {
      console.error(`[${callbackId}] Missing required headers`);
      return res.status(400).send('Bad Request');
    }

    // 2. Generate signature
    const generatedSignature = crypto
      .createHmac('sha256', tripayConfig.privateKey)
      .update(JSON.stringify(jsonData))
      .digest('hex');

    // 3. Verifikasi signature
    if (generatedSignature !== callbackSignature) {
      console.error(`[${callbackId}] Signature mismatch`, {
        received: callbackSignature,
        expected: generatedSignature
      });
      return res.status(403).send('Forbidden');
    }

    // 4. Validasi event type
    if (callbackEvent !== 'payment_status') {
      console.error(`[${callbackId}] Invalid event type: ${callbackEvent}`);
      return res.status(400).send('Invalid Event Type');
    }

    // 5. Validasi data transaksi
    const { reference, status, merchant_ref, amount } = jsonData;
    if (!reference || !status || !merchant_ref || !amount) {
      console.error(`[${callbackId}] Missing transaction data`);
      return res.status(400).send('Incomplete Transaction Data');
    }

    // 6. Proses status pembayaran
    console.log(`[${callbackId}] Processing payment status:`, { reference, status });

    const fs = require('fs');
    const logData = {
      timestamp: new Date().toISOString(),
      callback_id: callbackId,
      reference,
      status,
      merchant_ref,
      amount,
      event: callbackEvent
    };

    // 7. Simpan log berdasarkan status
    switch (status) {
      case 'PAID':
        fs.appendFileSync('paid_payments.log', JSON.stringify(logData) + '\n');
        console.log(`[${callbackId}] Payment SUCCESS: ${reference}`);
        break;

      case 'FAILED':
        fs.appendFileSync('failed_payments.log', JSON.stringify(logData) + '\n');
        console.warn(`[${callbackId}] Payment FAILED: ${reference}`);
        break;

      case 'EXPIRED':
        fs.appendFileSync('expired_payments.log', JSON.stringify(logData) + '\n');
        console.warn(`[${callbackId}] Payment EXPIRED: ${reference}`);
        break;

      default:
        fs.appendFileSync('unknown_payments.log', JSON.stringify(logData) + '\n');
        console.error(`[${callbackId}] Unknown status: ${status}`);
    }

    // 8. Beri response ke Tripay
    res.status(200).json({
      success: true,
      callback_id: callbackId,
      message: 'Callback processed'
    });

  } catch (error) {
    console.error(`[${callbackId}] Processing error:`, error.stack);
    
    // Tetap return 200 untuk mencegah retry berulang dari Tripay
    res.status(200).json({
      success: false,
      error: 'Processing error but callback accepted'
    });
  }
});

// Payment Return Handler
app.get('/redirect', async (req, res) => {
  try {
    const { status, reference } = req.query;
    
    if (status === 'PAID') {
      res.redirect('/success.html');
    } else {
      res.redirect('/failed.html?reason=' + encodeURIComponent(status || 'unknown'));
    }
  } catch (error) {
    console.error('Redirect error:', error);
    res.redirect('/failed.html?reason=error');
  }
});

// Error Handling
process.on('uncaughtException', err => {
  console.error("Unhandled error:", err);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webstore berjalan di http://localhost:${PORT}`);
});