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

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailInput.value.trim())) {
      markInvalid(emailInput, emailError, 'Enter a valid email address.');
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
          email: emailInput.value.trim(),
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

  // --- Forgot password (two-step: request code -> verify + set new password) ---
  const forgotModalEl = document.getElementById('forgotPasswordModal');
  const step1Form = document.getElementById('forgot-step1-form');
  const step2Form = document.getElementById('forgot-step2-form');
  const forgotEmailInput = document.getElementById('forgot-email');
  const forgotEmailDisplay = document.getElementById('forgot-email-display');
  const step1Btn = document.getElementById('forgot-step1-btn');
  const step2Btn = document.getElementById('forgot-step2-btn');
  const resendBtn = document.getElementById('resend-otp-btn');
  const otpInput = document.getElementById('otp-input');
  const newPasswordInput = document.getElementById('reset-new-password');
  const confirmPasswordInput = document.getElementById('reset-confirm-password');
  const previewUrlWrap = document.getElementById('preview-url-wrap');
  const previewUrlLink = document.getElementById('preview-url-link');
  const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  async function requestOtp(button) {
    const email = forgotEmailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Enter a valid email address.', 'danger');
      return;
    }

    setButtonLoading(button, true, 'Sending...');
    try {
      const { message, data } = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      showToast(message, 'success');

      if (data?.previewUrl) {
        previewUrlLink.href = data.previewUrl;
        previewUrlWrap.classList.remove('d-none');
      }

      forgotEmailDisplay.textContent = email;
      step1Form.classList.add('d-none');
      step2Form.classList.remove('d-none');
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setButtonLoading(button, false);
    }
  }

  step1Form.addEventListener('submit', (e) => {
    e.preventDefault();
    requestOtp(step1Btn);
  });

  resendBtn.addEventListener('click', () => requestOtp(resendBtn));

  step2Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = otpInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!/^\d{6}$/.test(otp)) {
      showToast('Enter the 6-digit code.', 'danger');
      return;
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      showToast('New password must be 8+ characters with uppercase, lowercase, a number, and a special character.', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'danger');
      return;
    }

    setButtonLoading(step2Btn, true, 'Resetting...');
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmailInput.value.trim(), otp, newPassword, confirmPassword }),
      });
      showToast('Password reset. You can now log in.', 'success');
      bootstrap.Modal.getInstance(forgotModalEl)?.hide();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setButtonLoading(step2Btn, false);
    }
  });

  // Reset the modal back to step 1 each time it's opened/closed, so a
  // second forgot-password attempt doesn't reuse stale state.
  forgotModalEl.addEventListener('hidden.bs.modal', () => {
    step1Form.reset();
    step2Form.reset();
    step1Form.classList.remove('d-none');
    step2Form.classList.add('d-none');
    previewUrlWrap.classList.add('d-none');
  });
})();
