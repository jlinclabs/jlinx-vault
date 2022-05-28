const Debug = require('debug')
const Path = require('path')
const safetyCatch = require('safety-catch')
const sodium = require('sodium-universal')
const b4a = require('b4a')
const fs = require('fs/promises')
const cenc = require('compact-encoding')

const debug = Debug('jlinx:vault')

const VERSION = 1
const KEY_CHECK_VALUE = b4a.from('KEY_CHECKS_OUT')

const ENCODINGS = [
  {
    name: 'raw',
    prefix: b4a.from('0'),
    encode: x => cenc.encode(cenc.raw, x),
    decode: x => cenc.decode(cenc.raw, x)
  },
  {
    name: 'string',
    prefix: b4a.from('1'),
    encode: x => cenc.encode(cenc.string, x),
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
    await fs.mkdir(this.storagePath).catch(safetyCatch)
    await this.set('VERION', VERSION)
    await this.set('KEY_CHECK', KEY_CHECK_VALUE)
  }

  async _keyToPath (key) {
    console.log(this, this.crypto)
    const encryptedPath = this.crypto.encrypt(key)
    const asHex = encryptedPath.toString('hex')
    return Path.join(
      asHex.slice(0, 2),
      asHex.slice(2, 4),
      asHex
    )
  }

  _getEncoder ({ encoding, prefix }) {
    if (!(encoding in ENCODINGS)) {
      throw new Error(`invalid encoding ${encoding}`)
    }
    const [code, encoder] = ENCODINGS[encoding]
    return {
      prefix: b4a.from(`${code}`),
      encoder
    }
  }

  async set (key, value, encoding = 'string') {
    const encoder = this._getEncoder({ encoding })
    console.log(encoder)
    const path = await this._keyToPath(key)
    const encoded = encoder.encode(encoder, value)
    const encrypted = this.crypto.encrypt(
      b4a.contact([encoder.prefix, encoded])
    )
    debug('set', { key, path })
    await this.writeFile(path, encrypted)
  }

  async get (key) {
    const path = await this._keyToPath(key)
    debug('get', { key, path })
    let encrypted
    try {
      encrypted = await fs.readFile(Path.join(this.path, path))
    } catch (error) {
      if (error && error.code === 'ENOENT') return
      throw error
    }
    if (!encrypted) return
    const decrypted = this.crypto.decrypt(encrypted)
    const prefix = decrypted.slice(0, 1)
    const encoded = decrypted.slice(1)
    const encoder = this._getEncoder({ prefix })
    const value = encoder.decode(encoded)
    return value
  }

  async has (key) {

  }

  async delete (key) {

  }
}

function makeCrypto (key) {
  return {
    encrypt () {
      throw new Error('NOT DONT YET')
    },
    decrypt () {
      throw new Error('NOT DONT YET')
    }
  }
}
