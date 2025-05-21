// Beli Rank 
function belirank(rank, harga) {
  const username = localStorage.getItem("username");
  
  if (!username) {
    // Show beautiful popup instead of alert
    const popup = document.getElementById('login-prompt-popup');
    const rankNameSpan = document.getElementById('popup-rank-name');
    const cancelBtn = document.getElementById('cancel-login-prompt');
    const confirmBtn = document.getElementById('confirm-login-prompt');
    
    // Set rank name in popup
    rankNameSpan.textContent = rank;
    
    // Show popup
    popup.style.display = 'flex';
    setTimeout(() => {
      popup.classList.add('show');
    }, 10);
    
    // Handle button clicks
    cancelBtn.onclick = () => {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.style.display = 'none';
      }, 300);
    };
    
    confirmBtn.onclick = () => {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.style.display = 'none';
      }, 300);
      
      // Save pending purchase and redirect to login
      localStorage.setItem('pending_rank', rank);
      localStorage.setItem('pending_price', harga);
      window.location.href = '/login/?redirect=/category/ranks/';
    };
    
    return;
  }
  
  // If already logged in, proceed with purchase
  localStorage.setItem('rank', rank);
  localStorage.setItem('harga', harga);
  window.location.href = '/payment/'; 
}