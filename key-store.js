const {
  createSigningKeyPair,
  // validateSigningKeyPair,
  sign,
  verify
  // createEncryptingKeyPair,
  // validateEncryptingKeyPair,
} = require('jlinx-util')

module.exports = class KeyStore {
  constructor (vault, key) {
    this._store = vault.namespace(key, 'raw')
  }

  async createSigningKeyPair () {
    const { publicKey, secretKey } = createSigningKeyPair()
    await this._store.set(publicKey, secretKey)
    return await this.get(publicKey)
  }

  async get (publicKey) {
    const getSecretKey = () => this._store.get(publicKey)
    if (!(await getSecretKey())) return
    return {
      type: 'signing',
      publicKey,
      async sign (message) {
        return sign(message, await getSecretKey())
      },
      async verify (message, signature) {
        return verify(message, signature, publicKey)
      }
    }
  }
}
