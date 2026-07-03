const QRCode = require('qrcode');

async function generateQrCodeDataUrl(text) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
}

module.exports = { generateQrCodeDataUrl };
