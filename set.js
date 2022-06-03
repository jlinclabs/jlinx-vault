module.exports = class JlinxVaultSet {
  constructor (vault, key) {
    this.toArray = async () => (await vault.get(key)) || []
    this._update = set => vault.set(key, [...set], 'json')
  }

  async toSet(){
    return new Set(await this.toArray())
  }

  async add (member) {
    const set = await this.toSet()
    set.add(member)
    await this._update(set)
  }

  async clear () {
    await this._update(new Set)
  }

  async delete () {
    const set = await this.toSet()
    set.delete(member)
    await this._update(set)
  }

  async has () {
    const set = await this.toSet()
    return set.has(member)
  }

  async entries () {
    const set = await this.toSet()
    return set.entries()
  }

  async values () {
    const set = await this.toSet()
    return set.values()
  }

}
