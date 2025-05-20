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
  const displayNameElements = document.querySelectorAll(".display-name"); // Changed to class selector
  const profilePic = document.getElementById("profile-pic");
  const profileUsername = document.getElementById("profile-username");

  if ((displayNameElements.length || profileUsername) && profilePic) {
    const username = localStorage.getItem("username");
    
    // Redirect to login if not authenticated
    if (!username && !window.location.pathname.includes("../login/index.html")) {
      window.location.href = "../login/index.html";
      return;
    }

    // Display username in all elements with class 'display-name'
    if (username && displayNameElements.length) {
      displayNameElements.forEach(el => {
        el.textContent = username;
      });
    }
    
    // Set profile username in dropdown
    if (profileUsername && username) {
      profileUsername.textContent = username;
    }

    // Set profile picture with fallback
    const setProfilePicture = () => {
      const avatarUrl = username 
        ? `https://mc-heads.net/avatar/${username}/100`
        : "https://mc-heads.net/avatar/steve/100";

      // Preload image to check if it exists
      const testImage = new Image();
      testImage.src = avatarUrl;

      testImage.onload = () => {
        profilePic.src = avatarUrl;
        localStorage.setItem('avatar', avatarUrl);
      };

      testImage.onerror = () => {
        profilePic.src = "https://mc-heads.net/avatar/steve/100";
        localStorage.setItem('avatar', "https://mc-heads.net/avatar/steve/100");
      };
    };

    // Set initial profile picture
    const savedAvatar = localStorage.getItem('avatar');
    if (savedAvatar) {
      profilePic.src = savedAvatar;
      profilePic.onerror = () => {
        profilePic.src = "https://mc-heads.net/avatar/steve/100";
      };
    } else {
      setProfilePicture();
    }
  }
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
      window.location.href = "../login/index.html";
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
