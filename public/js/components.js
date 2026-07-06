/* Shared UI helpers used across all pages: toasts, button loading state, confirm dialog. */

function showToast(message, variant = 'primary') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icon = { success: 'bi-check-circle-fill', danger: 'bi-x-circle-fill', primary: 'bi-info-circle-fill' }[variant] || 'bi-info-circle-fill';
  const color = { success: 'var(--color-success)', danger: 'var(--color-danger)', primary: 'var(--color-primary)' }[variant] || 'var(--color-primary)';

  const el = document.createElement('div');
  el.className = 'toast align-items-center border-0 mb-2';
  el.style.background = 'var(--color-card)';
  el.style.border = '1px solid var(--color-border)';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body text-white">
        <i class="bi ${icon} me-2" style="color:${color};"></i>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 4000 });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function setButtonLoading(button, loading, loadingText = 'Working...') {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-brand me-2"></span>${loadingText}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

function confirmDialog(message) {
  // Lightweight confirm — swap for a styled modal if desired; kept dependency-free.
  return window.confirm(message);
}

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // A session that expires while an admin/analytics page is already open
  // (JWT hits its 2h expiry mid-visit) surfaces here as a 401 on a fetch
  // call rather than a page navigation, so errorHandler's redirect never
  // fires. Handle it globally instead of in every page script — except on
  // the login pages themselves, where a 401 just means "wrong password".
  // The landing page ('/') is a special case: URL creation there now
  // requires a regular USER (or ADMIN) session, so an anonymous visitor's
  // 401 must go to the user account page, not the admin login.
  const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/account';
  if (res.status === 401 && !isAuthPage) {
    const redirectPath = window.location.pathname === '/' ? '/account' : '/login';
    window.location.href = `${redirectPath}?expired=1`;
    return new Promise(() => {}); // never resolves — navigation is already underway
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed with status ${res.status}`);
  }
  return body;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
