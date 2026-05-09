export const HOLIDAY_REMOTE_SOURCE_TEMPLATES = [
  'https://raw.githubusercontent.com/Saxon-Liu/holiday-calendar/main/data/CN/{year}.json',
  'https://unpkg.com/holiday-calendar/data/CN/{year}.json',
  'https://gcore.jsdelivr.net/gh/cg-zhou/holiday-calendar@main/data/CN/{year}.json',
] as const

export const HOLIDAY_REMOTE_CONNECT_SOURCES = Array.from(
  new Set(
    HOLIDAY_REMOTE_SOURCE_TEMPLATES.map((template) => {
      const url = new URL(template.replace('{year}', '2000'))
      return url.origin
    }),
  ),
)

export function buildHolidayRemoteSourceUrl(template: string, year: number) {
  return template.replace('{year}', String(year))
}
