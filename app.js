require('./config');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

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

// Tripay Payment System
const tripayConfig = require('./config/tripay');

// Create Payment
app.post('/api/bayar-rank', async (req, res) => {
  const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const fs = require('fs');
  
  try {
    console.log(`[${transactionId}] Payment request received`);
    
    // Validate input
    const { rank, harga, name, email, phone, paymentMethod } = req.body;
    const requiredFields = { rank, harga, name, email, phone, paymentMethod };
    
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        console.warn(`[${transactionId}] Missing field: ${field}`);
        return res.status(400).json({
          success: false,
          message: `Field ${field} harus diisi`
        });
      }
    }

    // Generate transaction reference
    const merchant_ref = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const signature = crypto.createHmac('sha256', tripayConfig.privateKey)
      .update(tripayConfig.kodeMerchant + merchant_ref + harga)
      .digest('hex');

    // Prepare transaction data
    const transactionData = {
      method: paymentMethod,
      merchant_ref,
      amount: harga,
      customer_name: name,
      customer_email: email,
      customer_phone: phone.replace(/^0/, '62'), // Convert to international format
      order_items: [{
        name: `Rank ${rank}`,
        price: harga,
        quantity: 1
      }],
      callback_url: tripayConfig.callbackUrl,
      return_url: tripayConfig.returnUrl,
      expired_time: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      signature
    };

    console.log(`[${transactionId}] Sending to Tripay:`, transactionData);

    // Send to Tripay API
    const tripayResponse = await fetch(tripayConfig.urlBuatTransaksi, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tripayConfig.apiKey}`
      },
      body: JSON.stringify(transactionData)
    });

    const result = await tripayResponse.json();

    if (!tripayResponse.ok) {
      console.error(`[${transactionId}] Tripay API error:`, result);
      throw new Error(result.message || 'Gagal memproses pembayaran');
    }

    if (result.success) {
      console.log(`[${transactionId}] Payment created successfully`);
      
      // Log transaction to file instead of database
      const logEntry = {
        timestamp: new Date().toISOString(),
        transaction_id: transactionId,
        merchant_ref,
        customer_name: name,
        email,
        phone,
        amount: harga,
        status: 'PENDING',
        payment_method: paymentMethod,
        checkout_url: result.data.checkout_url
      };
      
      fs.appendFileSync('transactions.log', JSON.stringify(logEntry) + '\n');

      return res.json({
        success: true,
        data: {
          checkout_url: result.data.checkout_url,
          transaction_id: transactionId
        }
      });
    } else {
      console.error(`[${transactionId}] Tripay payment failed:`, result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Gagal memproses pembayaran'
      });
    }
  } catch (error) {
    console.error(`[${transactionId}] Error:`, error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

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