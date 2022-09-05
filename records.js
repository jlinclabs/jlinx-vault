const JlinxVaultSet = require('./set')

module.exports = class JlinxVaultRecords {
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

  async set (id, value, encoding) {
    id = `${id}`
    if (typeof value === 'undefined') return await this.delete(id)
    await this.ids.add(id)
    await this.vault.set(this._recordKey(id), value, encoding)
  }

  async delete (id) {
    id = `${id}`
    await this.ids.delete(id)
    await this.vault.delete(this._recordKey(id))
  }

  size () { return this.ids.all().length }
}
