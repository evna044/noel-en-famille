import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Gift, LockKeyhole, LogOut, Snowflake, TreePine } from 'lucide-react'
import { supabase, supabaseReady } from './supabase'
import type { Session } from '@supabase/supabase-js'

const target = new Date('2026-12-24T20:00:00+01:00')

function getCountdown() {
  const distance = Math.max(0, target.getTime() - Date.now())
  return {
    days: Math.floor(distance / 86400000),
    hours: Math.floor((distance % 86400000) / 3600000),
    minutes: Math.floor((distance % 3600000) / 60000),
    seconds: Math.floor((distance % 60000) / 1000),
  }
}

export default function App() {
  const [countdown, setCountdown] = useState(getCountdown())
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getCountdown()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  const countdownItems = useMemo(() => [
    ['Jours', countdown.days], ['Heures', countdown.hours],
    ['Minutes', countdown.minutes], ['Secondes', countdown.seconds],
  ] as const, [countdown])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    setMessage(error ? 'Connexion impossible. Vérifie ton e-mail et ton mot de passe.' : '')
  }

  async function resetPassword() {
    if (!supabase || !email.trim()) {
      setMessage('Entre ton adresse e-mail pour recevoir le lien de réinitialisation.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setMessage(error ? 'Impossible d’envoyer le lien pour le moment.' : 'Si cette adresse possède un compte, un e-mail de réinitialisation va être envoyé.')
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return (
    <main>
      <div className="snow snow-one">✧</div><div className="snow snow-two">❄</div><div className="snow snow-three">✦</div>
      <header className="topbar"><div className="brand"><TreePine size={22} /> <span>Noël en famille</span></div><span className="year">ÉDITION 2026</span></header>
      <section className="hero">
        <div className="eyebrow"><Snowflake size={15}/> LA MAGIE DE NOËL, ENSEMBLE</div>
        <h1>Les plus beaux cadeaux<br/><em>sont ceux qu’on partage.</em></h1>
        <p className="intro">Un petit espace rien que pour notre famille, pour préparer Noël et faire plaisir à ceux qu’on aime.</p>
        <div className="tree-art" aria-label="Illustration d’un sapin de Noël">
          <div className="star">✦</div><div className="tree-layer layer-one"/><div className="tree-layer layer-two"/><div className="tree-layer layer-three"/>
          <div className="trunk"/><span className="ornament o1"/><span className="ornament o2"/><span className="ornament o3"/><span className="ornament o4"/>
        </div>
        <div className="countdown-wrap"><div className="countdown-label">LE COMPTE À REBOURS EST LANCÉ</div><div className="countdown">
          {countdownItems.map(([label, value]) => <div className="time-unit" key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}
        </div><p className="date-note">Rendez-vous le 24 décembre à 20 h</p></div>
      </section>

      <section className="login-card" id="connexion">
        {session ? <><div className="card-icon"><Gift size={22}/></div><h2>Bienvenue !</h2><p className="card-copy">Tu es connecté à l’espace familial.</p><button className="primary" onClick={() => setMessage('La prochaine étape sera d’afficher les listes de cadeaux ici.')}>Accéder à ma liste <ArrowRight size={17}/></button><button className="text-button" onClick={signOut}><LogOut size={15}/> Se déconnecter</button></>
        : <><div className="card-icon"><LockKeyhole size={22}/></div><h2>Notre espace familial</h2><p className="card-copy">Connecte-toi pour découvrir les listes de cadeaux.</p>
          <form onSubmit={signIn}>
            <label htmlFor="email">Adresse e-mail</label><input id="email" type="email" autoComplete="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required/>
            <label htmlFor="password">Mot de passe</label><input id="password" type="password" autoComplete="current-password" placeholder="Ton mot de passe" value={password} onChange={e => setPassword(e.target.value)} required/>
            <button className="primary" disabled={busy || !supabaseReady}>{busy ? 'Connexion…' : 'Se connecter'} <ArrowRight size={17}/></button>
          </form>
          <button className="text-button" onClick={resetPassword}>Mot de passe oublié ?</button>
          {!supabaseReady && <p className="notice">Le site doit encore être relié à ton projet Supabase. Suis le guide dans README.md.</p>}
        </>}
        {message && <p className="message" role="status">{message}</p>}
      </section>
      <footer>Fait avec <span>♥</span> pour notre famille · Noël 2026</footer>
    </main>
  )
}
