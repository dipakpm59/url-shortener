const { customAlphabet } = require('nanoid');
const env = require('../config/env');

// Alphanumeric, no ambiguous-looking characters (0/O, 1/l/I) removed for readability.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const nanoid = customAlphabet(ALPHABET, env.url.shortCodeLength);

function generateShortCode() {
  return nanoid();
}

module.exports = generateShortCode;
