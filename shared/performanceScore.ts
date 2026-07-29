export interface AgentPerformanceInput {
  calls: number
  workingDays: number
  newCarriers: number
  submittedOptions: number
  completedFollowUps: number
  responseRate: number
}

export interface AgentPerformanceScore {
  activity: number
  baseDevelopment: number
  needTreatment: number
  portfolioQuality: number
  total: number
}

function percentage(value: number, target: number) {
  if (target <= 0)
    return 0

  return Math.min(100, Math.max(0, Math.round(value / target * 100)))
}

export function calculateAgentPerformance(
  input: AgentPerformanceInput,
): AgentPerformanceScore {
  const workingDays = Math.max(1, input.workingDays)
  const activity = Math.round(
    (percentage(input.calls, workingDays * 25) + percentage(input.responseRate, 80)) / 2,
  )
  const baseDevelopment = percentage(input.newCarriers, workingDays * 2)
  const needTreatment = percentage(input.submittedOptions, workingDays)
  const portfolioQuality = percentage(input.completedFollowUps, workingDays * 5)
  const total = Math.round(
    activity * 0.2
    + baseDevelopment * 0.3
    + needTreatment * 0.3
    + portfolioQuality * 0.2,
  )

  return {
    activity,
    baseDevelopment,
    needTreatment,
    portfolioQuality,
    total,
  }
}

export function estimatePerformanceBonus(
  score: number,
  maximumBonus: number,
) {
  if (!Number.isFinite(maximumBonus) || maximumBonus <= 0)
    return 0

  return Math.round(Math.min(100, Math.max(0, score)) / 100 * maximumBonus)
}
