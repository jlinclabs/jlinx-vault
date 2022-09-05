const Debug = require('debug')
const Path = require('path')
const sodium = require('sodium-universal')
const b4a = require('b4a')
const fs = require('fs/promises')
const mkdirp = require('mkdirp-classic')
const readDirRecursive = require('recursive-readdir')
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

class JlinxBaseNamespace {
  namespace (prefix, defaultEncoding = this.defaultEncoding) {
    return new JlinxVaultNamespace(this, prefix, defaultEncoding)
  }

  records (prefix, defaultEncoding = 'json') {
    return new JlinxVaultRecords(this.namespace(prefix, defaultEncoding))
  }
}

module.exports = class JlinxVault extends JlinxBaseNamespace {
  static generateKey () {
    const buffer = b4a.allocUnsafe(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES)
    sodium.crypto_secretstream_xchacha20poly1305_keygen(buffer)
    return buffer
  }

  constructor (opts) {
    super()
    this.path = opts.path
    this.crypto = opts.crypto || makeCrypto(opts.key)
    this._opening = this._open()
    this.defaultEncoding = opts.defaultEncoding
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
    prefix = b4a.concat([b4a.from(prefix), PREFIX_DELIMITER])
    const subset = []
    for (const key of all) {
      if (!bufferStartsWith(key, prefix)) continue
      subset.push(b4a.from(key).subarray(prefix.length).toString())
    }
    return subset
  }
}

function bufferStartsWith (left, right) {
  return b4a.from(left).lastIndexOf(b4a.from(right)) === 0
}

const PREFIX_DELIMITER = b4a.from('.')
function joinPrefix (left, right) {
  if (typeof right === 'undefined') return b4a.from(left)
  return b4a.concat([b4a.from(left), PREFIX_DELIMITER, b4a.from(right)])
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

class JlinxVaultNamespace extends JlinxBaseNamespace {
  constructor (vault, prefix, defaultEncoding) {
    super()
    this.vault = vault
    this.prefix = b4a.from(prefix)
    this.defaultEncoding = defaultEncoding
  }

  [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
    return this.constructor.name + '(\n' +
      indent + '  prefix: ' + opts.stylize(this.prefix, 'string') + '\n' +
      indent + '  defaultEncoding: ' + opts.stylize(this.defaultEncoding, 'string') + '\n' +
      indent + ')'
  }

  ready () { return this.vault.ready() }

  _prefix (key) {
    debug('_prefix', { key })
    if (typeof key === 'number') key = `${key}`
    return joinPrefix(this.prefix, key)
  }

  get (key) { return this.vault.get(this._prefix(key)) }

  set (key, value, encoding = this.defaultEncoding) {
    return this.vault.set(this._prefix(key), value, encoding)
  }

  has (key) { return this.vault.has(this._prefix(key)) }

  delete (key) { return this.vault.delete(this._prefix(key)) }

  keys (prefix) {
    return this.vault.keys(joinPrefix(this.prefix, prefix))
  }
}

class JlinxVaultRecords {
  constructor (vault) {
    this.vault = vault
    this.ids = new JlinxVaultSet(this.vault, 'ids')
  }

  _recordKey (id) { return `record:${id}` }

  async get (id) {
    return await this.vault.get(this._recordKey(id))
  }

  async all () {
    const ids = await this.ids.all()
    if (ids.length === 0) return ids
    return await Promise.all(
      ids.map(id => this.get(id))
    )
  }

  async allById () {
    const all = await this.all()
    const byId = {}
    all.forEach(record => { byId[record.id] = record })
    return byId
  }

  async set (id, value) {
    id = `${id}`
    if (typeof value === 'undefined') return await this.delete(id)
    await this.ids.add(id)
    await this.vault.set(this._recordKey(id), value)
  }

  async delete (id) {
    id = `${id}`
    await this.ids.delete(id)
    await this.vault.delete(this._recordKey(id))
  }

  size () { return this.ids.all().length }
}

class JlinxVaultSet {
  constructor (vault, key) {
    this.vault = vault
    this.key = key
  }

  async all () {
    return await this.vault.get(this.key) || []
  }

  async add (id) {
    let ids = await this.all()
    ids = new Set(ids)
    ids.add(id)
    await this.vault.set(this.key, [...ids], 'json')
  }

  async delete (id) {
    let ids = await this.all()
    ids = new Set(ids)
    ids.delete(id)
    await this.vault.set(this.key, [...ids], 'json')
  }

  async has (id) {
    return (await this.all()).includes(id)
  }
}
