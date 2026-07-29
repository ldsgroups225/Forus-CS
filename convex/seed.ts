import type { NeedStatus, NeedUrgency } from '../shared/domain'
import type { Id } from './_generated/dataModel'
import { deriveNeedProgress } from '../shared/needProgress'
import { mutation } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requireAuthenticatedUser } from './lib/authz'
import { generateNeedReference } from './lib/needs'

const seedKey = 'forus-cs-v1'

interface SeedNeed {
  clientIndex: number
  projectName: string
  urgency: NeedUrgency
  truckType: string
  requested: number
  approved: number
  tonnage: number
  cargo: string
  loading: string
  destination: string
  status: NeedStatus
}

const seedNeeds: SeedNeed[] = [
  { clientIndex: 0, projectName: 'Extension dépôt Vridi', urgency: 'CRITICAL', truckType: 'Benne 12 roues', requested: 12, approved: 4, tonnage: 35, cargo: 'Gravier', loading: 'Abidjan - Vridi', destination: 'Bondoukou', status: 'PARTIAL' },
  { clientIndex: 1, projectName: 'Approvisionnement usine', urgency: 'HIGH', truckType: 'Semi-remorque', requested: 8, approved: 0, tonnage: 30, cargo: 'Ciment', loading: 'San-Pédro', destination: 'Yamoussoukro', status: 'OPEN' },
  { clientIndex: 2, projectName: 'Campagne cacao', urgency: 'MEDIUM', truckType: 'Plateau', requested: 5, approved: 0, tonnage: 20, cargo: 'Cacao en sacs', loading: 'Daloa', destination: 'Abidjan', status: 'DRAFT' },
  { clientIndex: 0, projectName: 'Chantier Nord', urgency: 'HIGH', truckType: 'Porteur', requested: 6, approved: 6, tonnage: 15, cargo: 'Matériaux de construction', loading: 'Abidjan', destination: 'Korhogo', status: 'SATISFIED' },
  { clientIndex: 1, projectName: 'Distribution régionale', urgency: 'LOW', truckType: 'Fourgon', requested: 3, approved: 0, tonnage: 10, cargo: 'Produits alimentaires', loading: 'Bouaké', destination: 'Man', status: 'CANCELLED' },
  { clientIndex: 2, projectName: 'Renfort minier', urgency: 'CRITICAL', truckType: 'Benne 10 roues', requested: 10, approved: 2, tonnage: 30, cargo: 'Minerai', loading: 'Séguéla', destination: 'Abidjan', status: 'PARTIAL' },
  { clientIndex: 0, projectName: 'Livraison hydrocarbures', urgency: 'HIGH', truckType: 'Citerne', requested: 4, approved: 0, tonnage: 25, cargo: 'Hydrocarbures', loading: 'Abidjan - Vridi', destination: 'Bouaké', status: 'OPEN' },
  { clientIndex: 1, projectName: 'Transfert équipements', urgency: 'MEDIUM', truckType: 'Porte-char', requested: 2, approved: 0, tonnage: 40, cargo: 'Engins de chantier', loading: 'San-Pédro', destination: 'Abengourou', status: 'DRAFT' },
]

