import actionCache from '@convex-dev/action-cache/convex.config.js'
import aggregate from '@convex-dev/aggregate/convex.config.js'
import betterAuth from '@convex-dev/better-auth/convex.config'
import presence from '@convex-dev/presence/convex.config.js'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'
import workpool from '@convex-dev/workpool/convex.config.js'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(betterAuth)
app.use(rateLimiter)
app.use(actionCache)
app.use(presence)
app.use(workpool, { name: 'transcriptionWorkpool' })
app.use(aggregate, { name: 'reportEvents' })
app.use(aggregate, { name: 'callsByOrganization' })
app.use(aggregate, { name: 'availableCallsByOrganization' })
app.use(aggregate, { name: 'callsByAgent' })

export default app
