require('./config');
const session = require('express-session');
const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'bsfsgrsety',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middleware untuk mengecek auth
function requireAuth(req, res, next) {
  if (!req.session.username) {
    return res.status(401).json({
      success: false,
      message: 'Anda harus login terlebih dahulu'
    });
  }
  next();
}

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Database configuration with auto-create tables
const db = {
  conn: null,

  async connect() {
    this.conn = await mysql.createConnection(global.dbConfig);
    await this.createTables();
  },

  async query(sql, params) {
    if (!this.conn) await this.connect();
    const [rows] = await this.conn.execute(sql, params || []);
    return rows;
  },

  async createTables() {
    try {
      await this.conn.execute(`
        CREATE TABLE IF NOT EXISTS players (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(50) NOT NULL UNIQUE,
          uuid VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.conn.execute(`
        CREATE TABLE IF NOT EXISTS pending_commands (
          id INT AUTO_INCREMENT PRIMARY KEY,
          command TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.conn.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(50) NOT NULL,
        merchant_ref VARCHAR(50) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        amount INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        payment_method VARCHAR(50) NOT NULL,
        checkout_url TEXT NOT NULL,
        username VARCHAR(50) NOT NULL,
        rank VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_id),
        UNIQUE(merchant_ref)
      )
    `);

      await this.conn.execute(`
        CREATE TABLE IF NOT EXISTS transaction_errors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          transaction_id VARCHAR(50),
          merchant_ref VARCHAR(50),
          error_message TEXT NOT NULL,
          response_data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Database tables verified/created');
    } catch (err) {
      console.error('Error creating tables:', err);
      throw err;
    }
  }
};

// Initialize database connection
db.connect().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

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
    const { username, platform } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username kosong.' 
      });
    }

    // Cek username di database
    const rows = await db.query('SELECT * FROM players WHERE name = ?', [username]);
    
    if (rows.length > 0) {
      // Set session
      req.session.username = username;
      req.session.platform = platform;
      
      res.json({ 
        success: true,
        username: username,
        platform: platform
      });
    } else {
      res.status(404).json({ 
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
  baseUrl: 'https://tripay.co.id/api',
  callbackUrl: 'https://web.glowbit.fun/callback',
  returnUrl: 'https://web.glowbit.fun/redirect'
};

function formatRankName(rank) {
  if (!rank) return 'Rank';
  const words = rank.toLowerCase().split(' ');
  const formatted = words.map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toUpperCase()
  ).join(' ');
  return `Rank ${formatted}`;
}

// Endpoint pembayaran
app.post('/api/bayar-rank', requireAuth, async (req, res) => {
  const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    const { rank, harga, name, email, phone, paymentMethod } = req.body;
    const username = req.session.username; // Ambil dari session atau body

    // Input validation
    if (!rank || !harga || !name || !email || !phone || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Semua field harus diisi'
      });
    }

    const amount = parseInt(harga);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah pembayaran tidak valid'
      });
    }
    
    // Validasi username
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username harus diisi'
      });
    }

    // Generate references
    const merchant_ref = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const signature = crypto.createHmac('sha256', tripayConfig.privateKey)
      .update(tripayConfig.kodeMerchant + merchant_ref + amount)
      .digest('hex');

    // Prepare transaction data
    const transactionData = {
      method: paymentMethod,
      merchant_ref,
      amount,
      customer_name: name,
      customer_email: email,
      customer_phone: phone.startsWith('0') ? '62' + phone.slice(1) : phone,
      order_items: [{
        name: formatRankName(rank),
        price: amount,
        quantity: 1
      }],
      callback_url: tripayConfig.callbackUrl,
      return_url: tripayConfig.returnUrl,
      expired_time: Math.floor(Date.now() / 1000) + 300,
      signature
    };

    // Send to Tripay (with proper absolute URL)
    const tripayUrl = `${tripayConfig.baseUrl}/transaction/create`;
    console.log('Sending to:', tripayUrl); // Debug log
    
    const tripayResponse = await fetch(tripayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tripayConfig.apiKey}`
      },
      body: JSON.stringify(transactionData)
    });

    const result = await tripayResponse.json();
    console.log('Tripay response:', result); // Debug log

    if (!tripayResponse.ok) {
      throw new Error(result.message || 'Gagal memproses pembayaran');
    }

    // Save transaction
    await db.query(
      `INSERT INTO transactions 
      (transaction_id, merchant_ref, customer_name, email, phone, amount, status, payment_method, checkout_url, username, rank)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [transactionId, merchant_ref, name, email, phone, amount, paymentMethod, 
       result.data.checkout_url, username, rank]
    );

    res.json({
      success: true,
      data: {
        checkout_url: result.data.checkout_url,
        transaction_id: transactionId
      }
    });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan server'
    });
  }
});

