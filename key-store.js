const {
  createSigningKeyPair,
  // validateSigningKeyPair,
  sign,
  verify,
  // createEncryptingKeyPair,
  // validateEncryptingKeyPair,
} = require('jlinx-util')

module.exports = class KeyStore {

  constructor (vault) {
    this._keys = vault.namespace('keys', 'raw')
  }

  ready () { return this._vault.ready() }

  async create(){
    const { publicKey, secretKey } = createSigningKeyPair()
    await this._keys.set(publicKey, secretKey)
    return publicKey
  }

  async sign(message, publicKey){
    const secretKey = await this._keys.get(publicKey)
    return sign(message, secretKey)
  }

  async verify(message, signature, publicKey){
    return verify(message, signature, publicKey)
  }
}
