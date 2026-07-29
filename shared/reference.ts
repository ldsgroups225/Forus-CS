export function formatNeedReference(date: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0 || sequence > 999)
    throw new Error('La séquence doit être comprise entre 1 et 999.')

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const suffix = String(sequence).padStart(3, '0')

  return `BS-${year}-${month}-${day}-${suffix}`
}
