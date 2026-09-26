import type { PlannerEvent } from './types'

export const seedEvents: PlannerEvent[] = [
  { id: 'r1', title: 'Sport', day: 0, startMin: 420, durationMin: 45, category: 'routine', kind: 'fixed' },
  { id: 'c1', title: 'Cours – Analyse', day: 0, startMin: 480, durationMin: 90, category: 'course', kind: 'fixed' },
  { id: 'p1', title: 'SignalForge', day: 0, startMin: 840, durationMin: 120, category: 'focus', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'a1', title: 'Révision EDP', day: 0, startMin: 990, durationMin: 90, category: 'admin', kind: 'flexible', windowStartMin: 960, windowEndMin: 1140 },
  { id: 'm1', title: 'Session ML', day: 0, startMin: 1200, durationMin: 90, category: 'project', kind: 'fixed' },

  { id: 'r2', title: 'Sport', day: 1, startMin: 420, durationMin: 45, category: 'routine', kind: 'fixed' },
  { id: 't1', title: 'Trajet', day: 1, startMin: 480, durationMin: 45, category: 'personal', kind: 'fixed' },
  { id: 'c2', title: 'Cours – Probabilités', day: 1, startMin: 540, durationMin: 90, category: 'course', kind: 'fixed' },
  { id: 'x1', title: 'Projet – App', day: 1, startMin: 840, durationMin: 120, category: 'project', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'l1', title: 'Lecture', day: 1, startMin: 990, durationMin: 60, category: 'focus', kind: 'flexible', windowStartMin: 960, windowEndMin: 1200 },

  { id: 'r3', title: 'Sport', day: 2, startMin: 420, durationMin: 45, category: 'routine', kind: 'fixed' },
  { id: 'c3', title: 'Cours – Statistiques', day: 2, startMin: 480, durationMin: 90, category: 'course', kind: 'fixed' },
  { id: 'e1', title: 'Emails', day: 2, startMin: 600, durationMin: 60, category: 'personal', kind: 'flexible', windowStartMin: 570, windowEndMin: 720 },
  { id: 'f1', title: 'Focus – Rapport', day: 2, startMin: 840, durationMin: 150, category: 'focus', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'ad1', title: 'Admin', day: 2, startMin: 1020, durationMin: 60, category: 'admin', kind: 'flexible', windowStartMin: 960, windowEndMin: 1140 },
  { id: 'l2', title: 'Lecture', day: 2, startMin: 1200, durationMin: 60, category: 'routine', kind: 'fixed' },

  { id: 'r4', title: 'Sport', day: 3, startMin: 420, durationMin: 45, category: 'routine', kind: 'fixed' },
  { id: 't2', title: 'Trajet', day: 3, startMin: 480, durationMin: 45, category: 'personal', kind: 'fixed' },
  { id: 'c4', title: 'Cours – Machine Learning', day: 3, startMin: 540, durationMin: 90, category: 'course', kind: 'fixed' },
  { id: 'p2', title: 'Projet perso', day: 3, startMin: 840, durationMin: 120, category: 'project', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'g1', title: 'Réunion groupe', day: 3, startMin: 990, durationMin: 60, category: 'admin', kind: 'fixed' },
  { id: 'm2', title: 'Session ML', day: 3, startMin: 1200, durationMin: 90, category: 'project', kind: 'fixed' },

  { id: 'r5', title: 'Sport', day: 4, startMin: 420, durationMin: 45, category: 'routine', kind: 'fixed' },
  { id: 'c5', title: 'Cours – RO', day: 4, startMin: 480, durationMin: 90, category: 'course', kind: 'fixed' },
  { id: 'w1', title: 'Écriture', day: 4, startMin: 840, durationMin: 120, category: 'focus', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'pl1', title: 'Planification', day: 4, startMin: 990, durationMin: 60, category: 'neutral', kind: 'flexible', windowStartMin: 960, windowEndMin: 1140 },
  { id: 's1', title: 'Sortie / Amis', day: 4, startMin: 1140, durationMin: 120, category: 'personal', kind: 'fixed' },

  { id: 'h1', title: 'Randonnée', day: 5, startMin: 480, durationMin: 180, category: 'routine', kind: 'fixed' },
  { id: 'pb1', title: 'Power BI', day: 5, startMin: 840, durationMin: 120, category: 'course', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'film', title: 'Film', day: 5, startMin: 1200, durationMin: 120, category: 'focus', kind: 'fixed' },

  { id: 'free', title: 'Temps libre', day: 6, startMin: 480, durationMin: 240, category: 'neutral', kind: 'fixed' },
  { id: 'rev', title: 'Révisions', day: 6, startMin: 840, durationMin: 120, category: 'personal', kind: 'flexible', windowStartMin: 780, windowEndMin: 1080 },
  { id: 'prep', title: 'Préparation semaine', day: 6, startMin: 1020, durationMin: 90, category: 'routine', kind: 'flexible', windowStartMin: 960, windowEndMin: 1140 },
]
