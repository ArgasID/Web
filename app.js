require('./config');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.get('/', (req, res) => res.redirect('/'));

// Function Config DataBase
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

// Cek Username Di DataBase
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

// Sistem Login
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


// Error handling
process.on('uncaughtException', err => {
  console.error("Unhandled error:", err);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webstore berjalan di http://localhost:${PORT}`);
});

// Tripay Sistem
const tripayConfig = require('./config/tripay');

app.post('/api/bayar-rank', async (req, res) => {
    try {
        const { rank, harga, name, email, phone, paymentMethod } = req.body;
        
        const merchant_ref = 'INV' + Math.floor(Math.random() * 1000000);
        const signature = crypto.createHmac('sha256', tripayConfig.privateKey)
            .update(tripayConfig.kodeMerchant + merchant_ref + harga)
            .digest('hex');

        const dataTransaksi = {
            method: paymentMethod,
            merchant_ref,
            amount: harga,
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            order_items: [{
                name: rank,
                price: harga,
                quantity: 1
            }],
            callback_url: tripayConfig.callbackUrl,
            return_url: tripayConfig.returnUrl,
            expired_time: Math.floor(Date.now() / 1000) + 3600, // 1 jam
            signature
        };

        const tripayResponse = await fetch(tripayConfig.urlBuatTransaksi, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + tripayConfig.apiKey
            },
            body: JSON.stringify(dataTransaksi)
        });

        const result = await tripayResponse.json();
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    checkout_url: result.data.checkout_url
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message || 'Gagal memproses pembayaran'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server'
        });
    }
});

// Handle callback dari Tripay (untuk update status pembayaran)
app.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    
    // 1. Verifikasi signature
    const signature = crypto.createHmac('sha256', tripayConfig.privateKey)
      .update(callbackData.merchant_ref + callbackData.status)
      .digest('hex');

    if (signature !== callbackData.signature) {
      return res.status(403).json({ error: 'Signature tidak valid' });
    }

    // 2. Update status pembayaran di database Anda
    // Contoh:
    // await Database.updatePaymentStatus(callbackData.merchant_ref, callbackData.status);
    
    console.log('Callback received:', callbackData);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error callback:', error);
    res.status(500).send('Error');
  }
});

// Handle return URL (untuk redirect user)
app.get('/redirect', (req, res) => {
  const { status, reference } = req.query;
  
  // Redirect berdasarkan status
  if (status === 'PAID') {
    res.redirect('/success.html');
  } else {
    res.redirect('/failed.html');
  }
});

