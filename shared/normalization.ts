export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('fr')
}

export function normalizePhoneKey(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('225'))
    return digits.slice(3)

  return digits
}

export function splitNormalizedList(value: string) {
  return [...new Set(
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  )]
}
