
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight, Gift, LogOut, Plus, Save, Snowflake,
  Trash2, TreePine, Pencil, X, UserRound,
} from 'lucide-react'
import { supabase, supabaseReady } from './supabase'
import type { Session } from '@supabase/supabase-js'

type Profile = {
  id: string
  username: string
  display_name: string
  avatar_key: string
  role: string
}

type Wishlist = {
  id: string
  owner_id: string
  year: number
  archived: boolean
}

type GiftItem = {
  id: string
  wishlist_id: string
  title: string
  price: number | null
  link: string | null
  description: string | null
}

const YEAR = 2026
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

const avatarEmoji: Record<string, string> = {
  santa: '🎅',
  reindeer: '🦌',
  snowman: '⛄',
  elf: '🧝',
  polar_bear: '🐻‍❄️',
  penguin: '🐧',
  tree: '🎄',
  gingerbread: '🍪',
}

export default function App() {
  const [countdown, setCountdown] = useState(getCountdown())
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [editingGift, setEditingGift] = useState<GiftItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [giftTitle, setGiftTitle] = useState('')
  const [giftPrice, setGiftPrice] = useState('')
  const [giftLink, setGiftLink] = useState('')
  const [giftDescription, setGiftDescription] = useState('')

  useEffect(() => {
    const timer = window.setInterval(
      () => setCountdown(getCountdown()),
      1000
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase) return

    const client = supabase

    client.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setMessage('')
      }
    )

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user.id) {
      void loadFamilyList(session.user.id)
    } else {
      setProfile(null)
      setWishlist(null)
      setGifts([])
    }
  }, [session?.user.id])

  const countdownItems = useMemo(() => [
    ['Jours', countdown.days],
    ['Heures', countdown.hours],
    ['Minutes', countdown.minutes],
    ['Secondes', countdown.seconds],
  ] as const, [countdown])

  async function loadFamilyList(userId: string) {
    if (!supabase) return

    const client = supabase
    setLoadingList(true)
    setMessage('')

    try {
      const { data: profileData, error: profileError } =
        await client
          .from('profiles')
          .select('id, username, display_name, avatar_key, role')
          .eq('id', userId)
          .maybeSingle()

      if (profileError) throw profileError

      setProfile(profileData as Profile | null)

      let { data: wishlistData, error: wishlistError } =
        await client
          .from('wishlist_years')
          .select('id, owner_id, year, archived')
          .eq('owner_id', userId)
          .eq('year', YEAR)
          .maybeSingle()

      if (wishlistError) throw wishlistError

      if (!wishlistData) {
        const { data: createdWishlist, error: createError } =
          await client
            .from('wishlist_years')
            .insert({
              owner_id: userId,
              year: YEAR,
              archived: false,
            })
            .select('id, owner_id, year, archived')
            .single()

        if (createError) throw createError

        wishlistData = createdWishlist
      }

      setWishlist(wishlistData as Wishlist)

      const { data: giftData, error: giftsError } =
        await client
          .from('gifts')
          .select('id, wishlist_id, title, price, link, description')
          .eq('wishlist_id', wishlistData.id)
          .order('created_at', { ascending: false })

      if (giftsError) throw giftsError

      setGifts((giftData || []) as GiftItem[])

    } catch (error) {
      console.error('Erreur de chargement :', error)
      setMessage(
        "Impossible de charger ta liste. Vérifie les autorisations Supabase (RLS) et réessaie."
      )
    } finally {
      setLoadingList(false)
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setBusy(false)

    if (error) {
      setMessage(
        'Connexion impossible. Vérifie ton e-mail et ton mot de passe.'
      )
    }
  }

  async function resetPassword() {
    if (!supabase || !email.trim()) {
      setMessage(
        'Entre ton adresse e-mail pour recevoir le lien de réinitialisation.'
      )
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim()
    )

    setMessage(
      error
        ? 'Impossible d’envoyer le lien pour le moment.'
        : 'Si cette adresse possède un compte, un e-mail de réinitialisation va être envoyé.'
    )
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  function openNewGift() {
    setEditingGift(null)
    setGiftTitle('')
    setGiftPrice('')
    setGiftLink('')
    setGiftDescription('')
    setFormOpen(true)
  }

  function openEditGift(item: GiftItem) {
    setEditingGift(item)
    setGiftTitle(item.title)
    setGiftPrice(item.price == null ? '' : String(item.price))
    setGiftLink(item.link || '')
    setGiftDescription(item.description || '')
    setFormOpen(true)
  }

  async function saveGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !wishlist || !giftTitle.trim()) return

    setBusy(true)
    setMessage('')

    const values = {
      wishlist_id: wishlist.id,
      title: giftTitle.trim(),
      price: giftPrice.trim() ? Number(giftPrice) : null,
      link: giftLink.trim() || null,
      description: giftDescription.trim() || null,
    }

    const result = editingGift
      ? await supabase
          .from('gifts')
          .update(values)
          .eq('id', editingGift.id)
      : await supabase
          .from('gifts')
          .insert(values)

    setBusy(false)

    if (result.error) {
      console.error(result.error)
      setMessage(
        "Impossible d'enregistrer ce cadeau. Vérifie les autorisations Supabase."
      )
      return
    }

    setFormOpen(false)

    if (session?.user.id) {
      await loadFamilyList(session.user.id)
    }
  }

  async function deleteGift(item: GiftItem) {
    if (!supabase) return

    if (!window.confirm(`Supprimer « ${item.title} » ?`)) {
      return
    }

    const { error } = await supabase
      .from('gifts')
      .delete()
      .eq('id', item.id)

    if (error) {
      console.error(error)
      setMessage(
        'Impossible de supprimer ce cadeau. Vérifie les autorisations Supabase.'
      )
      return
    }

    setGifts(current =>
      current.filter(gift => gift.id !== item.id)
    )
  }

  const displayName =
    profile?.display_name ||
    profile?.username ||
    'Membre de la famille'

  const avatar = profile?.avatar_key
    ? (avatarEmoji[profile.avatar_key] || '🎄')
    : '🎄'

  return (
    <main>
      <div className="snow snow-one">✧</div>
      <div className="snow snow-two">❄</div>
      <div className="snow snow-three">✦</div>

      <header className="topbar">
        <div className="brand">
          <TreePine size={22} />
          <span>Noël en famille</span>
        </div>
        <span className="year">ÉDITION {YEAR}</span>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <Snowflake size={15}/> LA MAGIE DE NOËL, ENSEMBLE
        </div>

        <h1>
          Les plus beaux cadeaux<br/>
          <em>sont ceux qu’on partage.</em>
        </h1>

        <p className="intro">
          Un petit espace rien que pour notre famille,
          pour préparer Noël et faire plaisir à ceux qu’on aime.
        </p>

        <div className="tree-art" aria-label="Illustration d’un sapin de Noël">
          <div className="star">✦</div>
          <div className="tree-layer layer-one"/>
          <div className="tree-layer layer-two"/>
          <div className="tree-layer layer-three"/>
          <div className="trunk"/>
          <span className="ornament o1"/>
          <span className="ornament o2"/>
          <span className="ornament o3"/>
          <span className="ornament o4"/>
        </div>

        <div className="countdown-wrap">
          <div className="countdown-label">
            LE COMPTE À REBOURS EST LANCÉ
          </div>

          <div className="countdown">
            {countdownItems.map(([label, value]) => (
              <div className="time-unit" key={label}>
                <strong>{String(value).padStart(2, '0')}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <p className="date-note">
            Rendez-vous le 24 décembre à 20 h
          </p>
        </div>
      </section>

      {!session ? (
        <section className="login-card" id="connexion">
          <div className="card-icon">
            <UserRound size={22}/>
          </div>

          <h2>Notre espace familial</h2>
          <p className="card-copy">
            Connecte-toi pour découvrir les listes de cadeaux.
          </p>

          <form onSubmit={signIn}>
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Ton mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <button
              className="primary"
              disabled={busy || !supabaseReady}
            >
              {busy ? 'Connexion…' : 'Se connecter'}
              <ArrowRight size={17}/>
            </button>
          </form>

          <button className="text-button" onClick={resetPassword}>
            Mot de passe oublié ?
          </button>

          {!supabaseReady && (
            <p className="notice">
              Le site doit encore être relié à ton projet Supabase.
            </p>
          )}

          {message && (
            <p className="message" role="status">{message}</p>
          )}
        </section>
      ) : (
        <section className="family-area">
          <div className="welcome-panel">
            <div className="welcome-avatar">{avatar}</div>

            <div className="welcome-text">
              <span className="welcome-kicker">
                TON ESPACE PERSONNEL
              </span>
              <h2>Bonjour {displayName} !</h2>
              <p>
                {profile?.role === 'admin'
                  ? 'Administrateur'
                  : 'Membre de la famille'}
                {' · Préparons Noël ensemble.'}
              </p>
            </div>

            <button className="text-button signout" onClick={signOut}>
              <LogOut size={15}/> Se déconnecter
            </button>
          </div>

          <div className="list-heading">
            <div>
              <span className="welcome-kicker">ÉDITION {YEAR}</span>
              <h2>Ma liste de cadeaux</h2>
            </div>

            <button className="primary add-button" onClick={openNewGift}>
              <Plus size={17}/> Ajouter un cadeau
            </button>
          </div>

          {loadingList && (
            <p className="empty-state">Préparation de ton espace…</p>
          )}

          {!loadingList && gifts.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <Gift size={25}/>
              </div>
              <h3>Ta liste est encore vide</h3>
              <p>
                Ajoute ton premier souhait pour commencer ta liste de Noël.
              </p>
              <button className="primary" onClick={openNewGift}>
                <Plus size={17}/> Ajouter mon premier cadeau
              </button>
            </div>
          )}

          {gifts.length > 0 && (
            <div className="gift-grid">
              {gifts.map(item => (
                <article className="gift-card" key={item.id}>
                  <div className="gift-card-top">
                    <span className="gift-card-icon">🎁</span>

                    <div className="gift-actions">
                      <button
                        className="icon-button"
                        aria-label="Modifier le cadeau"
                        onClick={() => openEditGift(item)}
                      >
                        <Pencil size={16}/>
                      </button>

                      <button
                        className="icon-button delete"
                        aria-label="Supprimer le cadeau"
                        onClick={() => void deleteGift(item)}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>

                  <h3>{item.title}</h3>

                  {item.price != null && (
                    <p className="gift-price">
                      {item.price.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </p>
                  )}

                  {item.description && (
                    <p className="gift-description">
                      {item.description}
                    </p>
                  )}

                  {item.link && (
                    <a
                      className="gift-link"
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir le cadeau <ArrowRight size={14}/>
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}

          {message && (
            <p className="message list-message" role="status">
              {message}
            </p>
          )}
        </section>
      )}

      {formOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setFormOpen(false)
            }
          }}
        >
          <section
            className="gift-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="welcome-kicker">TA LISTE DE NOËL</span>
                <h2 id="gift-modal-title">
                  {editingGift ? 'Modifier le cadeau' : 'Ajouter un cadeau'}
                </h2>
              </div>

              <button
                className="icon-button"
                aria-label="Fermer"
                onClick={() => setFormOpen(false)}
              >
                <X size={19}/>
              </button>
            </div>

            <form onSubmit={saveGift}>
              <label htmlFor="gift-title">Nom du cadeau *</label>
              <input
                id="gift-title"
                value={giftTitle}
                onChange={e => setGiftTitle(e.target.value)}
                placeholder="Ex. Un livre, un jeu…"
                required
                maxLength={120}
              />

              <label htmlFor="gift-price">Prix (€)</label>
              <input
                id="gift-price"
                type="number"
                min="0"
                step="0.01"
                value={giftPrice}
                onChange={e => setGiftPrice(e.target.value)}
                placeholder="Ex. 25"
              />

              <label htmlFor="gift-link">Lien du cadeau</label>
              <input
                id="gift-link"
                type="url"
                value={giftLink}
                onChange={e => setGiftLink(e.target.value)}
                placeholder="https://…"
              />

              <label htmlFor="gift-description">Description</label>
              <textarea
                id="gift-description"
                rows={3}
                value={giftDescription}
                onChange={e => setGiftDescription(e.target.value)}
                placeholder="Quelques précisions…"
              />

              <div className="modal-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setFormOpen(false)}
                >
                  Annuler
                </button>

                <button
                  className="primary"
                  disabled={busy || !giftTitle.trim()}
                >
                  <Save size={16}/>
                  {busy ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <footer>
        Fait avec <span>♥</span> pour notre famille · Noël {YEAR}
      </footer>
    </main>
  )
}
