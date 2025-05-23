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
      
      // Format nomor telepon saat user mengetik
      document.getElementById('phone').addEventListener('input', function(e) {
        this.value = formatPhoneInput(this.value);
      });

      // Proses pembayaran saat form submit
      document.getElementById('payment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        prosesPembayaran(rank, numericHarga);
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
      // Hapus semua karakter non-angka
      let cleaned = phone.replace(/\D/g, '');
      
      // Konversi +62 atau 62 menjadi 0
      if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.slice(2);
      }
      // Pastikan mulai dengan 0
      else if (!cleaned.startsWith('0') && cleaned.length > 0) {
        cleaned = '0' + cleaned;
      }
      
      return cleaned;
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Data pembelian tidak valid. Silakan pilih rank kembali.");
    window.location.href = "/category/ranks/";
  }
});

// Konfigurasi Tripay
const configTripay = {
    kodeMerchant: 'T40499',
    apiKey: 'PCYJ6jKIFZgmMlF26cm5SDLBmbeR678VuBzrZqIF'
};

// Fungsi untuk memproses pembayaran
async function prosesPembayaran(rank, harga) {
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
                'Content-Type': 'application/json'
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

        if (!response.ok) {
            throw new Error(result.message || 'Gagal memproses pembayaran');
        }

        if (result.success && result.data.checkout_url) {
            window.location.href = result.data.checkout_url;
        } else {
            alert(result.message || 'Gagal memproses pembayaran');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message || 'Terjadi kesalahan saat memproses pembayaran'}`);
    }
}

// Fungsi untuk standarisasi nomor telepon
function formatPhoneNumber(inputPhone) {
    // Hapus semua karakter non-angka
    let cleaned = inputPhone.replace(/\D/g, '');
    
    // Konversi +62 atau 62 menjadi 0
    if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.slice(2);
    } 
    // Pastikan mulai dengan 0
    else if (!cleaned.startsWith('0') && cleaned.length > 0) {
        cleaned = '0' + cleaned;
    }
    
    // Validasi panjang nomor
    if (cleaned.length < 10 || cleaned.length > 13) {
        throw new Error("Nomor telepon harus 10-13 digit (contoh: 081234567890)");
    }
    
    return cleaned;
}