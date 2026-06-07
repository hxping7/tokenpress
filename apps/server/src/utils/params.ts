// Helper to extract single value from string | string[]
export function getParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

// Helper to extract single value as number
export function getParamAsInt(value: string | string[] | undefined): number | undefined {
  const str = getParam(value)
  if (!str) return undefined
  const num = parseInt(str)
  return isNaN(num) ? undefined : num
}
