const {
  createSigningKeyPair,
  // validateSigningKeyPair,
  sign,
  verify
  // createEncryptingKeyPair,
  // validateEncryptingKeyPair,
} = require('jlinx-util')
const JlinxVaultRecords = require('./records')

module.exports = class JlinxVaultKeyStore extends JlinxVaultRecords {
  async createSigningKeyPair () {
    const { publicKey, secretKey } = createSigningKeyPair()
    await this.set(publicKey, secretKey, 'raw')
    return await this.get(publicKey)
  }

  async get (publicKey) {
    const getSecretKey = () => super.get(publicKey)
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
