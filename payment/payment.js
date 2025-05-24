document.addEventListener("DOMContentLoaded", function() {
  try {
    // Ambil data user dari localStorage (setelah login)
    const username = localStorage.getItem("username");
    const platform = localStorage.getItem("platform");
    
    if (!username) {
      throw new Error("Anda harus login terlebih dahulu");
    }

    // Ambil parameter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const rank = urlParams.get('rank');
    const harga = urlParams.get('harga');
    const numericHarga = parseInt(harga) || 0;

    if (rank && numericHarga > 0) {
      // Tampilkan data pembelian
      document.getElementById("rank-name").textContent = rank.toUpperCase();
      document.getElementById("rank-price").textContent = formatRupiah(numericHarga);
      
      // Format nomor telepon saat user mengetik
      document.getElementById('phone').addEventListener('input', function(e) {
        this.value = formatPhoneInput(this.value);
      });

      // Proses pembayaran saat form submit
      document.getElementById('payment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        prosesPembayaran(rank, numericHarga, username, platform);
      });
    } else {
      throw new Error("Data pembelian tidak valid");
    }

    // Fungsi untuk format rupiah
    function formatRupiah(angka) {
      return "Rp" + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    // Fungsi untuk format input nomor telepon
    function formatPhoneInput(phone) {
      let cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.slice(2);
      } else if (!cleaned.startsWith('0') && cleaned.length > 0) {
        cleaned = '0' + cleaned;
      }
      return cleaned;
    }
  } catch (error) {
    console.error("Error:", error);
    alert(error.message || "Terjadi kesalahan. Silakan coba lagi.");
    window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search);
  }
});

// Fungsi untuk memproses pembayaran
async function prosesPembayaran(rank, harga, username, platform) {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    let phone = document.getElementById('phone').value.trim();
    const paymentMethod = document.getElementById('payment-method').value;

    // Validasi form
    if (!name || !email || !phone || !paymentMethod) {
        alert("Semua kolom harus diisi!");
        return;
    }

    // Validasi email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Format email tidak valid!");
        return;
    }

    // Format nomor telepon
    try {
        phone = formatPhoneNumber(phone);
    } catch (error) {
        alert(error.message);
        return;
    }

    try {
        // Kirim data ke backend
        const response = await fetch('/api/bayar-rank', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Jika menggunakan JWT
            },
            body: JSON.stringify({
                rank,
                harga,
                name,
                email,
                phone,
                paymentMethod,
                username: platform === 'bedrock' ? `.${username}` : username // Format username sesuai platform
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal memproses pembayaran');
        }

        if (result.success && result.data.checkout_url) {
            // Simpan transaction ID untuk tracking
            localStorage.setItem('last_transaction', result.data.transaction_id);
            window.location.href = result.data.checkout_url;
        } else {
            alert(result.message || 'Gagal memproses pembayaran');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message || 'Terjadi kesalahan saat memproses pembayaran'}`);
    }
}

// Fungsi untuk standarisasi nomor telepon (sama seperti sebelumnya)
function formatPhoneNumber(inputPhone) {
    let cleaned = inputPhone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.slice(2);
    } else if (!cleaned.startsWith('0') && cleaned.length > 0) {
        cleaned = '0' + cleaned;
    }
    if (cleaned.length < 10 || cleaned.length > 13) {
        throw new Error("Nomor telepon harus 10-13 digit (contoh: 081234567890)");
    }
    return cleaned;
}