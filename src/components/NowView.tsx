import { Pause, Square } from 'lucide-react'
import type { PlannerEvent } from '../domain/types'
import { formatTime } from '../utils/time'

export function NowView({ events }: { events: PlannerEvent[] }) {
  const sorted = [...events].sort((a,b) => a.day - b.day || a.startMin - b.startMin)
  const current = sorted.find((e) => e.day === 2 && e.startMin <= 14*60+42 && e.startMin + e.durationMin > 14*60+42) ?? sorted.find((e) => e.day === 2)!
  const upcoming = sorted.filter((e) => e.day === 2 && e.startMin > (current?.startMin ?? 0)).slice(0,3)
  return (
    <main className="now-page">
      <div className="now-time">14:42</div>
      <div className="now-date">Mercredi 22 mai 2024</div>
      <section className="current-focus">
        <span className="eyebrow">FOCUS EN COURS</span>
        <h1>{current?.title ?? 'Projet – App'}</h1>
        <p>Une seule chose à la fois. Le reste peut attendre.</p>
        <div className="remaining">38 min restantes</div>
        <div className="focus-actions"><button><Pause size={17}/>Pause</button><button><Square size={16}/>Terminer</button></div>
      </section>
      <section className="upcoming"><h2>Ensuite</h2>{upcoming.map((e) => <div className="upcoming-row" key={e.id}><time>{formatTime(e.startMin)}</time><span>{e.title}</span></div>)}</section>
      <blockquote>« Discipline aujourd’hui, liberté demain. »</blockquote>
    </main>
  )
}
