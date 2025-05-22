// Fungsi untuk memformat harga
function formatHarga(harga) {
  if (typeof harga === 'number') return harga;
  const num = parseInt(harga.toString().replace(/\D/g, '')) || 0;
  return num > 0 ? num : 0;
}

// Fungsi utama beli rank
function belirank(rank, harga) {
  try {
    if (!rank || !harga) {
      throw new Error("Rank atau harga tidak valid");
    }

    const numericHarga = formatHarga(harga);
    console.log(`Membeli rank ${rank} seharga Rp${numericHarga.toLocaleString('id-ID')}`);
    
    const username = localStorage.getItem("username");
    
    if (!username) {
      showLoginPopup(rank, numericHarga);
      return;
    }
    
    // Langsung redirect ke payment dengan parameter URL
    window.location.href = `/payment/?rank=${encodeURIComponent(rank)}&harga=${numericHarga}`;
  } catch (error) {
    console.error("Error in belirank:", error);
    alert("Terjadi kesalahan saat memproses pembelian");
  }
}

// Tampilkan popup login
function showLoginPopup(rank) {
  const popup = document.getElementById('login-prompt-popup');
  const rankNameSpan = document.getElementById('popup-rank-name');
  
  if (!popup || !rankNameSpan) {
    console.error("Element popup tidak ditemukan");
    return;
  }
  
  // Set rank name in popup
  rankNameSpan.textContent = rank;
  
  // Tampilkan popup
  popup.style.display = 'flex';
  setTimeout(() => popup.classList.add('show'), 10);
  
  // Handle tombol
  document.getElementById('cancel-login-prompt').onclick = () => hidePopup(popup);
  document.getElementById('confirm-login-prompt').onclick = () => {
    hidePopup(popup);
    savePendingPurchase(rank);
    window.location.href = `/login/?redirect=${encodeURIComponent(window.location.pathname)}`;
  };
}

// Sembunyikan popup
function hidePopup(popup) {
  popup.classList.remove('show');
  setTimeout(() => popup.style.display = 'none', 300);
}

// Simpan data pembelian tertunda
function savePendingPurchase(rank) {
  const hargaElements = document.querySelectorAll(`.rank-card[data-rank="${rank.toLowerCase()}"] .price`);
  if (hargaElements.length > 0) {
    const harga = formatHarga(hargaElements[0].textContent);
    localStorage.setItem('selected_rank', rank);
    localStorage.setItem('selected_price', harga.toString());
    localStorage.setItem('pending_purchase', 'true');
  }
}

// Inisialisasi event listener untuk semua tombol beli
document.addEventListener('DOMContentLoaded', function() {
  const buttons = document.querySelectorAll('.buy-rank-btn');
  
  buttons.forEach(button => {
    if (!button.hasAttribute('onclick')) {
      const rankCard = button.closest('.rank-card');
      const rank = rankCard.getAttribute('data-rank');
      const price = rankCard.querySelector('.price').textContent;
      
      button.addEventListener('click', () => belirank(rank.toUpperCase(), price));
    }
  });
});