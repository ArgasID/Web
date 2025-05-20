document.addEventListener("DOMContentLoaded", function () {
  const rank = localStorage.getItem("rank");
  const harga = localStorage.getItem("harga");

  if (rank && harga) {
    document.getElementById("rank-name").textContent = rank;
    document.getElementById("rank-price").textContent = `Rp${Number(harga).toLocaleString("id-ID")}`;
  } else {
    alert("Data pembelian tidak ditemukan.");
    window.location.href = "/category/ranks/index.html";
  }
});

async function prosesPembayaran() {
  const rank = localStorage.getItem('rank');
  const harga = localStorage.getItem('harga');

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const method = document.getElementById('payment-method').value;

  if (!rank || !harga || !name || !email || !phone || !method) {
    alert("Semua field harus diisi.");
    return;
  }

  try {
    const res = await fetch('/api/bayar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, rank, harga, name, email, phone })
    });

    const data = await res.json();

    if (data.success && data.data?.checkout_url) {
      window.location.href = data.data.checkout_url;
    } else {
      alert('Gagal memproses pembayaran.');
      console.error(data);
      console.log(data);
    }
  } catch (err) {
    alert("Terjadi kesalahan saat menghubungi server.");
    console.error(err);
    console.log(data);
  }
}