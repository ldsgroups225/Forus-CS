export interface CallingTruckTypeCarrier {
  truckTypes: readonly string[]
}

export interface CallingTruckTypeOption {
  value: string
  label: string
}

export function normalizeTruckType(value: string) {
  return value.trim().toLocaleLowerCase('fr')
}

export function getCallingTruckTypeOptions(carriers: readonly CallingTruckTypeCarrier[]): CallingTruckTypeOption[] {
  const types = new Map<string, string>()

  for (const carrier of carriers) {
    for (const truckType of carrier.truckTypes) {
      const value = normalizeTruckType(truckType)
      if (value && !types.has(value))
        types.set(value, truckType.trim())
    }
  }

  return [...types.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'fr'))
}

export function matchesCallingTruckTypeFilter(carrier: CallingTruckTypeCarrier, selectedTypes: string[]) {
  return !selectedTypes.length
    || carrier.truckTypes.some(type => selectedTypes.includes(normalizeTruckType(type)))
}
