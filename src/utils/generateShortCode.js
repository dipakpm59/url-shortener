const crypto = require('crypto');

// Full Base62 alphabet (A-Z, a-z, 0-9) — no characters excluded.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SHORT_CODE_LENGTH = 10;

function generateShortCode() {
  let code = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

module.exports = generateShortCode;
