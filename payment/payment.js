document.addEventListener("DOMContentLoaded", function() {
  try {
    // Ambil parameter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const rank = urlParams.get('rank');
    const harga = urlParams.get('harga');
    const numericHarga = parseInt(harga) || 0;

    if (rank && numericHarga > 0) {
      document.getElementById("rank-name").textContent = rank.toUpperCase();
      document.getElementById("rank-price").textContent = formatRupiah(numericHarga);
      
      // Simpan data di form untuk proses pembayaran
      document.getElementById('payment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        prosesPembayaran(rank, numericHarga);
      });
    } else {
      throw new Error("Data pembelian tidak valid");
    }

    function formatRupiah(angka) {
      return "Rp" + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
  } catch (error) {
    console.error("Payment page error:", error);
    alert("Data pembelian tidak valid. Silakan pilih rank kembali.");
    window.location.href = "/category/ranks/";
  }
});

async function prosesPembayaran(rank, harga) {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const paymentMethod = document.getElementById('payment-method').value;

  // Validasi form
  if (!name || !email || !phone || !paymentMethod) {
    alert("Semua field harus diisi!");
    return;
  }

  // Validasi email
  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    alert("Format email tidak valid!");
    return;
  }

  // Validasi nomor WhatsApp
  if (!/^[0-9]{10,13}$/.test(phone)) {
    alert("Nomor WhatsApp harus 10-13 digit angka!");
    return;
  }

  try {
    // Kirim data ke server untuk membuat transaksi
    const response = await fetch('/api/bayar-rank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rank,
        harga,
        name,
        email,
        phone,
        paymentMethod
      })
    });

    const result = await response.json();

    if (result.success && result.data.checkout_url) {
      // Redirect ke halaman pembayaran Tripay
      window.location.href = result.data.checkout_url;
    } else {
      alert(`Gagal memproses pembayaran: ${result.message || 'Error tidak diketahui'}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Terjadi kesalahan saat memproses pembayaran');
  }
}