const Debug = require('debug')
const Path = require('path')
const b4a = require('b4a')
const fs = require('fs/promises')
const mkdirp = require('mkdirp-classic')
const readDirRecursive = require('recursive-readdir')
const cenc = require('compact-encoding')
const {
  generateVaultKey,
  bufferStartsWith,
  makeCrypto
} = require('./util')
const Namespace = require('./namespace')
const KeyStore = require('./key-store')

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

module.exports = class JlinxVault extends Namespace.Base {
  static generateKey () { return generateVaultKey() }

  constructor (opts) {
    super()
    this.path = opts.path
    this.crypto = opts.crypto || makeCrypto(opts.key)
    this._opening = this._open()
    this.defaultEncoding = opts.defaultEncoding
    this.keystore = new KeyStore(this.namespace('keystore', 'raw'))
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
      if (KEY_CHECK_VALUE !== keyCheck) {
        throw new Error('invalid vault key')
      }
    } else {
      await this.init()
    }
    // TODO use file locks to do transactions
    // TODO lock a file so only one process can have the vault open at a time
  }

  async close () {
    // TODO release lock
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
    // TODO ensure were dont overrite
    await this.set('VERSION', VERSION)
    await this.set('KEY_CHECK', KEY_CHECK_VALUE)
  }

  async _keyToPath (key) {
    debug('_keyToPath', { key })
    key = b4a.from(key)
    const encryptedKey = this.crypto.encrypt(key)
    const asHex = encryptedKey.toString('hex')
    const path = Path.join(
      this.path,
      asHex.slice(0, 2),
      asHex.slice(2, 4),
      asHex
    )
    return path
  }

  async set (key, value, encoding = 'json') {
    const encoder = ENCODERS.find(encoder => encoder.name === encoding)
    if (!encoder) {
      throw new Error(`invalid encoding "${encoding}"`)
    }
    const path = await this._keyToPath(key)
    debug('set', { key, path })
    if (typeof value === 'undefined') return await this.delete(key)
    const encoded = encoder.encode(value)
    const decrypted = b4a.concat([encoder.prefix, encoded])
    const encrypted = this.crypto.encrypt(decrypted)
    await new Promise((resolve, reject) => {
      const dirPath = Path.dirname(path)
      mkdirp(dirPath, error => {
        if (error) { reject(error) } else { resolve() }
      })
    })
    await fs.writeFile(path, encrypted)
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
    const decrypted = this.crypto.decrypt(encrypted)
    const prefix = decrypted.slice(0, 1)
    const encoded = decrypted.slice(1)
    const encoder = ENCODERS.find(encoder =>
      b4a.equals(encoder.prefix, prefix)
    )
    if (!encoder) {
      throw new Error(`unkown encoding prefix="${prefix}"`)
    }
    const value = encoder.decode(encoded)
    return value
  }

  async has (key) {
    return typeof (await this.get(key)) !== 'undefined'
  }

  async delete (key) {
    const path = await this._keyToPath(key)
    debug('delete', { key, path })
    try {
      await fs.unlink(path)
      return true
    } catch (error) {
      if (error.code === 'ENOENT') return false
      throw error
    }
  }

  async keys (prefix) {
    const files = await readDirRecursive(this.path)
    const all = files.map(path => {
      const key = path.split('/').reverse()[0]
      return this.crypto.decrypt(Buffer.from(key, 'hex')).toString()
    })
    if (!prefix) return all
    prefix = b4a.concat([b4a.from(prefix), Namespace.PREFIX_DELIMITER])
    const subset = []
    for (const key of all) {
      if (!bufferStartsWith(key, prefix)) continue
      subset.push(b4a.from(key).subarray(prefix.length).toString())
    }
    return subset
  }
}
