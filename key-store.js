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
    console.log('CREATING SINING KEY PAIR', {
      publicKey, secretKey
    })
    await this._keys.set(publicKey, secretKey)
    // return this.get(publicKey)
    const kp = await this.get(publicKey)
    await validateKeyPair(kp)
    return kp
  }

  async get(publicKey){
    console.trace('Vault KeyStore.get', publicKey)
    const getSecretKey = () => this._keys.get(publicKey)
    if (!(await getSecretKey())) {
      console.log('KEY NOT FOUND', publicKey)
      return
    }


    // TMP
    const secretKey = await getSecretKey()
    console.log('GETTING SINING KEY PAIR', {
      publicKey, secretKey
    })
    if (!validateSigningKeyPair({ publicKey, secretKey })){
      throw new Error('created invalid key pair')
    }


    return {
      type: 'signing',
      publicKey,
      async sign(message){
        console.trace('SIGNING!', {
          publicKey,
          secretKey: await getSecretKey(),
        })
        return sign(message, await getSecretKey())
      },
      async verify(message, signature){
        return verify(message, signature, publicKey)
      }
    }
  }
}


async function validateKeyPair(keyPair){
  console.log('VALIDATING KP', {keyPair})
  const message = Buffer.from('hello world')
  const signature = await keyPair.sign(message)
  const valid = await keyPair.verify(message, signature)
  if (!valid){
    throw new Error(`invalid key pair`)
  }
  return true
}
