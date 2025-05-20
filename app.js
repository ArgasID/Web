require('./config');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// Configuration constants
const PORT = process.env.PORT || 3000;
const {
  tripayApiKey,
  tripayPrivateKey,
  tripayMerchantCode: merchantCode
} = global.qrConfig;

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Database helper functions
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

// Tripay helper functions
const tripay = {
  generateSignature(merchantRef, amount) {
    return crypto.createHmac('sha256', tripayPrivateKey)
      .update(merchantCode + merchantRef + amount)
      .digest('hex');
  },

  async createTransaction(payload) {
    const response = await axios.post(
      'https://tripay.co.id/api-sandbox/transaction/create',
      payload,
      {
        headers: { Authorization: `Bearer ${tripayApiKey}` }
      }
    );
    return response.data.data;
  }
};

// Routes
app.get('/', (req, res) => res.redirect('/login/'));

// User-related routes
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

// Purchase routes
app.post('/buy', async (req, res) => {
  try {
    const { username, rank } = req.body;
    if (!username || !rank) {
      return res.status(400).json({ 
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
      message: `Berhasil membeli rank ${rank} untuk ${username}` 
    });
  } catch (err) {
    console.error("Gagal menyimpan perintah:", err);
    res.status(500).json({ 
      message: "Terjadi kesalahan server." 
    });
  }
});

app.post('/callback', async (req, res) => {
  try {
    const { method, rank, harga, username } = req.body;
    if (!method || !rank || !harga || !username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Data tidak lengkap' 
      });
    }

    const merchantRef = 'ORDER-' + Date.now();
    const signature = tripay.generateSignature(merchantRef, harga);

    const payload = {
      method,
      merchant_ref: merchantRef,
      amount: harga,
      customer_name: username,
      order_items: [{
        sku: rank,
        name: `Rank ${rank}`,
        price: harga,
        quantity: 1
      }],
      callback_url: 'https://web-production-6c47a.up.railway.app/api/callback',
      return_url: 'https://web-production-6c47a.up.railway.app/payment/success.html',
      signature
    };

    const transactionData = await tripay.createTransaction(payload);
    res.json({ success: true, data: transactionData });
  } catch (err) {
    console.error('Tripay Error:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal membuat transaksi Tripay' 
    });
  }
});

app.post('/callback', express.json(), (req, res) => {
  const data = req.body;
  console.log('Tripay Callback:', data);
  // TODO: validasi signature & update database status pembayaran
  res.status(200).send('OK');
});

// Error handling
process.on('uncaughtException', err => {
  console.error("Unhandled error:", err);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webstore berjalan di http://localhost:${PORT}`);
});