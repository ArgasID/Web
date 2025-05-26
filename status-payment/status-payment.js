// Fungsi utama yang dijalankan saat halaman siap
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Memulai pemeriksaan status pembayaran...');
  
  try {
    // Ambil transactionId dari localStorage
    const transactionId = localStorage.getItem('last_transaction');
    console.log('ID Transaksi dari localStorage:', transactionId);
    
    if (!transactionId) {
      throw new Error('Tidak ada data transaksi terakhir di localStorage');
    }

    // Tampilkan status loading
    perbaruiTampilan('loading', 'Memeriksa status pembayaran...');
    
    // Cek status ke backend
    const response = await fetch(`/api/check-transaction?transaction_id=${encodeURIComponent(transactionId)}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP! Status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Gagal memeriksa status transaksi');
    }

    // Tampilkan detail transaksi
    tampilkanDetailTransaksi(transactionId, result.data);
    
    // Perbarui UI berdasarkan status
    perbaruiTampilan(result.data.status, result.data.checkout_url, transactionId);

  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    tampilkanError(error.message || 'Terjadi kesalahan saat memeriksa status pembayaran');
  }
});

// Fungsi untuk menampilkan detail transaksi
function tampilkanDetailTransaksi(transactionId, dataTransaksi) {
  const detailElement = document.getElementById('transaction-details');
  
  document.getElementById('transaction-id').textContent = transactionId;
  document.getElementById('transaction-username').textContent = dataTransaksi.detail.username;
  document.getElementById('transaction-rank').textContent = dataTransaksi.detail.rank;
  document.getElementById('transaction-amount').textContent = formatRupiah(dataTransaksi.detail.jumlah);
  document.getElementById('transaction-method').textContent = dataTransaksi.detail.metode_pembayaran;
  document.getElementById('transaction-date').textContent = formatTanggal(dataTransaksi.detail.tanggal);
  
  detailElement.style.display = 'block';
}

// Fungsi untuk memperbarui tampilan berdasarkan status
function perbaruiTampilan(status, checkoutUrl, transactionId) {
  const element = {
    icon: document.getElementById('status-icon'),
    judul: document.getElementById('status-title'),
    pesan: document.getElementById('status-message'),
    tombol: document.getElementById('button-container')
  };

  const tampilan = {
    loading: {
      icon: '⏳',
      judul: 'Memeriksa Status Pembayaran',
      pesan: 'Mohon tunggu sebentar...',
      tombol: ''
    },
    PAID: {
      icon: '✓',
      judul: 'Pembayaran Berhasil!',
      pesan: 'Terima kasih! Pembayaran Anda telah berhasil diproses.',
      tombol: `<a href="/" class="tombol tombol-primer">Kembali ke Beranda</a>`
    },
    PENDING: {
      icon: '⌛',
      judul: 'Menunggu Pembayaran',
      pesan: 'Silakan selesaikan pembayaran Anda untuk mengaktifkan rank.',
      tombol: `
        <a href="${checkoutUrl}" class="tombol tombol-primer" target="_blank">Lanjutkan Pembayaran</a>
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `
    },
    EXPIRED: {
      icon: '✗',
      judul: 'Pembayaran Kadaluarsa',
      pesan: 'Waktu pembayaran Anda telah habis. Silakan lakukan transaksi baru.',
      tombol: `
        <a href="/beli-rank" class="tombol tombol-primer">Beli Rank Baru</a>
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `
    },
    FAILED: {
      icon: '✗',
      judul: 'Pembayaran Gagal',
      pesan: 'Pembayaran Anda gagal diproses. Silakan coba lagi.',
      tombol: `
        <a href="${checkoutUrl}" class="tombol tombol-primer" target="_blank">Coba Bayar Lagi</a>
        <a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>
      `
    },
    default: {
      icon: '❓',
      judul: 'Status Tidak Dikenali',
      pesan: `Status: ${status || 'tidak diketahui'}`,
      tombol: `<a href="/" class="tombol tombol-sekunder">Kembali ke Beranda</a>`
    }
  };

  const tampilanStatus = tampilan[status] || tampilan.default;
  
  element.icon.innerHTML = tampilanStatus.icon;
  element.icon.className = `icon-status status-${status.toLowerCase()}`;
  element.judul.textContent = tampilanStatus.judul;
  element.pesan.textContent = tampilanStatus.pesan;
  element.tombol.innerHTML = tampilanStatus.tombol;
}

// Fungsi untuk menampilkan error
function tampilkanError(pesanError) {
  const element = {
    icon: document.getElementById('status-icon'),
    judul: document.getElementById('status-title'),
    pesan: document.getElementById('status-message'),
    tombol: document.getElementById('button-container'),
    detail: document.getElementById('transaction-details')
  };

  element.icon.innerHTML = '❌';
  element.icon.className = 'icon-status status-gagal';
  element.judul.textContent = 'Terjadi Kesalahan';
  element.pesan.textContent = pesanError;
  element.tombol.innerHTML = `
    <a href="/" class="tombol tombol-primer">Kembali ke Beranda</a>
    <a href="/tentang-kami/#Kontak-Kami" class="tombol tombol-sekunder">Hubungi Admin</a>
  `;
  element.detail.style.display = 'none';
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