module.exports = class JlinxVaultSet {
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

// // TODO impliment file locks / locking
// module.exports = class JlinxVaultSet {
//   constructor (vault, key) {
//     this.toArray = async () => (await vault.get(key)) || []
//     this._update = set => vault.set(key, [...set], 'json')
//   }

//   async size () {
//     return (await this.toArray()).length
//   }

//   async toSet () {
//     return new Set(await this.toArray())
//   }

//   async add (member) {
//     const set = await this.toSet()
//     set.add(member)
//     await this._update(set)
//   }

//   async clear () {
//     await this._update(new Set())
//   }

//   async delete (member) {
//     const set = await this.toSet()
//     set.delete(member)
//     await this._update(set)
//   }

//   async has (member) {
//     const set = await this.toSet()
//     return set.has(member)
//   }

//   async entries () {
//     const set = await this.toSet()
//     return set.entries()
//   }

//   async values () {
//     const set = await this.toSet()
//     return set.values()
//   }
// }
