const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");

function toast(title, desc) {
  const el = document.getElementById("toast");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastDesc").textContent = desc;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(loginForm).entries());

  loginBtn.disabled = true;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const j = await res.json();
      toast("Login failed", j.message || "Wrong credentials.");
      loginBtn.disabled = false;
      return;
    }

    const j = await res.json();
    toast("Welcome", "Login successful.");

    // Check if admin or customer
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const user = await meRes.json();
      if (user.user.role === "admin") {
        window.location.href = "/employee.html";
      } else {
        window.location.href = "/index.html";
      }
    } else {
      window.location.href = "/index.html";
    }
  } catch {
    toast("Network error", "Server not reachable. Try again.");
    loginBtn.disabled = false;
  }
});