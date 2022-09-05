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
  await keys.set(keyPair.publicKey, undefined)
  t.same(await keys.get(keyPair.publicKey), undefined)

  const docs = vault.namespace('docs', 'json')
  await docs.set('1', { id: 1 })
  await docs.set('2', null)
  await docs.set('3', undefined)
  t.deepEqual(await docs.get('1'), { id: 1 })
  t.same(await docs.get('2'), null)
  t.same(await docs.get('3'), undefined)

  await docs.set('1', undefined)
  t.same(await docs.get('1'), undefined)

  const names = vault.namespace('names', 'string')
  await names.set('dog', 'sparkey')
  await names.set('cat1', 'Hitch')
  await names.set('cat2', 'Samson')

  t.same(await names.get('dog'), 'sparkey')
  t.same(await names.get('cat1'), 'Hitch')
  t.same(await names.get('cat2'), 'Samson')

  // setting to undefined should delete
  await names.set('dog', undefined)
  t.same(await names.get('dog'), undefined)

  t.deepEqual(
    (await vault.keys()).sort(),
    [ 'docs.2', 'VERSION', 'names.cat1', 'KEY_CHECK', 'names.cat2' ].sort()
  )

  for (const key of await vault.keys()){
    await vault.delete(key)
  }

  t.deepEqual(
    (await vault.keys()),
    []
  )

  const recordsIdIndex = vault.namespace('records').namespace('idIndex')
  await recordsIdIndex.set('size', 14)
  t.same(await recordsIdIndex.get('size'), 14)

  t.deepEqual(
    (await vault.keys()),
    ['records.idIndex.size']
  )

  t.deepEqual(
    (await recordsIdIndex.keys()),
    ['size']
  )

  const deepKeys = vault.namespace('nested').namespace('deeply').namespace('keys', 'raw')
  await deepKeys.set(keyPair.publicKey, keyPair.secretKey)
  t.ok(
    b4a.equals(
      await deepKeys.get(keyPair.publicKey),
      keyPair.secretKey
    )
  )

  t.deepEqual(
    (await deepKeys.keys()),
    [keyPair.publicKey.toString()]
  )
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

test('records', async (t, create) => {
  const vault = await create()
  const posts = vault.records('posts')

  t.deepEqual(await posts.ids.all(), [])

  await posts.set('1', { id: 1 })
  t.deepEqual(await posts.ids.all(), ['1'])

  t.deepEqual(
    (await vault.keys()).sort(),
    [ 'posts.record:1', 'VERSION', 'posts.ids', 'KEY_CHECK' ].sort()
  )
  t.deepEqual(
    (await posts.vault.keys()).sort(),
    [ 'record:1', 'ids' ].sort()
  )

  await posts.set('2', { id: 2 })
  await posts.set(3, { id: 3 })
  t.deepEqual(await posts.ids.all(), ['1', '2', '3'])
  t.deepEqual(await posts.get('1'), { id: 1 })
  t.deepEqual(await posts.get('2'), { id: 2 })
  t.deepEqual(await posts.get('3'), { id: 3 })

  await posts.delete(2)
  t.deepEqual(await posts.ids.all(), ['1', '3'])
  t.deepEqual(await posts.get('1'), { id: 1 })
  t.is(await posts.get('2'), undefined)
  t.deepEqual(await posts.get('3'), { id: 3 })

  const blogComments = vault.namespace('blog').records('comments')
  await blogComments.set(12, { id: 12 })
  await blogComments.set(45, { id: 45 })
  t.deepEqual(await blogComments.get('8'), undefined)
  t.deepEqual(await blogComments.get('12'), { id: 12 })
  t.deepEqual(await vault.get('blog.comments.record:12'), { id: 12 })
})
