const crypto = require('crypto');
const { sha256 } = require('./hash');

/** 6-digit numeric OTP, e.g. "042817". crypto.randomInt is CSPRNG-backed, unlike Math.random(). */
function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// OTPs are hashed at rest for the same reason passwords are: a DB leak
// shouldn't hand out valid, usable reset codes. sha256 (not bcrypt) is
// enough here — OTPs are short-lived (10 min) and rate-limited, so the
// slow-hashing property that matters for passwords isn't needed.
const hashOtp = (otp) => sha256(otp);

module.exports = { generateOtp, hashOtp };
