(() => {
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const modalUsernameEl = document.getElementById('profile-modal-username');
  const modalEmailEl = document.getElementById('profile-modal-email');
  const modalCreatedEl = document.getElementById('profile-modal-created');
  const logoutBtn = document.getElementById('logout-btn');
  const changePasswordForm = document.getElementById('change-password-form');
  const changePasswordBtn = document.getElementById('change-password-btn');

  async function loadProfile() {
    try {
      const { data } = await apiRequest('/api/auth/me');
      const { admin } = data;
      usernameEl.textContent = admin.username;
      emailEl.textContent = admin.email;
      modalUsernameEl.textContent = admin.username;
      modalEmailEl.textContent = admin.email;
      modalCreatedEl.textContent = formatDate(admin.createdAt);
    } catch (err) {
      // apiRequest already redirects to /login on a 401; anything else, just log.
      console.error('Failed to load profile:', err.message);
    }
  }

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Even if the request fails, still send them to login — the cookie
      // may already be invalid/expired, which is effectively "logged out".
    }
    window.location.href = '/login';
  });

  const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      showToast('New password must be 8+ characters with uppercase, lowercase, a number, and a special character.', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'danger');
      return;
    }

    setButtonLoading(changePasswordBtn, true, 'Updating...');
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      showToast('Password changed successfully.', 'success');
      changePasswordForm.reset();
      bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'))?.hide();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setButtonLoading(changePasswordBtn, false);
    }
  });

  loadProfile();
})();
