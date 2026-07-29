export function formatNeedReference(date: Date, sequence: number): string {
  return formatReference('BS', date, sequence)
}

export function formatOptionReference(date: Date, sequence: number): string {
  return formatReference('OPT', date, sequence)
}

export function formatMissionReference(date: Date, sequence: number): string {
  return formatReference('MS', date, sequence)
}

export function formatIncidentReference(date: Date, sequence: number): string {
  return formatReference('INC', date, sequence)
}

function formatReference(prefix: string, date: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0 || sequence > 999)
    throw new Error('La séquence doit être comprise entre 1 et 999.')

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const suffix = String(sequence).padStart(3, '0')

  return `${prefix}-${year}-${month}-${day}-${suffix}`
}
