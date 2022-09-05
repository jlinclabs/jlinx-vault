const b4a = require('b4a')
const sodium = require('sodium-universal')

function generateVaultKey () {
  const buffer = b4a.allocUnsafe(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES)
  sodium.crypto_secretstream_xchacha20poly1305_keygen(buffer)
  return buffer
}

function bufferStartsWith (left, right) {
  return b4a.from(left).lastIndexOf(b4a.from(right)) === 0
}

function makeCrypto (key) {
  const nonce = deriveNonce(key, 'one nonce to rule them')
  if (
    !b4a.isBuffer(key) ||
    key.byteLength !== sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES
  ) {
    throw new Error(
      'vault key must be a Buffer of length ' +
      sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES
    )
  }
  return {
    encrypt (decrypted) {
      const encrypted = Buffer.alloc(decrypted.length + sodium.crypto_secretbox_MACBYTES)
      sodium.crypto_secretbox_easy(encrypted, decrypted, nonce, key)
      return encrypted
    },
    decrypt (encrypted) {
      const decrypted = b4a.alloc(encrypted.length - sodium.crypto_secretbox_MACBYTES)
      sodium.crypto_secretbox_open_easy(decrypted, encrypted, nonce, key)
      return decrypted
    }
  }
}

function deriveNonce (key, name) {
  if (!b4a.isBuffer(name)) name = b4a.from(name)
  const out = b4a.alloc(sodium.crypto_secretbox_NONCEBYTES)
  sodium.crypto_generichash_batch(out, [b4a.from('jlinx rules'), name], key)
  return out
}

module.exports = {
  generateVaultKey,
  bufferStartsWith,
  makeCrypto,
  deriveNonce
}
