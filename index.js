const Debug = require('debug')
const Path = require('path')
// const safetyCatch = require('safety-catch')
const sodium = require('sodium-universal')
const b4a = require('b4a')
const fs = require('fs/promises')
const mkdirp = require('mkdirp-classic')
const cenc = require('compact-encoding')

const debug = Debug('jlinx:vault')

const VERSION = '1'
const KEY_CHECK_VALUE = 'KEY_CHECKS_OUT'

const ENCODERS = [
  {
    name: 'raw',
    prefix: b4a.from('0'),
    encode: x => cenc.encode(cenc.raw, x),
    decode: x => cenc.decode(cenc.raw, x)
  },
  {
    name: 'string',
    prefix: b4a.from('1'),
    encode: x => cenc.encode(cenc.string, x.toString()),
    decode: x => cenc.decode(cenc.string, x)
  },
  {
    name: 'json',
    prefix: b4a.from('2'),
    encode: x => cenc.encode(cenc.string, JSON.stringify(x)),
    decode: x => JSON.parse(cenc.decode(cenc.string, x))
  }
]

module.exports = class JlinxVault {
  static generateKey () {
    const buffer = b4a.allocUnsafe(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES)
    sodium.crypto_secretstream_xchacha20poly1305_keygen(buffer)
    return buffer
  }

  constructor (opts) {
    this.path = opts.path
    this.crypto = opts.crypto || makeCrypto(opts.key)
    this._opening = this._open()
  }

  [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
    return this.constructor.name + '(\n' +
      indent + '  path: ' + opts.stylize(this.path, 'string') + '\n' +
      indent + ')'
  }

  async ready () { return this._opening }

  async _open () {
    const keyCheck = await this.get('KEY_CHECK')
    if (keyCheck) {
      if (!b4a.equals(KEY_CHECK_VALUE, keyCheck)) {
        throw new Error('invalid vault key')
      }
    } else {
      await this.init()
    }
  }

  async exists () {
    try {
      await fs.stat(this.path)
      return true
    } catch (error) {
      if (error.code === 'ENOENT') return false
      throw error
    }
  }

  async valid () {
    return KEY_CHECK_VALUE === await this.get('KEY_CHECK')
  }

  async init () {
    await mkdirp(this.path)
    await this.set('VERION', VERSION)
    await this.set('KEY_CHECK', KEY_CHECK_VALUE)
  }

  async _keyToPath (key) {
    debug('_keyToPath', { key })
    key = b4a.from(key)
    const encryptedKey = this.crypto.encrypt(key, key)
    const asHex = encryptedKey.toString('hex')
    debug('encryptedKey', asHex)
    const decryptedKey = this.crypto.decrypt(b4a.from(asHex, 'hex'), key)
    debug('decryptedKey', decryptedKey.toString(), b4a.equals(decryptedKey, key))
    return Path.join(
      this.path,
      asHex.slice(0, 2),
      asHex.slice(2, 4),
      asHex
    )
  }

  async set (key, value, encoding = 'string') {
    const encoder = ENCODERS.find(encoder => encoder.name === encoding)
    if (!encoder) {
      throw new Error(`invalid encoding "${encoding}"`)
    }
    const path = await this._keyToPath(key)
    const encoded = encoder.encode(b4a.from(value))
    const decrypted = b4a.concat([encoder.prefix, encoded])
    const encrypted = this.crypto.encrypt(decrypted, key)
    debug('set', { key, path })
    await new Promise((resolve, reject) => {
      const dirPath = Path.dirname(path)
      debug('mkdir', dirPath)
      mkdirp(dirPath, error => {
        if (error) { reject(error) } else { resolve() }
      })
    })
    await fs.writeFile(path, encrypted)
    debug('set success', key)
    return true
  }

  async get (key) {
    const path = await this._keyToPath(key)
    debug('get', { key, path })
    let encrypted
    try {
      encrypted = await fs.readFile(path)
    } catch (error) {
      if (error && error.code === 'ENOENT') return
      throw error
    }
    if (!encrypted) return
    const decrypted = this.crypto.decrypt(encrypted, key)
    const prefix = decrypted.slice(0, 1)
    const encoded = decrypted.slice(1)
    const encoder = ENCODERS.find(encoder =>
      b4a.equals(encoder.prefix, prefix)
    )
    if (!encoder) {
      throw new Error(`unkown encoding prefix="${prefix}"`)
    }
    debug('get using encoder', encoder)
    const value = encoder.decode(encoded)
    return value
  }

  async has (key) {
    return typeof (await this.get(key)) !== 'undefined'
  }

  async delete (key) {
    debug('delete', { key })
    const path = await this._keyToPath(key)
    debug('delete', { path })
    try {
      await fs.unlink(path)
      return true
    } catch (error) {
      if (error.code === 'ENOENT') return false
      throw error
    }
  }
}

function makeCrypto (key) {
  return {
    encrypt (decrypted, name) {
      const nonce = deriveNonce(key, name)
      const encrypted = Buffer.alloc(decrypted.length + sodium.crypto_secretbox_MACBYTES)
      sodium.crypto_secretbox_easy(encrypted, decrypted, nonce, key)
      return encrypted
    },
    decrypt (encrypted, name) {
      const nonce = deriveNonce(key, name)
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
