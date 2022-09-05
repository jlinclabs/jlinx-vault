// const b4a = require('b4a')
// const { randomBytes, createSigningKeyPair } = require('jlinx-util')
// const { test, createVault } = require('./helpers')
// const Vault = require('..')

// test('keystore', async (t) => {
//   const vault = await createVault(t)
//   const kp1 = await vault.keystore.createSigningKeyPair()
//   t.ok(kp1)
//   const kp2 = await vault.keystore.get(kp1.publicKey)
//   t.ok(b4a.equals(kp1.publicKey, kp2.publicKey))

//   const message = b4a.from('hello world')
//   const signature1 = await kp1.sign(message)
//   t.ok(await kp1.verify(message, signature1))
//   t.ok(await kp2.verify(message, signature1))

//   t.alike(
//     await vault.keystore.ids.all(),
//     [kp1.publicKey.toString()]
//   )
//   const kp3 = await vault.keystore.createSigningKeyPair()
//   t.alike(
//     (await vault.keystore.ids.all()).sort(),
//     [
//       kp1.publicKey.toString(),
//       kp3.publicKey.toString()
//     ].sort()
//   )
// })
