const {
  createSigningKeyPair,
  validateSigningKeyPair,
  sign,
  verify,
  // createEncryptingKeyPair,
  // validateEncryptingKeyPair,
} = require('jlinx-util')

module.exports = class KeyStore {

  constructor (vault, key) {
    this._keys = vault.namespace(key, 'raw')
  }

  ready () { return this._vault.ready() }

  async createSigningKeyPair(){
    const { publicKey, secretKey } = createSigningKeyPair()
    await this._keys.set(publicKey, secretKey)
    return await this.get(publicKey)
  }

  async get(publicKey){
    const getSecretKey = () => this._keys.get(publicKey)
    if (!(await getSecretKey())) return
    return {
      type: 'signing',
      publicKey,
      async sign(message){
        return sign(message, await getSecretKey())
      },
      async verify(message, signature){
        return verify(message, signature, publicKey)
      }
    }
  }
}
