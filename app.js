require('./config');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Middleware
app.use(express.json());
// Serve semua file HTML dan aset dari root folder
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.redirect('/login/');
});
// Cek apakah username ada di database
app.post('/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ exists: false });

  try {
    const conn = await mysql.createConnection(global.dbConfig);
    const [rows] = await conn.execute("SELECT name FROM players WHERE name = ?", [username]);
    await conn.end();

    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ exists: false });
  }
});

// Login user
app.post('/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'Username kosong.' });

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM players WHERE name = ?', [username]);
    await conn.end();

    if (rows.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Username tidak ditemukan.' });
    }
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Proses pembelian rank
app.post('/buy', async (req, res) => {
  const { username, rank } = req.body;
  if (!username || !rank) return res.status(400).json({ message: "Data tidak lengkap." });

  try {
    const conn = await mysql.createConnection(dbConfig);
    let userIdentifier = username;

    if (username.startsWith('.')) {
      const [rows] = await conn.execute("SELECT uuid FROM players WHERE name = ?", [username]);
      if (rows.length > 0 && rows[0].uuid) {
        userIdentifier = rows[0].uuid;
      } else {
        await conn.end();
        return res.status(404).json({ message: "UUID untuk Bedrock player tidak ditemukan." });
      }
    }

    const command = `lp user ${userIdentifier} parent set ${rank}`;
    await conn.execute("INSERT INTO pending_commands (command) VALUES (?)", [command]);
    await conn.end();

    console.log(`Command disimpan ke database: ${command}`);
    res.json({ message: `Berhasil membeli rank ${rank} untuk ${username}` });
  } catch (err) {
    console.error("Gagal menyimpan perintah:", err);
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Webstore berjalan di http://localhost:${PORT}`);
});

// Tangkap error global
process.on('uncaughtException', err => {
  console.error("Unhandled error:", err);
});

// Qr Sistem
app.post('/create-qris', async (req, res) => {
  const { username, amount } = req.body;
  if (!username || !amount) return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });

  try {
    const reference = 'REF' + Date.now();
    const { qrBuffer } = await global.qrConfig.generateQR(amount);

    // (Opsional: simpan `reference`, `username`, `amount` di DB untuk dilacak)

    res.type('image/png').send(qrBuffer); // Atau kirim base64 jika perlu frontend tampilkan QR-nya
  } catch (err) {
    console.error('Gagal membuat QR:', err.message);
    res.status(500).json({ success: false, message: 'Gagal membuat QRIS.' });
  }
});