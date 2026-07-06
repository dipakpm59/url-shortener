(() => {
  const loginView = document.getElementById('login-view');
  const registerView = document.getElementById('register-view');
  const showRegisterLink = document.getElementById('show-register-link');
  const showLoginLink = document.getElementById('show-login-link');

  // Reached here either because a session genuinely expired, or because an
  // anonymous visitor just tried to shorten a URL on the landing page and
  // was redirected in (see components.js's apiRequest) — "please sign in"
  // covers both without implying they necessarily had a session before.
  const params = new URLSearchParams(window.location.search);
  if (params.get('expired') === '1') {
    showToast('Please sign in to continue.', 'primary');
  }

  function showRegister() {
    loginView.classList.add('d-none');
    registerView.classList.remove('d-none');
  }
  function showLogin() {
    registerView.classList.add('d-none');
    loginView.classList.remove('d-none');
  }
  showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });
  showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });

  function markInvalid(input, errorEl, message) {
    input.classList.add('is-invalid-shake', 'border-danger');
    if (message) errorEl.textContent = message;
    errorEl.classList.remove('d-none');
    input.addEventListener('animationend', () => input.classList.remove('is-invalid-shake'), { once: true });
  }
  function clearInvalid(input, errorEl) {
    input.classList.remove('border-danger');
    errorEl.classList.add('d-none');
  }

  // --- Sign in ---
  const loginForm = document.getElementById('login-form');
  const loginIdentifierInput = document.getElementById('login-identifier');
  const loginPasswordInput = document.getElementById('login-password');
  const loginIdentifierError = document.getElementById('login-identifier-error');
  const loginPasswordError = document.getElementById('login-password-error');
  const loginTogglePasswordBtn = document.getElementById('login-toggle-password');
  const loginRememberMeCheckbox = document.getElementById('login-remember-me');
  const loginBtn = document.getElementById('login-btn');

  loginTogglePasswordBtn.addEventListener('click', () => {
    const isPassword = loginPasswordInput.type === 'password';
    loginPasswordInput.type = isPassword ? 'text' : 'password';
    loginTogglePasswordBtn.innerHTML = `<i class="bi ${isPassword ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearInvalid(loginIdentifierInput, loginIdentifierError);
    clearInvalid(loginPasswordInput, loginPasswordError);

    let valid = true;
    if (!loginIdentifierInput.value.trim()) {
      markInvalid(loginIdentifierInput, loginIdentifierError);
      valid = false;
    }
    if (!loginPasswordInput.value) {
      markInvalid(loginPasswordInput, loginPasswordError);
      valid = false;
    }
    if (!valid) return;

    setButtonLoading(loginBtn, true, 'Logging in...');
    try {
      await apiRequest('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: loginIdentifierInput.value.trim(),
          password: loginPasswordInput.value,
          rememberMe: loginRememberMeCheckbox.checked,
        }),
      });
      showToast('Login successful. Redirecting...', 'success');
      // Return to the landing page's shorten form, now with a valid session.
      window.location.href = '/';
    } catch (err) {
      showToast(err.message, 'danger');
      setButtonLoading(loginBtn, false);
    }
  });

  // --- Create account ---
  const registerForm = document.getElementById('register-form');
  const usernameInput = document.getElementById('register-username');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const confirmPasswordInput = document.getElementById('register-confirm-password');
  const usernameError = document.getElementById('register-username-error');
  const emailError = document.getElementById('register-email-error');
  const passwordError = document.getElementById('register-password-error');
  const confirmPasswordError = document.getElementById('register-confirm-password-error');
  const registerBtn = document.getElementById('register-btn');

  const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach((input, i) =>
      clearInvalid(input, [usernameError, emailError, passwordError, confirmPasswordError][i])
    );

    let valid = true;
    if (!USERNAME_REGEX.test(usernameInput.value.trim())) {
      markInvalid(usernameInput, usernameError);
      valid = false;
    }
    if (!EMAIL_REGEX.test(emailInput.value.trim())) {
      markInvalid(emailInput, emailError);
      valid = false;
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(passwordInput.value)) {
      markInvalid(passwordInput, passwordError);
      valid = false;
    }
    if (passwordInput.value !== confirmPasswordInput.value) {
      markInvalid(confirmPasswordInput, confirmPasswordError);
      valid = false;
    }
    if (!valid) return;

    const newUsername = usernameInput.value.trim();

    setButtonLoading(registerBtn, true, 'Signing up...');
    try {
      await apiRequest('/api/users/register', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      });
      showToast('Account created. Please sign in.', 'success');
      registerForm.reset();
      loginIdentifierInput.value = newUsername;
      showLogin();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setButtonLoading(registerBtn, false);
    }
  });
})();
