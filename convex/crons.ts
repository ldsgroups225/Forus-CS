import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'relances transporteurs echues',
  { minutes: 15 },
  internal.notifications.sendDueFollowUpReminders,
)

export default crons
