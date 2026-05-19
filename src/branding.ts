export function resolveCompanyName(companyName: string | undefined): string {
  return companyName?.trim() || 'ZYNKPOS'
}
