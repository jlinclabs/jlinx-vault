const b4a = require('b4a')
const JlinxVaultRecords = require('./records')

const PREFIX_DELIMITER = b4a.from('.')

function joinPrefix (left, right) {
  if (typeof right === 'undefined') return b4a.from(left)
  return b4a.concat([b4a.from(left), PREFIX_DELIMITER, b4a.from(right)])
}

class JlinxBaseNamespace {
  namespace (prefix, defaultEncoding = this.defaultEncoding) {
    return new JlinxVaultNamespace(this, prefix, defaultEncoding)
  }

  records (prefix, defaultEncoding = 'json') {
    return new JlinxVaultRecords(this.namespace(prefix, defaultEncoding))
  }
}

class JlinxVaultNamespace extends JlinxBaseNamespace {
  static get PREFIX_DELIMITER () { return PREFIX_DELIMITER }
  static get Base () { return JlinxBaseNamespace }

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

module.exports = JlinxVaultNamespace
