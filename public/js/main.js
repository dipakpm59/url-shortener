(() => {
  const form = document.getElementById('shorten-form');
  const longUrlInput = document.getElementById('long-url');
  const expiresInput = document.getElementById('expires-at');
  const submitBtn = document.getElementById('shorten-btn');
  const resultSection = document.getElementById('result-section');
  const shortUrlOutput = document.getElementById('short-url-output');
  const originalUrlOutput = document.getElementById('original-url-output');
  const copyBtn = document.getElementById('copy-btn');
  const qrImage = document.getElementById('qr-image');
  const qrSkeleton = document.getElementById('qr-skeleton');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setButtonLoading(submitBtn, true, 'Shortening...');
    resultSection.classList.add('d-none');

    try {
      const payload = { longUrl: longUrlInput.value.trim() };
      if (expiresInput.value) payload.expiresAt = new Date(expiresInput.value).toISOString();

      const { data } = await apiRequest('/api/url', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      shortUrlOutput.value = data.shortUrl;
      originalUrlOutput.textContent = data.longUrl;
      resultSection.classList.remove('d-none');
      showToast('Short URL created successfully.', 'success');

      loadQrCode(data.shortCode);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  async function loadQrCode(shortCode) {
    qrImage.classList.add('d-none');
    qrSkeleton.classList.remove('d-none');
    try {
      const { data } = await apiRequest(`/api/url/${shortCode}/qrcode`);
      qrImage.src = data.qrCode;
      qrImage.classList.remove('d-none');
    } catch (err) {
      showToast('Could not load QR code.', 'danger');
    } finally {
      qrSkeleton.classList.add('d-none');
    }
  }

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shortUrlOutput.value);
      showToast('Copied to clipboard.', 'success');
    } catch (err) {
      shortUrlOutput.select();
      document.execCommand('copy');
      showToast('Copied to clipboard.', 'success');
    }
  });
})();
