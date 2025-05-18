document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");
  const usernameInput = document.getElementById("username-input");
  const skinPreview = document.getElementById("skin-preview");
  const termsCheckbox = document.getElementById("terms-checkbox");
  
  // Elemen toggle baru
  const platformToggle = document.querySelector(".platform-toggle");
  const javaOption = document.querySelector(".platform-option[data-value='java']");
  const bedrockOption = document.querySelector(".platform-option[data-value='bedrock']");
  const platformSelector = document.querySelector(".platform-selector");

  // Inisialisasi toggle
  platformSelector.style.width = `${javaOption.offsetWidth}px`;
  platformSelector.style.left = '4px';
  
  // Sembunyikan skin preview di awal
  skinPreview.style.display = "none";

  // Fungsi untuk update platform
  const updatePlatform = (isBedrock) => {
    if (isBedrock) {
      javaOption.classList.remove("active");
      bedrockOption.classList.add("active");
      platformSelector.style.left = `${bedrockOption.offsetLeft}px`;
      platformSelector.style.width = `${bedrockOption.offsetWidth}px`;
    } else {
      bedrockOption.classList.remove("active");
      javaOption.classList.add("active");
      platformSelector.style.left = '4px';
      platformSelector.style.width = `${javaOption.offsetWidth}px`;
    }
    return isBedrock ? "bedrock" : "java";
  };

  // Fungsi untuk update skin preview
  const updateSkinPreview = () => {
    const usernameRaw = usernameInput.value.trim();
    const platform = javaOption.classList.contains("active") ? "java" : "bedrock";

    if (!usernameRaw) {
      skinPreview.style.display = "none";
      skinPreview.src = "";
      return;
    }

    const finalUsername = platform === "bedrock" ? "steve" : usernameRaw;

    skinPreview.src = `https://mc-heads.net/avatar/${finalUsername}/100`;
    skinPreview.style.display = "block";
  };

  // Event listeners untuk toggle options
  javaOption.addEventListener("click", () => {
    updatePlatform(false);
    updateSkinPreview();
  });

  bedrockOption.addEventListener("click", () => {
    updatePlatform(true);
    updateSkinPreview();
  });

  // Deteksi perubahan input username
  usernameInput.addEventListener("input", updateSkinPreview);

  loginBtn.addEventListener("click", async () => {
    const usernameRaw = usernameInput.value.trim();
    const platform = javaOption.classList.contains("active") ? "java" : "bedrock";
    const finalUsername = platform === "bedrock" ? `.${usernameRaw}` : usernameRaw;

    if (!usernameRaw) {
      loginError.textContent = "Username tidak boleh kosong.";
      return;
    }

    if (!termsCheckbox.checked) {
      loginError.textContent = "Anda harus menyetujui Syarat dan Ketentuan.";
      return;
    }

    try {
      const res = await fetch("/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: finalUsername })
      });

      const data = await res.json();
      if (res.ok && data.exists) {
        localStorage.setItem("username", finalUsername);
        localStorage.setItem("platform", platform);
        window.location.href = "/home/home.html";
      } else {
        loginError.textContent = "Username tidak ditemukan.";
      }
    } catch (err) {
      loginError.textContent = "Gagal menghubungi server.";
      console.error("Login error:", err);
    }
  });

  // Inisialisasi skin preview jika username sudah ada
  if (usernameInput.value.trim()) {
    updateSkinPreview();
  }
  
  // ==================== Scroll Animations ====================
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
});