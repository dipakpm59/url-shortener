(() => {
  async function loadAnalytics() {
    try {
      const { data } = await apiRequest('/api/admin/dashboard');
      renderChart(data.clicksOverTime);
      renderCacheStats(data.cacheStats);
      renderMostClicked(data.mostClicked);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  function renderChart(clicksOverTime) {
    const ctx = document.getElementById('clicks-chart');
    const labels = clicksOverTime.map((row) => new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = clicksOverTime.map((row) => Number(row.clicks));

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

    // eslint-disable-next-line no-undef
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No data yet'],
        datasets: [{
          label: 'Clicks',
          data: values.length ? values : [0],
          borderColor: '#6366F1',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#06B6D4',
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#94A3B8' } },
          y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#94A3B8', precision: 0 } },
        },
      },
    });
  }

  function renderCacheStats(stats) {
    const container = document.getElementById('cache-stats');
    const rows = [
      ['Capacity', stats.capacity],
      ['Current Size', stats.size],
      ['Hits', stats.hits],
      ['Misses', stats.misses],
      ['Hit Rate', `${stats.hitRate}%`],
      ['Evictions', stats.evictions],
    ];
    container.innerHTML = rows.map(([label, value]) => `
      <div class="d-flex justify-content-between align-items-center">
        <span class="small text-muted-soft">${label}</span>
        <span class="fw-bold">${value}</span>
      </div>`).join('');
  }

  function renderMostClicked(list) {
    const body = document.getElementById('most-clicked-body');
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty-state">No clicks recorded yet.</td></tr>`;
      return;
    }
    body.innerHTML = list.map((url, i) => `
      <tr class="table-row-hover">
        <td>${i + 1}</td>
        <td class="mono">${url.short_code}</td>
        <td class="text-truncate" style="max-width:320px;" title="${url.long_url}">${url.long_url}</td>
        <td>${url.click_count}</td>
        <td class="small text-muted-soft">${formatDate(url.created_at)}</td>
      </tr>`).join('');
  }

  loadAnalytics();
})();