export const seedDevelopment = mutation({
  args: {},
  handler: async (ctx) => {
    // eslint-disable-next-line node/prefer-global/process
    const siteUrl = process.env.SITE_URL ?? ''
    if (!siteUrl.startsWith('http://localhost') && !siteUrl.startsWith('http://127.0.0.1'))
      throw new Error('DEVELOPMENT_SEED_DISABLED')

    const { userId } = await requireAuthenticatedUser(ctx)
    const now = Date.now()
    let organization = await ctx.db
      .query('organizations')
      .withIndex('by_slug', query => query.eq('slug', 'forus-group'))
      .unique()

    if (!organization) {
      const organizationId = await ctx.db.insert('organizations', {
        name: 'FORUS GROUP',
        slug: 'forus-group',
        isActive: true,
        createdAt: now,
        createdBy: userId,
      })
      organization = await ctx.db.get(organizationId)
    }

    if (!organization)
      throw new Error('SEED_ORGANIZATION_FAILED')

    const organizationId = organization._id
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_organization_user', query =>
        query.eq('organizationId', organizationId).eq('userId', userId))
      .unique()

    if (!membership) {
      await ctx.db.insert('memberships', {
        organizationId,
        userId,
        role: 'ORGANIZATION_ADMIN',
        isActive: true,
        createdAt: now,
      })
    }

    const marker = await ctx.db
      .query('developmentSeeds')
      .withIndex('by_organization_key', query =>
        query.eq('organizationId', organizationId).eq('key', seedKey))
      .unique()

    if (marker)
      return { organizationId, slug: organization.slug, seeded: false }

    const seedClients = [
      { name: 'FORUS Industries', contactName: 'Aminata Koné', phone: '+225 07 08 09 10 11' },
      { name: 'SIFCA Logistique', contactName: 'Yao Kouassi', phone: '+225 05 06 07 08 09' },
      { name: 'Côte d’Ivoire BTP', contactName: 'Mariam Traoré', phone: '+225 01 02 03 04 05' },
    ]
    const clientIds: Id<'clients'>[] = []

    for (const client of seedClients) {
      const existing = await ctx.db
        .query('clients')
        .withIndex('by_organization_name', query =>
          query.eq('organizationId', organizationId).eq('name', client.name))
        .unique()

      const clientId = existing?._id ?? await ctx.db.insert('clients', {
        organizationId,
        ...client,
        isActive: true,
        createdAt: now,
        createdBy: userId,
      })
      clientIds.push(clientId)
    }

    for (const [index, item] of seedNeeds.entries()) {
      const createdAt = now - (seedNeeds.length - index) * 60 * 60 * 1000
      const progress = deriveNeedProgress(
        item.requested,
        item.approved,
        item.status === 'CANCELLED',
      )
      const reference = await generateNeedReference(ctx, organizationId, new Date(createdAt))
      const status = item.status === 'DRAFT' ? 'DRAFT' : progress.status
      const clientId = clientIds[item.clientIndex]

      if (!clientId)
        throw new Error('SEED_CLIENT_MISSING')

      const needId = await ctx.db.insert('needs', {
        organizationId,
        reference,
        clientId,
        projectName: item.projectName,
        urgency: item.urgency,
        truckType: item.truckType,
        requestedTruckCount: item.requested,
        approvedTruckCount: item.approved,
        remainingTruckCount: progress.remainingTruckCount,
        tonnageTons: item.tonnage,
        cargoType: item.cargo,
        loadingLocation: item.loading,
        destination: item.destination,
        mobilizationAt: now + (index + 1) * 24 * 60 * 60 * 1000,
        targetCarrierPrice: 1_750_000 + index * 125_000,
        maximumCarrierPrice: 2_100_000 + index * 125_000,
        paymentTerms: 'Net à payer après livraison',
        negotiationAllowed: true,
        constraints: index % 2 === 0 ? 'Documents du véhicule à jour obligatoires.' : '',
        status,
        publishedAt: status === 'DRAFT' ? undefined : createdAt + 10 * 60 * 1000,
        cancelledAt: status === 'CANCELLED' ? createdAt + 30 * 60 * 1000 : undefined,
        lastUpdatedAt: createdAt,
        createdAt,
        createdBy: userId,
        updatedBy: userId,
      })

      await writeAuditLog(ctx, {
        organizationId,
        actorId: userId,
        entityType: 'need',
        entityId: needId,
        action: 'DEVELOPMENT_SEED',
        newValue: { reference, status },
      })
    }

    await ctx.db.insert('developmentSeeds', {
      organizationId,
      key: seedKey,
      createdAt: now,
    })

    return { organizationId, slug: organization.slug, seeded: true }
  },
})
