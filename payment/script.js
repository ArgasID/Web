async function generateQR() {
  const username = document.getElementById('username').value;
  const amount = document.getElementById('amount').value;

  if (!username || !amount) {
    alert("Isi username dan jumlah.");
    return;
  }

  try {
    const response = await fetch('/create-qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, amount })
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      document.getElementById('qrPreview').innerHTML = `<img src="${url}" alt="QR Code">`;
    } else {
      const err = await response.json();
      alert("Gagal: " + err.message);
    }
  } catch (error) {
    console.error(error);
    alert("Terjadi kesalahan.");
  }
}