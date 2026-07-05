(() => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const rememberMeCheckbox = document.getElementById('remember-me');
  const loginBtn = document.getElementById('login-btn');

  // Surface "Session expired" as a toast when redirected here by the server
  // (see errorHandler.js -> /login?expired=1 for an expired/invalid JWT).
  const params = new URLSearchParams(window.location.search);
  if (params.get('expired') === '1') {
    showToast('Session expired. Please login again.', 'danger');
  }

  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordBtn.innerHTML = `<i class="bi ${isPassword ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
    togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });

  function markInvalid(input, errorEl, message) {
    input.classList.add('is-invalid-shake', 'border-danger');
    errorEl.textContent = message;
    errorEl.classList.remove('d-none');
    input.addEventListener('animationend', () => input.classList.remove('is-invalid-shake'), { once: true });
  }

  function clearInvalid(input, errorEl) {
    input.classList.remove('border-danger');
    errorEl.classList.add('d-none');
  }

  function validateForm() {
    let valid = true;
    clearInvalid(emailInput, emailError);
    clearInvalid(passwordInput, passwordError);

    if (!emailInput.value.trim()) {
      markInvalid(emailInput, emailError, 'Enter your email or username.');
      valid = false;
    }
    if (!passwordInput.value) {
      markInvalid(passwordInput, passwordError, 'Password is required.');
      valid = false;
    }
    return valid;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setButtonLoading(loginBtn, true, 'Signing in...');
    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: emailInput.value.trim(),
          password: passwordInput.value,
          rememberMe: rememberMeCheckbox.checked,
        }),
      });
      showToast('Login successful. Redirecting...', 'success');
      window.location.href = '/admin';
    } catch (err) {
      showToast(err.message, 'danger');
      setButtonLoading(loginBtn, false);
    }
  });
})();
