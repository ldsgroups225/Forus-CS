export interface CarrierMatchInput {
  carrierId: string
  truckTypes: readonly string[]
  destinations: readonly string[]
  activeVehicleTypes: readonly string[]
  availableVehicleCount: number
  documentsValid: boolean
  assignedAgentId?: string
}

export interface NeedMatchInput {
  truckType: string
  destination: string
  remainingTruckCount: number
}

export interface CarrierMatch {
  carrierId: string
  score: number
  reasons: string[]
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('fr')
}

export function scoreCarrierForNeed(
  carrier: CarrierMatchInput,
  need: NeedMatchInput,
): CarrierMatch {
  const reasons: string[] = []
  let score = 0
  const truckType = normalized(need.truckType)
  const destination = normalized(need.destination)
  const supportedTruckTypes = [...carrier.truckTypes, ...carrier.activeVehicleTypes]
    .map(normalized)

  if (supportedTruckTypes.some(value => value === truckType || value.includes(truckType) || truckType.includes(value))) {
    score += 40
    reasons.push('Type de camion compatible')
  }

  if (carrier.destinations.map(normalized).some(value =>
    value === destination || destination.includes(value) || value.includes(destination))) {
    score += 25
    reasons.push('Destination habituelle')
  }

  if (carrier.availableVehicleCount > 0) {
    const coverage = Math.min(
      carrier.availableVehicleCount,
      Math.max(1, need.remainingTruckCount),
    )
    score += Math.min(20, coverage * 5)
    reasons.push(`${carrier.availableVehicleCount} véhicule(s) disponible(s)`)
  }

  if (carrier.documentsValid) {
    score += 10
    reasons.push('Documents à jour')
  }

  if (carrier.assignedAgentId) {
    score += 5
    reasons.push('Transporteur déjà attribué')
  }

  return {
    carrierId: carrier.carrierId,
    score: Math.min(100, score),
    reasons,
  }
}

export function rankCarriersForNeed(
  carriers: readonly CarrierMatchInput[],
  need: NeedMatchInput,
) {
  return carriers
    .map(carrier => scoreCarrierForNeed(carrier, need))
    .filter(match => match.score > 0)
    .sort((left, right) =>
      right.score - left.score || left.carrierId.localeCompare(right.carrierId))
}
