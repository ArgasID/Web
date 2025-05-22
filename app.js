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
      
      // Save to database
      await db.query(
        `INSERT INTO transactions 
        (transaction_id, merchant_ref, customer_name, email, phone, amount, status, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
        [transactionId, merchant_ref, name, email, phone, harga, paymentMethod]
      );

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
  console.log(`[${callbackId}] Callback received:`, req.body);

  try {
    const callbackData = req.body;

    // Validate required fields
    const requiredFields = ['merchant_ref', 'status', 'signature', 'reference'];
    for (const field of requiredFields) {
      if (!callbackData[field]) {
        console.error(`[${callbackId}] Missing field: ${field}`);
        return res.status(400).send('Bad Request');
      }
    }

    // Verify signature
    const generatedSignature = crypto.createHmac('sha256', tripayConfig.privateKey)
      .update(callbackData.merchant_ref + callbackData.status)
      .digest('hex');

    if (generatedSignature !== callbackData.signature) {
      console.error(`[${callbackId}] Invalid signature`);
      return res.status(403).send('Forbidden');
    }

    // Update transaction status
    await db.query(
      `UPDATE transactions 
      SET status = ?, tripay_reference = ?, updated_at = NOW()
      WHERE merchant_ref = ?`,
      [callbackData.status, callbackData.reference, callbackData.merchant_ref]
    );

    console.log(`[${callbackId}] Transaction updated:`, callbackData.merchant_ref);
    res.status(200).send('OK');
  } catch (error) {
    console.error(`[${callbackId}] Callback error:`, error);
    res.status(200).send('OK'); // Always return 200 to Tripay
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