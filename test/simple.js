
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
    await vault.ready()

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
})
