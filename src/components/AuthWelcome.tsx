import { Brand } from './Brand'

export function AuthWelcome() {
  return (
    <aside className="auth-welcome">
      <Brand/>
      <div className="auth-welcome-copy">
        <span className="section-kicker">UN PEU PLUS DE CLARTÉ</span>
        <h2>Du temps pour<br/>ce qui compte.</h2>
        <p>Un planning pour avancer, un journal pour prendre du recul. Vos journées, vos projets et vos idées, réunis dans Horizon.</p>
      </div>
      <div className="auth-week-art" aria-hidden="true">
        <div className="auth-week-title"><span>Une semaine à votre rythme</span><span>◦ ◦ ◦</span></div>
        <div className="auth-week-days"><span>LUN</span><span>MAR</span><span>MER</span><span>JEU</span><span>VEN</span></div>
        <div className="auth-week-slots">
          <span className="auth-slot auth-slot-course">Cours</span>
          <span className="auth-slot auth-slot-project">Projet</span>
          <span className="auth-slot auth-slot-focus">Focus</span>
          <span className="auth-slot auth-slot-personal">Pour soi</span>
          <i className="auth-week-line"/>
        </div>
      </div>
      <p className="auth-welcome-foot">Planifier. Écrire. Avancer.</p>
    </aside>
  )
}
