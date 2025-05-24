// Fungsi utama yang dijalankan saat halaman siap
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Memulai pemeriksaan status pembayaran...');
  
  try {
    // Ambil transactionId dari localStorage
    const transactionId = localStorage.getItem('last_transaction');
    console.log('ID Transaksi dari localStorage:', transactionId);
    
    if (!transactionId) {
      console.error('Tidak ada data transaksi terakhir di localStorage');
      tampilkanError('Tidak ada data transaksi terakhir. Silakan lakukan transaksi baru.');
      return;
    }

    // Tampilkan status loading
    perbaruiUI('loading', 'Memeriksa status pembayaran...');
    
    // Cek status ke backend
    const response = await fetch(`/api/check-transaction?transaction_id=${encodeURIComponent(transactionId)}`);
    console.log('Response dari server:', response);
    
    if (!response.ok) {
      throw new Error(`Error HTTP! Status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Data transaksi:', result);
    
    if (!result.success) {
      throw new Error(result.message || 'Gagal memeriksa status transaksi');
    }

    // Tampilkan detail transaksi
    tampilkanDetailTransaksi(transactionId, result.data);
    
    // Perbarui UI berdasarkan status
    perbaruiUI(result.data.status, result.data.checkout_url, transactionId);

  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    tampilkanError('Terjadi kesalahan saat memeriksa status pembayaran. Silakan coba lagi atau hubungi admin.');
  }
});

// Fungsi untuk menampilkan detail transaksi
function tampilkanDetailTransaksi(transactionId, dataTransaksi) {
  console.log('Menampilkan detail transaksi untuk ID:', transactionId);
  
  document.getElementById('transaction-id').textContent = transactionId;
  document.getElementById('transaction-username').textContent = dataTransaksi.detail.username;
  document.getElementById('transaction-rank').textContent = dataTransaksi.detail.rank;
  document.getElementById('transaction-amount').textContent = formatRupiah(dataTransaksi.detail.jumlah);
  document.getElementById('transaction-method').textContent = dataTransaksi.detail.metode_pembayaran;
  document.getElementById('transaction-date').textContent = formatTanggal(dataTransaksi.detail.tanggal);
  
  document.getElementById('transaction-details').style.display = 'block';
}

// Fungsi untuk memperbarui UI berdasarkan status
function perbaruiUI(status, checkoutUrl, transactionId) {
  console.log('Memperbarui UI untuk status:', status);
  
  const elementIcon = document.getElementById('status-icon');
  const elementJudul = document.getElementById('status-title');
  const elementPesan = document.getElementById('status-message');
  const containerTombol = document.getElementById('button-container');
  
  let icon, judul, pesan, tombolHTML;

  switch(status) {
    case 'PAID':
      icon = '✓';
      judul = 'Pembayaran Berhasil!';
      pesan = 'Terima kasih! Pembayaran Anda telah berhasil diproses.';
      tombolHTML = `
        <a href="/" class="tombol tombol-sukses">Kembali ke Beranda</a>
      `;
      break;

    case 'PENDING':
      icon = '⌛';
      judul = 'Menunggu Pembayaran';
      pesan = 'Silakan selesaikan pembayaran Anda untuk mengaktifkan rank.';
      tombolHTML = `
        <a href="${checkoutUrl}" class="tombol tombol-primer" target="_blank">Lanjutkan Pembayaran</a>
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `;
      break;

    case 'EXPIRED':
      icon = '✗';
      judul = 'Pembayaran Kadaluarsa';
      pesan = 'Waktu pembayaran Anda telah habis. Silakan lakukan transaksi baru.';
      tombolHTML = `
        <a href="/beli-rank" class="tombol tombol-primer">Beli Rank Baru</a>
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `;
      break;

    case 'FAILED':
      icon = '✗';
      judul = 'Pembayaran Gagal';
      pesan = 'Pembayaran Anda gagal diproses. Silakan coba lagi.';
      tombolHTML = `
        <a href="${checkoutUrl}" class="tombol tombol-primer" target="_blank">Coba Bayar Lagi</a>
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `;
      break;

    default:
      icon = '❓';
      judul = 'Status Tidak Dikenali';
      pesan = `Status: ${status || 'tidak diketahui'}`;
      tombolHTML = `
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `;
  }

  elementIcon.innerHTML = icon;
  elementIcon.className = `icon-status status-${status.toLowerCase()}`;
  elementJudul.textContent = judul;
  elementPesan.textContent = pesan;
  containerTombol.innerHTML = tombolHTML;
}

// Fungsi untuk menampilkan error
function tampilkanError(pesanError) {
  console.error('Menampilkan pesan error:', pesanError);
  
  const elementIcon = document.getElementById('status-icon');
  const elementJudul = document.getElementById('status-title');
  const elementPesan = document.getElementById('status-message');
  const containerTombol = document.getElementById('button-container');

  elementIcon.innerHTML = '❌';
  elementIcon.className = 'icon-status status-gagal';
  elementJudul.textContent = 'Terjadi Kesalahan';
  elementPesan.textContent = pesanError;
  containerTombol.innerHTML = `
    <a href="/" class="tombol tombol-gagal">Kembali ke Beranda</a>
    <a href="/kontak" class="tombol tombol-sekunder">Hubungi Admin</a>
  `;
}

// Fungsi pembantu untuk format Rupiah
function formatRupiah(jumlah) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(jumlah);
}

// Fungsi pembantu untuk format tanggal
function formatTanggal(tanggal) {
  return new Date(tanggal).toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}