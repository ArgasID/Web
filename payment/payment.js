document.addEventListener("DOMContentLoaded", function () {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const rank = urlParams.get("rank");
    const harga = urlParams.get("harga");
    const numericHarga = parseInt(harga) || 0;

    if (rank && numericHarga > 0) {
      document.getElementById("rank-name").textContent = rank.toUpperCase();
      document.getElementById("rank-price").textContent = formatRupiah(numericHarga);

      document.getElementById("payment-form").addEventListener("submit", function (e) {
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
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const paymentMethod = document.getElementById("payment-method").value;

  if (!name || !email || !phone || !paymentMethod) {
    alert("Semua field harus diisi!");
    return;
  }

  try {
    const response = await fetch("/api/bayar-rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank, harga, name, email, phone, paymentMethod })
    });

    const result = await response.json();

    if (result.success && result.data.checkout_url) {
      window.location.href = result.data.checkout_url;
    } else {
      alert("Gagal memproses pembayaran: " + (result.message || "Error tidak diketahui"));
    }
  } catch (error) {
    console.error("Error saat memproses pembayaran:", error);
    alert("Terjadi kesalahan saat memproses pembayaran.");
  }
}