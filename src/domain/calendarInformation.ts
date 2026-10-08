import type { PlannerEvent } from './types'
const semesterInformation = new Set(["Anniversaire de la marche verte", "Le jour de l'indépendance", "Jour de l'an", "Anniversaire du Manifeste de l'Indépendance", "Nouvel an Amazigh", 'Vacances', 'Rattrapages'])
/** A semester period label is not an individual appointment. Precise exam
 * sessions still block their actual times when the school publishes them. */
export function isCalendarInformation(event: PlannerEvent) {
  return Boolean(event.externalId?.startsWith('edt:') && semesterInformation.has(event.title.trim())) || Boolean(event.externalId?.startsWith('life:s7-2026-2027:') && event.externalId.includes(':margin:'))
}
export function isRecoveryBlock(event: PlannerEvent) {
  return Boolean(event.externalId?.startsWith('life:s7-2026-2027:') && /:(sleep|rest)$/.test(event.externalId))
}
