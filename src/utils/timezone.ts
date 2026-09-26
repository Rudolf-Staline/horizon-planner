function partsInZone(value: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value).reduce<Record<string, number>>((parts, part) => {
      if (['year', 'month', 'day', 'hour', 'minute'].includes(part.type)) parts[part.type] = Number(part.value)
      return parts
    }, {})
  } catch {
    if (timeZone !== 'UTC') return partsInZone(value, 'UTC')
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
    }
  }
}

export function zonedDateToIso(value: Date, timeZone: string) {
  const parts = partsInZone(value, timeZone)
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function zonedDateMinutes(value: Date, timeZone: string) {
  const parts = partsInZone(value, timeZone)
  return parts.hour * 60 + parts.minute
}

export function localDateTimeToIso(date: string, minutes: number, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  let guess = target
  for (let index = 0; index < 3; index += 1) {
    const parts = partsInZone(new Date(guess), timeZone)
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    guess += target - represented
  }
  return new Date(guess).toISOString()
}
