/**
 * Glowbit Network - Main Script
 * 
 * Modul utama untuk menangani:
 * - UI interactions
 * - Server status monitoring
 * - User authentication
 */

document.addEventListener("DOMContentLoaded", function () {
  // Initialize all modules
  initMenuToggle();
  initProfileDropdown();
  initScrollAnimations();
  initUserProfile();
  initLogout();
  initCopyButtons();
  initNavbarScroll();
  initServerStatus();
  initInfoButtons();
  initBuyRankButtons();
});

// ==================== MODULES ====================

/**
 * Menu Toggle Module - Handles mobile menu toggle
 */
function initMenuToggle() {
  const toggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (toggle && navMenu) {
    toggle.addEventListener("click", () => {
      navMenu.classList.toggle("show");
      toggle.classList.toggle("active");
    });
  }
}

/**
 * Profile Dropdown Module - Handles profile dropdown toggle
 */
function initProfileDropdown() {
  const profileDropdown = document.getElementById("profile-dropdown");
  const dropdownMenu = document.getElementById("dropdown-menu");

  if (profileDropdown && dropdownMenu) {
    profileDropdown.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", function () {
      dropdownMenu.style.display = "none";
    });
  }
}

/**
 * Scroll Animations Module - Handles scroll-triggered animations
 */
function initScrollAnimations() {
  function handleScrollAnimation() {
    const elements = document.querySelectorAll("[data-scroll]");
    const triggerBottom = window.innerHeight * 0.85;

    elements.forEach(el => {
      const boxTop = el.getBoundingClientRect().top;
      if (boxTop < triggerBottom) {
        el.classList.add("visible");
      } else {
        el.classList.remove("visible");
      }
    });
  }

  window.addEventListener("scroll", handleScrollAnimation);
  window.addEventListener("load", handleScrollAnimation);
}

/**
 * User Profile Module - Handles user profile display and authentication
 */
function initUserProfile() {
  const displayNameElements = document.querySelectorAll(".display-name, #profile-username");
  const profilePic = document.getElementById("profile-pic");
  const logoutBtn = document.getElementById("logout-btn");
  const profileDropdown = document.getElementById("profile-dropdown");

  // Cek status login
  const username = localStorage.getItem("username");
  const isAuthenticated = !!username;

  // Update tampilan profil
  if (profileDropdown) {
    if (isAuthenticated) {
      // Tampilkan data user yang login
      displayNameElements.forEach(el => {
        if (el) el.textContent = username;
      });
      
      if (logoutBtn) {
        logoutBtn.style.display = "block";
        // Hapus tombol login jika ada
        const existingLoginBtn = document.getElementById('login-btn');
        if (existingLoginBtn) existingLoginBtn.remove();
      }

      // Set avatar
      if (profilePic) {
        profilePic.src = `https://mc-heads.net/avatar/${username}/100`;
        profilePic.onerror = () => {
          profilePic.src = "https://mc-heads.net/avatar/steve/100";
        };
      }
    } else {
      // Tampilkan state guest
      displayNameElements.forEach(el => {
        if (el) el.textContent = "Guest";
      });

      if (profilePic) {
        profilePic.src = "https://mc-heads.net/avatar/steve/100";
      }

      if (logoutBtn) {
        logoutBtn.style.display = "none";
      }

      // Tambahkan tombol login jika belum ada
      if (!document.getElementById('login-btn')) {
        const loginBtn = document.createElement('button');
        loginBtn.id = 'login-btn';
        loginBtn.textContent = 'Login';
        loginBtn.addEventListener('click', () => {
          window.location.href = '/login/';
        });

        const dropdownMenu = document.getElementById('dropdown-menu');
        if (dropdownMenu) {
          // Pastikan hr ada sebelum menambahkan tombol login
          const hr = dropdownMenu.querySelector('hr');
          if (!hr) {
            dropdownMenu.insertAdjacentHTML('beforeend', '<hr>');
          }
          dropdownMenu.appendChild(loginBtn);
        }
      }
    }
  }
}

/**
 * Update tombol beli rank untuk cek status login
 */
function initBuyRankButtons() {
  const buyButtons = document.querySelectorAll('.buy-rank-btn');
  
  buyButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const isAuthenticated = !!localStorage.getItem("username");
      
      if (!isAuthenticated) {
        e.preventDefault();
        showNotification('Silakan login terlebih dahulu untuk membeli rank', false);
        setTimeout(() => {
          window.location.href = '/login/';
        }, 2000);
      } else {
        // Lanjutkan proses pembelian
        const rank = this.closest('.rank-card').getAttribute('data-rank');
        const price = this.closest('.rank-card').querySelector('.price').textContent;
        belirank(rank, price);
      }
    });
  });
}

/**
 * Logout Module - Handles user logout
 */
function initLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("username");
      localStorage.removeItem("avatar");
      window.location.href = "/login/";
    });
  }
}

/**
 * Copy Buttons Module - Handles copy-to-clipboard functionality
 */
function initCopyButtons() {
  window.copyToClipboard = function (button, text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        showTooltip(button);
      })
      .catch((err) => {
        console.error("Gagal menyalin teks:", err);
        showNotification("Gagal menyalin IP", false);
      });
  };

  function showTooltip(button) {
    button.classList.add("show-tooltip");
    setTimeout(() => {
      button.classList.remove("show-tooltip");
    }, 2000);
  }

  function showNotification(message, isSuccess) {
    const notification = document.createElement("div");
    notification.style.position = "fixed";
    notification.style.bottom = "20px";
    notification.style.left = "50%";
    notification.style.transform = "translateX(-50%)";
    notification.style.backgroundColor = isSuccess ? "#4CAF50" : "#F44336";
    notification.style.color = "white";
    notification.style.padding = "12px 24px";
    notification.style.borderRadius = "4px";
    notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    notification.style.zIndex = "9999";
    notification.style.transition = "all 0.3s ease";
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
}

/**
 * Navbar Scroll Module - Handles navbar scroll effect
 */
function initNavbarScroll() {
  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}

/**
 * Server Status Module - Improved version
 */
function initServerStatus() {
  const serverAddress = "node.alfiagashop.biz.id:19132"; // IP testing
  const statusText = document.getElementById("server-status-text");
  const statusBadge = document.getElementById("server-status-badge");
  const playerCount = document.getElementById("player-count-text");
  const discordCount = document.getElementById("discord-count");

  // Update Discord count (static for now)
  if (discordCount) {
    discordCount.textContent = "120+";
  }

  async function checkServerStatus() {
    if (!statusText || !statusBadge || !playerCount) return;

    try {
      // Show loading state
      statusText.textContent = "Memeriksa...";
      statusBadge.className = "status loading";
      statusBadge.querySelector('.status-text').textContent = "Memeriksa...";
      playerCount.textContent = "-/-";

      const response = await fetch(
        `https://api.mcstatus.io/v2/status/bedrock/${serverAddress}`,
        { timeout: 5000 }
      );
      
      if (!response.ok) throw new Error("Server tidak merespon");
      
      const data = await response.json();

      if (data.online) {
        statusText.textContent = "ONLINE";
        statusBadge.className = "status online";
        statusBadge.querySelector('.status-text').textContent = "Online";
        playerCount.textContent = `${data.players.online}/${data.players.max}`;
        
        // Update player status
        const playerStatus = document.querySelector('.info-card:nth-child(2) .status');
        if (playerStatus) {
          playerStatus.className = "status online";
          playerStatus.querySelector('.status-text').textContent = 
            data.players.online > 0 ? "Bermain" : "Tersedia";
        }
      } else {
        statusText.textContent = "OFFLINE";
        statusBadge.className = "status offline";
        statusBadge.querySelector('.status-text').textContent = "Offline";
        playerCount.textContent = "0/0";
      }
    } catch (error) {
      console.error("Error checking server status:", error);
      statusText.textContent = "ERROR";
      statusBadge.className = "status error";
      statusBadge.querySelector('.status-text').textContent = "Gagal memuat";
      playerCount.textContent = "-/-";
    }
  }

  // Initial check
  checkServerStatus();
  
  // Check every 30 seconds
  const statusInterval = setInterval(checkServerStatus, 30000);
  
  // Cleanup interval when page unloads
  window.addEventListener('beforeunload', () => {
    clearInterval(statusInterval);
  });
}

/**
 * Info Buttons Module - Handles rank info popups
 */
function initInfoButtons() {
  const infoButtons = document.querySelectorAll('.info-button');
  const infoPopup = document.getElementById('info-popup');
  const closeInfoPopup = document.getElementById('close-info-popup');
  const infoRankName = document.getElementById('info-rank-name');
  const infoRankFeatures = document.getElementById('info-rank-features');

  infoButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Ambil data rank
      const rankCard = this.closest('.rank-card');
      const rankName = rankCard.querySelector('h3').textContent;
      const featuresText = this.getAttribute('data-info');
      
      // Format fitur menjadi list
      const featuresList = featuresText.split(', ').map(feature => 
        `<li>${feature}</li>`
      ).join('');
      
      // Update popup content
      infoRankName.textContent = rankName;
      infoRankFeatures.innerHTML = featuresList;
      
      // Tampilkan popup
      infoPopup.classList.add('show');
    });
  });

  // Close popup
  closeInfoPopup.addEventListener('click', () => {
    infoPopup.classList.remove('show');
  });

  // Close ketika klik di luar
  infoPopup.addEventListener('click', (e) => {
    if (e.target === infoPopup) {
      infoPopup.classList.remove('show');
    }
  });
}

