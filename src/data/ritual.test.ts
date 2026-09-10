import { beforeEach, expect, it } from 'vitest'
import { clearRecords } from './db'
import { createGoal, readAll } from './repo'
import { makeGoal } from '@/domain/schema'
import { sigilOf } from '@/domain/identity'

beforeEach(async () => {
  await clearRecords()
})
it('plants exactly the crest previewed and refuses a duplicate without overwriting its record', async () => {
  const draft = {
    id: 'reserved-ritual',
    kind: 'numeric' as const,
    title: 'The expedition',
    target: 100,
    difficulty: 5 as const,
  }
  const preview = sigilOf(makeGoal(draft))
  const planted = await createGoal(draft, ['First gate'])
  expect(sigilOf(planted.goal)).toEqual(preview)
  const before = await readAll()
  await expect(createGoal({ ...draft, title: 'Overwrite attempt' })).rejects.toThrow()
  expect(await readAll()).toEqual(before)
})
