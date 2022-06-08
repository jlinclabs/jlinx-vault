const VaultSet = require('./set')

module.exports = class RecordStore {

  constructor (vault, key) {
    this._records = vault.namespace(key, 'json')
    this._ids = new VaultSet(this._records, '_ids')
  }

  async size(){
    return await this._ids.size()
  }

  async put(id, value){
    await this._records.set(id, value)
    await this._ids.add(id)
  }

  async get(id){
    return await this._records.get(id)
  }

  async delete(id){
    await this._records.delete(id)
    await this._ids.delete(id)
  }

  async has(id){
    return await this._ids.has(id)
  }

  async ids(){
    return await this._ids.toArray()
  }

  async all(){
    const ids = await this.ids()
    return await Promise.all(
      ids.map(id => this.get(id))
    )
  }

}
