import { describe, expect, it } from 'vitest'
import { offlineQueryKey } from '../app/lib/offline-query-cache'
import { api } from '../convex/_generated/api'

describe('clé de cache des requêtes Convex', () => {
  it('utilise le nom de fonction Convex sans convertir la référence en chaîne', () => {
    expect(offlineQueryKey('user_123', api.organizations.getBySlug, { slug: 'forus-group' }))
      .toBe(JSON.stringify(['user_123', 'organizations:getBySlug', { slug: 'forus-group' }]))
  })
})
