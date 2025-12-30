const registerForm = document.getElementById("registerForm");
const registerBtn = document.getElementById("registerBtn");

function toast(title, desc) {
  const el = document.getElementById("toast");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastDesc").textContent = desc;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Real-time validation
document.getElementById("email").addEventListener("input", function() {
  const email = this.value.trim();
  const isValid = validateEmail(email);
  this.style.borderColor = email && !isValid ? "#ef4444" : email && isValid ? "#10b981" : "";
});

document.getElementById("password").addEventListener("input", function() {
  const password = this.value;
  const isValid = password.length >= 6;
  this.style.borderColor = password && !isValid ? "#ef4444" : password && isValid ? "#10b981" : "";
});

document.getElementById("confirmPassword").addEventListener("input", function() {
  const confirmPassword = this.value;
  const password = document.getElementById("password").value;
  const isValid = confirmPassword === password && confirmPassword.length >= 6;
  this.style.borderColor = confirmPassword && !isValid ? "#ef4444" : confirmPassword && isValid ? "#10b981" : "";
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(registerForm).entries());

  // Validate email format
  if (!validateEmail(data.email)) {
    toast("Invalid Email", "Please enter a valid email address.");
    return;
  }

  if (data.password !== data.confirmPassword) {
    toast("Error", "Passwords do not match.");
    return;
  }

  if (data.password.length < 6) {
    toast("Weak Password", "Password must be at least 6 characters long.");
    return;
  }

  registerBtn.disabled = true;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password })
    });

    const j = await res.json();

    if (!res.ok) {
      toast("Registration failed", j.message);
      registerBtn.disabled = false;
      return;
    }

    toast("Success", "Account created successfully. Redirecting to login...");
    setTimeout(() => window.location.href = "/login.html", 2000);
  } catch {
    toast("Network error", "Server not reachable. Try again.");
    registerBtn.disabled = false;
  }
});