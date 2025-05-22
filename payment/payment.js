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

// Tambahkan di bagian atas file
const configTripay = {
    kodeMerchant: 'T40499',
    privateKey: 'WN7qd-YWXNB-B3Z43-Je36m-uKTGG'
};

// Fungsi untuk generate signature
function generateSignature(merchant_ref, amount) {
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', configTripay.privateKey)
        .update(configTripay.kodeMerchant + merchant_ref + amount)
        .digest('hex');
    return signature;
}

// Fungsi untuk generate kode referensi acak
function generateMerchantRef() {
    return 'INV' + Math.floor(Math.random() * 1000000);
}

async function prosesPembayaran(rank, harga) {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const paymentMethod = document.getElementById('payment-method').value;

    // Validasi form (tetap sama seperti sebelumnya)
    if (!name || !email || !phone || !paymentMethod) {
        alert("Semua field harus diisi!");
        return;
    }

    // Validasi email dan nomor HP (tetap sama)

    try {
        const merchant_ref = generateMerchantRef();
        const signature = generateSignature(merchant_ref, harga);

        // Data untuk dikirim ke API Tripay
        const dataTransaksi = {
            method: paymentMethod,
            merchant_ref: merchant_ref,
            amount: harga,
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            order_items: [
                {
                    name: rank,
                    price: harga,
                    quantity: 1
                }
            ],
            callback_url: 'https://web.glowbit.fun/callback',
            return_url: 'https://web.glowbit.fun/redirect',
            expired_time: Math.floor(Date.now() / 1000) + (60 * 60), // 1 jam dari sekarang
            signature: signature
        };

        // Kirim data ke API Tripay
        const response = await fetch('https://tripay.co.id/api/transaction/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + configTripay.apiKey
            },
            body: JSON.stringify(dataTransaksi)
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
        alert('Terjadi kesalahan saat memproses pembayaran', error);
    }
}