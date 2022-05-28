
const test = require('tape')
const Vault = require('../')
const { withDir } = require('./helpers')

test('simple', async t => {
  t.same(typeof Vault, 'function')

  await withDir(async dir => {
    const key = Vault.generateKey()
    const vault = new Vault({
      path: dir.path,
      key
    })
    console.log(vault)
    await vault.ready()
    console.log(vault)

    // const signingKeyPair = createSigningKeyPair()

    // t.same(await keys.has(signingKeyPair.publicKey), false)
    // t.same(await keys.get(signingKeyPair.publicKey), undefined)
    // t.same(await keys.put(signingKeyPair), true)
    // t.same(await keys.has(signingKeyPair.publicKey), true)
    // t.same(
    //   await keys.get(signingKeyPair.publicKey),
    //   signingKeyPair.secretKey
    // )
    // t.same(await keys.delete(signingKeyPair.publicKey), true)
    // t.same(await keys.has(signingKeyPair.publicKey), false)
    // t.same(await keys.get(signingKeyPair.publicKey), undefined)

    // const encryptingKeyPair = createEncryptingKeyPair()
    // t.same(await keys.put(encryptingKeyPair), true)
    // t.same(
    //   await keys.get(encryptingKeyPair.publicKey),
    //   encryptingKeyPair.secretKey
    // )
  })
})