// Fungsi format nomor telepon (untuk callback)
function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.slice(2);
    }
    return cleaned;
}

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
      console.error(`[${callbackId}] Header tidak lengkap`);
      return res.status(400).send('Bad Request');
    }

    // 2. Generate signature
    const generatedSignature = crypto
      .createHmac('sha256', tripayConfig.privateKey)
      .update(JSON.stringify(jsonData))
      .digest('hex');

    // 3. Verifikasi signature
    if (generatedSignature !== callbackSignature) {
      console.error(`[${callbackId}] Signature tidak cocok`);
      return res.status(403).send('Forbidden');
    }

    // 4. Validasi event type
    if (callbackEvent !== 'payment_status') {
      console.error(`[${callbackId}] Event tidak valid: ${callbackEvent}`);
      return res.status(400).send('Invalid Event Type');
    }

    // 5. Validasi data transaksi
    const { reference, status, merchant_ref, total_amount } = jsonData;
    if (!reference || !status || !merchant_ref || total_amount === undefined) {
      console.error(`[${callbackId}] Data transaksi tidak lengkap`, jsonData);
      return res.status(400).send('Incomplete Transaction Data');
    }

    // 6. Proses status pembayaran
    console.log(`[${callbackId}] Memproses status pembayaran:`, { reference, status });

    const logDir = 'payment_logs';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    
    // Update status transaksi di database
    await db.query(
      "UPDATE transactions SET status = ? WHERE merchant_ref = ?",
      [status, merchant_ref]
    );

    // Log data transaksi
    const logData = {
      timestamp: new Date().toISOString(),
      callback_id: callbackId,
      reference,
      status,
      merchant_ref,
      total_amount,
      event: callbackEvent,
      ...jsonData
    };

    // Simpan log berdasarkan status
    switch (status) {
      case 'PAID':
        fs.appendFileSync(`${logDir}/paid_payments.log`, JSON.stringify(logData) + '\n');
        console.log(`[${callbackId}] Pembayaran BERHASIL: ${reference}`);
        break;
      case 'FAILED':
        fs.appendFileSync(`${logDir}/failed_payments.log`, JSON.stringify(logData) + '\n');
        console.warn(`[${callbackId}] Pembayaran GAGAL: ${reference}`);
        break;
      case 'EXPIRED':
        fs.appendFileSync(`${logDir}/expired_payments.log`, JSON.stringify(logData) + '\n');
        console.warn(`[${callbackId}] Pembayaran KADALUARSA: ${reference}`);
        break;
      default:
        fs.appendFileSync(`${logDir}/unknown_payments.log`, JSON.stringify(logData) + '\n');
        console.error(`[${callbackId}] Status tidak dikenal: ${status}`);
    }

    // 7. Jika pembayaran berhasil, proses rank assignment
    if (status === 'PAID') {
      const [transaction] = await db.query(
        "SELECT username, rank FROM transactions WHERE merchant_ref = ?",
        [merchant_ref]
      );

      if (transaction && transaction.username && transaction.rank) {
        let userIdentifier = transaction.username;

        // Handle Bedrock player (username diawali dengan titik)
        if (transaction.username.startsWith('.')) {
          const [player] = await db.query(
            "SELECT uuid FROM players WHERE name = ?", 
            [transaction.username]
          );
          
          if (player && player.uuid) {
            userIdentifier = player.uuid;
          }
        }

        // Simpan perintah LuckyPerms
        const command = `lp user ${userIdentifier} parent set ${transaction.rank}`;
        await db.query(
          "INSERT INTO pending_commands (command) VALUES (?)", 
          [command]
        );

        console.log(`[${callbackId}] Perintah rank disimpan: ${command}`);
      }
    }

    // 8. Beri response ke Tripay
    res.status(200).json({
      success: true,
      callback_id: callbackId,
      message: 'Callback berhasil diproses'
    });

  } catch (error) {
    console.error(`[${callbackId}] Error proses callback:`, error);
    
    // Tetap return 200 untuk mencegah retry dari Tripay
    res.status(200).json({
      success: false,
      callback_id: callbackId,
      message: 'Error tetapi callback diterima'
    });
  }
});

// Payment Return Handler
app.get('/redirect', (req, res) => {
  try {
    res.redirect('/status-payment/');
  } catch (error) {
    console.error('Error saat redirect:', error);
    res.redirect('/status-payment/');
  }
});

// Endpoint untuk mendapatkan status transaksi
app.get('/api/check-transaction', async (req, res) => {
  try {
    // Ambil transaction_id dari query parameter
    const { transaction_id } = req.query;
    
    if (!transaction_id) {
      return res.status(400).json({ 
        success: false,
        message: 'Parameter transaction_id diperlukan'
      });
    }

    // Cari transaksi di database
    const [transaksi] = await db.query(
      `SELECT 
        status, 
        checkout_url,
        username,
        rank,
        amount,
        payment_method,
        created_at
       FROM transactions 
       WHERE transaction_id = ?`,
      [transaction_id]
    );

    if (!transaksi) {
      return res.status(404).json({ 
        success: false,
        message: 'Transaksi tidak ditemukan di database'
      });
    }

    // Format data untuk response
    const dataResponse = {
      status: transaksi.status,
      checkout_url: transaksi.checkout_url,
      detail: {
        username: transaksi.username,
        rank: transaksi.rank,
        jumlah: transaksi.amount,
        metode_pembayaran: transaksi.payment_method,
        tanggal: transaksi.created_at
      }
    };

    res.json({
      success: true,
      message: 'Data transaksi berhasil ditemukan',
      data: dataResponse
    });

  } catch (error) {
    console.error('Error saat memeriksa transaksi:', error);
    res.status(500).json({ 
      success: false,
      message: 'Terjadi kesalahan server saat memproses permintaan'
    });
  }
});

// Error Handling - Diperbarui
process.on('uncaughtException', (err) => {
  console.error("Critical Error:", err);
  // Optional: Notifikasi ke sistem monitoring
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "Reason:", reason);
});

// Start Server
db.connect().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webstore berjalan di http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});