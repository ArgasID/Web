document.addEventListener('DOMContentLoaded', function() {
  // Select all payment cards
  const paymentCards = document.querySelectorAll('.payment-card');
  
  // Add click event to each payment card
  paymentCards.forEach(card => {
    card.addEventListener('click', function() {
      // Remove selected class from all cards
      paymentCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      this.classList.add('selected');
      
      // Update check icons
      paymentCards.forEach(c => {
        const checkIcon = c.querySelector('.payment-check i');
        if (c.classList.contains('selected')) {
          checkIcon.classList.remove('far', 'fa-circle');
          checkIcon.classList.add('fas', 'fa-check-circle');
        } else {
          checkIcon.classList.remove('fas', 'fa-check-circle');
          checkIcon.classList.add('far', 'fa-circle');
        }
      });
    });
  });
  
  // Confirm button click event
  const confirmBtn = document.querySelector('.confirm-btn');
  confirmBtn.addEventListener('click', function() {
    const selectedMethod = document.querySelector('.payment-card.selected h3').textContent;
    alert(`Anda memilih metode pembayaran: ${selectedMethod}\nPembayaran akan diproses...`);
  });
});