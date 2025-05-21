/**
 * Login Module for Glowbit Network
 * Handles Minecraft authentication with Java/Bedrock platform selection
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize all components
  initPlatformToggle();
  initSkinPreview();
  initLoginHandler();
  initScrollAnimations();
});

// ==================== MODULES ====================

/**
 * Platform Toggle Module - Handles Java/Bedrock selection
 */
function initPlatformToggle() {
  const platformToggle = document.querySelector(".platform-toggle");
  const javaOption = document.querySelector(".platform-option[data-value='java']");
  const bedrockOption = document.querySelector(".platform-option[data-value='bedrock']");
  const platformSelector = document.querySelector(".platform-selector");

  // Initialize toggle position
  updatePlatformToggle(javaOption, bedrockOption, platformSelector, false);

  // Add event listeners
  javaOption.addEventListener("click", () => {
    updatePlatformToggle(javaOption, bedrockOption, platformSelector, false);
  });

  bedrockOption.addEventListener("click", () => {
    updatePlatformToggle(javaOption, bedrockOption, platformSelector, true);
  });
}

function updatePlatformToggle(javaOption, bedrockOption, selector, isBedrock) {
  if (isBedrock) {
    javaOption.classList.remove("active");
    bedrockOption.classList.add("active");
    selector.style.left = `${bedrockOption.offsetLeft}px`;
    selector.style.width = `${bedrockOption.offsetWidth}px`;
  } else {
    bedrockOption.classList.remove("active");
    javaOption.classList.add("active");
    selector.style.left = '4px';
    selector.style.width = `${javaOption.offsetWidth}px`;
  }
}

/**
 * Skin Preview Module - Handles Minecraft skin preview
 */
function initSkinPreview() {
  const usernameInput = document.getElementById("username-input");
  const skinPreview = document.getElementById("skin-preview");
  const javaOption = document.querySelector(".platform-option[data-value='java']");

  // Hide initially
  skinPreview.style.display = "none";

  // Update preview on input
  usernameInput.addEventListener("input", () => {
    updateSkinPreview(usernameInput, skinPreview, javaOption);
  });

  // Initialize if username exists
  if (usernameInput.value.trim()) {
    updateSkinPreview(usernameInput, skinPreview, javaOption);
  }
}

function updateSkinPreview(usernameInput, skinPreview, javaOption) {
  const usernameRaw = usernameInput.value.trim();
  const isJava = javaOption.classList.contains("active");

  if (!usernameRaw) {
    skinPreview.style.display = "none";
    return;
  }

  const skinUsername = isJava ? usernameRaw : "steve";
  skinPreview.src = `https://mc-heads.net/avatar/${skinUsername}/100`;
  skinPreview.style.display = "block";
}

/**
 * Login Handler Module - Handles authentication process
 */
function initLoginHandler() {
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");
  const usernameInput = document.getElementById("username-input");
  const termsCheckbox = document.getElementById("terms-checkbox");
  const javaOption = document.querySelector(".platform-option[data-value='java']");

  loginBtn.addEventListener("click", async () => {
    const error = validateLoginForm(usernameInput, termsCheckbox);
    
    if (error) {
      loginError.textContent = error;
      return;
    }

    await processLogin(usernameInput, javaOption, loginError);
  });
}

function validateLoginForm(usernameInput, termsCheckbox) {
  if (!usernameInput.value.trim()) {
    return "Username tidak boleh kosong.";
  }

  if (!termsCheckbox.checked) {
    return "Anda harus menyetujui Syarat dan Ketentuan.";
  }

  return null;
}

async function processLogin(usernameInput, javaOption, loginError) {
  const usernameRaw = usernameInput.value.trim();
  const isJava = javaOption.classList.contains("active");
  const finalUsername = isJava ? usernameRaw : `.${usernameRaw}`;

  try {
    const response = await fetch("/check-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: finalUsername })
    });

    const data = await response.json();

    if (response.ok && data.exists) {
      handleLoginSuccess(finalUsername, isJava ? "java" : "bedrock");
    } else {
      loginError.textContent = "Username tidak ditemukan.";
    }
  } catch (err) {
    loginError.textContent = "Gagal menghubungi server.";
    console.error("Login error:", err);
  }
}

function handleLoginSuccess(username, platform) {
  localStorage.setItem("username", username);
  localStorage.setItem("platform", platform);
  
  // Check for pending redirect or purchase
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get('redirect') || '/home/';
  window.location.href = redirectUrl;
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