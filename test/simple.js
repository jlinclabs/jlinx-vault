const b4a = require('b4a')
const { randomBytes, createSigningKeyPair } = require('jlinx-util')
const { test } = require('./helpers')
const Vault = require('../')

test('simple', async (t, create) => {
  const vault = await create()

  t.same(await vault.get('emptykey'), undefined)
  t.same(await vault.has('emptykey'), false)
  t.same(await vault.set('name', 'Jared'), true)
  t.same(await vault.has('name'), true)
  t.same(await vault.get('name'), 'Jared')
  t.same(await vault.delete('name'), true)
  t.same(await vault.has('name'), false)
  t.same(await vault.delete('name'), false)

  for (let i = 0; i < 10; i++) {
    await vault.set(`${i}`, `${i * 10}`)
  }
  t.same(await vault.get('0'), '0')
  t.same(await vault.get('1'), '10')
  t.same(await vault.get('5'), '50')
  t.same(await vault.get('9'), '90')
})

test('raw encoding', async (t, create) => {
  const vault = await create()

  const random = randomBytes(64)

  await vault.set('seed', random, 'raw')
  t.ok(
    b4a.equals(
      await vault.get('seed'),
      random
    )
  )

  const keyPair = createSigningKeyPair()
  await vault.set(keyPair.publicKey, keyPair.secretKey, 'raw')
  const secretKey = await vault.get(keyPair.publicKey)
  t.ok(secretKey)
  t.ok(
    b4a.equals(
      secretKey,
      keyPair.secretKey
    )
  )
})

test('json encoding', async (t, create) => {
  const vault = await create()

  const config = {
    version: '1.2.1',
    hosts: [
      'https://example1.com',
      'https://example2.com'
    ],
    hostCount: 2
  }
  await vault.set('config', config, 'json')
  t.deepEqual(await vault.get('config'), config)
})

test('namespaces', async (t, create) => {
  const vault = await create()

  const keys = vault.namespace('keys', 'raw')
  const keyPair = createSigningKeyPair()
  await keys.set(keyPair.publicKey, keyPair.secretKey)
  const secretKey = await keys.get(keyPair.publicKey)
  t.ok(secretKey)
  t.ok(
    b4a.equals(
      secretKey,
      keyPair.secretKey
    )
  )

  const docs = vault.namespace('docs', 'json')
  await docs.set('1', { id: 1 })
  t.deepEqual(await docs.get('1'), { id: 1 })
})

test('bad key', async (t) => {
  let vault
  t.throws(() => {
    vault = new Vault()
  })
  t.throws(() => {
    vault = new Vault({
      key: ''
    })
  })
  t.same(vault, undefined)
})
