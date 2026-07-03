(() => {
  const state = { page: 1, limit: 10, search: '', sortBy: 'created_at', sortOrder: 'desc', includeDeleted: false };

  const tableBody = document.getElementById('url-table-body');
  const emptyState = document.getElementById('empty-state');
  const paginationInfo = document.getElementById('pagination-info');
  const paginationControls = document.getElementById('pagination-controls');
  const searchInput = document.getElementById('search-input');
  const sortBySelect = document.getElementById('sort-by');
  const sortOrderSelect = document.getElementById('sort-order');
  const includeDeletedToggle = document.getElementById('include-deleted');

  async function loadStats() {
    try {
      const { data } = await apiRequest('/api/admin/dashboard');
      document.getElementById('stat-total-urls').textContent = data.totals.totalUrls;
      document.getElementById('stat-total-clicks').textContent = data.totals.totalClicks;
      document.getElementById('stat-deleted-urls').textContent = data.totals.deletedUrls;
      document.getElementById('stat-expired-urls').textContent = data.totals.expiredUrls;
    } catch (err) {
      showToast('Failed to load dashboard stats.', 'danger');
    }
  }

  function statusBadge(url) {
    if (url.isDeleted) return '<span class="badge-soft" style="background:rgba(239,68,68,0.15); color:#FCA5A5;">Deleted</span>';
    if (url.expiresAt && new Date(url.expiresAt).getTime() < Date.now()) return '<span class="badge-soft" style="background:rgba(234,179,8,0.15); color:#FDE68A;">Expired</span>';
    return '<span class="badge-soft" style="background:rgba(34,197,94,0.15); color:#86EFAC;">Active</span>';
  }

  function rowActions(url) {
    if (url.isDeleted) {
      return `<button class="btn btn-outline-brand btn-sm" data-action="restore" data-id="${url.id}"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>`;
    }
    return `<button class="btn btn-outline-brand btn-sm text-danger" data-action="delete" data-id="${url.id}"><i class="bi bi-trash3"></i></button>`;
  }

  async function loadTable() {
    tableBody.innerHTML = `<tr><td colspan="8"><div class="skeleton" style="height:40px;"></div></td></tr>`;
    emptyState.classList.add('d-none');

    try {
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        includeDeleted: state.includeDeleted,
      });
      const { data, pagination } = await apiRequest(`/api/admin/urls?${params.toString()}`);

      if (data.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('d-none');
      } else {
        tableBody.innerHTML = data.map((url) => `
          <tr class="table-row-hover">
            <td class="mono">${url.shortCode}</td>
            <td class="text-truncate" style="max-width:280px;" title="${url.longUrl}">${url.longUrl}</td>
            <td>${url.clickCount}</td>
            <td class="small text-muted-soft">${formatDate(url.createdAt)}</td>
            <td class="small text-muted-soft">${formatDate(url.lastAccessedAt)}</td>
            <td class="small text-muted-soft">${formatDate(url.expiresAt)}</td>
            <td>${statusBadge(url)}</td>
            <td class="text-end">${rowActions(url)}</td>
          </tr>`).join('');
      }

      renderPagination(pagination);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  function renderPagination(pagination) {
    const { page, totalPages, total, limit } = pagination;
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    paginationInfo.textContent = `Showing ${start}-${end} of ${total}`;

    paginationControls.innerHTML = '';
    const addPageItem = (label, targetPage, disabled, active) => {
      const li = document.createElement('li');
      li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
      li.innerHTML = `<button class="page-link" style="background:var(--color-card); border-color:var(--color-border); color:${active ? '#fff' : 'var(--color-muted)'};">${label}</button>`;
      if (!disabled && !active) {
        li.querySelector('button').addEventListener('click', () => { state.page = targetPage; loadTable(); });
      }
      paginationControls.appendChild(li);
    };

    addPageItem('Prev', page - 1, page <= 1, false);
    for (let p = 1; p <= totalPages; p += 1) {
      if (totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) continue;
      addPageItem(String(p), p, false, p === page);
    }
    addPageItem('Next', page + 1, page >= totalPages, false);
  }

  tableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'delete') {
      if (!confirmDialog('Soft-delete this URL? It can be restored later.')) return;
      try {
        await apiRequest(`/api/url/${id}`, { method: 'DELETE' });
        showToast('URL deleted.', 'success');
        loadTable();
        loadStats();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }

    if (action === 'restore') {
      try {
        await apiRequest(`/api/url/${id}/restore`, { method: 'POST' });
        showToast('URL restored.', 'success');
        loadTable();
        loadStats();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  });

  searchInput.addEventListener('input', debounce(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadTable();
  }, 350));

  sortBySelect.addEventListener('change', () => { state.sortBy = sortBySelect.value; state.page = 1; loadTable(); });
  sortOrderSelect.addEventListener('change', () => { state.sortOrder = sortOrderSelect.value; state.page = 1; loadTable(); });
  includeDeletedToggle.addEventListener('change', () => { state.includeDeleted = includeDeletedToggle.checked; state.page = 1; loadTable(); });

  loadStats();
  loadTable();
})();
