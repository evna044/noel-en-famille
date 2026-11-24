import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight, Gift, LogOut, Plus, Save, Snowflake,
  Trash2, TreePine, Pencil, X, UserRound,
  ChevronLeft, ChevronRight, Users,
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

type GiftPhoto = {
  id: string
  gift_id: string
  storage_path: string
  sort_order: number
  url: string
}

type PhotoViewer = {
  giftId: string
  photoIndex: number
} | null

const YEAR = 2026
const target = new Date('2026-12-24T20:00:00+01:00')

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

  const [profile, setProfile] = useState<Profile | null>(null)
  const [familyProfiles, setFamilyProfiles] = useState<Profile[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const [editingGift, setEditingGift] = useState<GiftItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const [giftTitle, setGiftTitle] = useState('')
  const [giftPrice, setGiftPrice] = useState('')
  const [giftLink, setGiftLink] = useState('')
  const [giftDescription, setGiftDescription] = useState('')

  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([])
  const [giftPhotos, setGiftPhotos] = useState<Record<string, GiftPhoto[]>>({})
  const [photoViewer, setPhotoViewer] = useState<PhotoViewer>(null)

  const isAdmin = profile?.role === 'admin'
  const selectedProfile =
    familyProfiles.find(member => member.id === selectedMemberId) || profile

  const canManageSelectedList =
    Boolean(profile && selectedProfile) &&
    (isAdmin || selectedMemberId === profile?.id)

  const displayName =
    profile?.display_name || profile?.username || 'Membre de la famille'

  const selectedDisplayName =
    selectedProfile?.display_name ||
    selectedProfile?.username ||
    'Membre de la famille'

  const avatar = profile?.avatar_key
    ? avatarEmoji[profile.avatar_key] || '🎄'
    : '🎄'

  const countdownItems = useMemo(() => [
    ['Jours', countdown.days],
    ['Heures', countdown.hours],
    ['Minutes', countdown.minutes],
    ['Secondes', countdown.seconds],
  ] as const, [countdown])

  const viewerPhotos = photoViewer
    ? giftPhotos[photoViewer.giftId] || []
    : []

  const currentViewerPhoto =
    photoViewer && viewerPhotos.length > 0
      ? viewerPhotos[photoViewer.photoIndex]
      : null

  const currentViewerGift = photoViewer
    ? gifts.find(gift => gift.id === photoViewer.giftId)
    : null

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
      void loadFamily(session.user.id)
    } else {
      setProfile(null)
      setFamilyProfiles([])
      setSelectedMemberId('')
      setWishlist(null)
      setGifts([])
      setGiftPhotos({})
      setPhotoViewer(null)
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!photoViewer) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPhotoViewer(null)
      }

      if (event.key === 'ArrowLeft') {
        setPhotoViewer(current => {
          if (!current) return null
          const photos = giftPhotos[current.giftId] || []
          if (photos.length === 0) return null

          return {
            ...current,
            photoIndex:
              (current.photoIndex - 1 + photos.length) % photos.length,
          }
        })
      }

      if (event.key === 'ArrowRight') {
        setPhotoViewer(current => {
          if (!current) return null
          const photos = giftPhotos[current.giftId] || []
          if (photos.length === 0) return null

          return {
            ...current,
            photoIndex: (current.photoIndex + 1) % photos.length,
          }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photoViewer, giftPhotos])

  async function loadFamily(userId: string) {
    if (!supabase) return

    setLoadingList(true)
    setMessage('')

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_key, role')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) throw profileError
      if (!profileData) throw new Error('Profil introuvable.')

      const currentProfile = profileData as Profile
      setProfile(currentProfile)

      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_key, role')
        .order('username', { ascending: true })

      if (membersError) throw membersError

      const members = (membersData || []) as Profile[]
      setFamilyProfiles(members)

      setSelectedMemberId(userId)
      await loadMemberList(userId, true)
    } catch (error) {
      console.error('Erreur de chargement de la famille :', error)
      setMessage(
        "Impossible de charger les profils familiaux. Vérifie les autorisations Supabase."
      )
    } finally {
      setLoadingList(false)
    }
  }

  async function loadMemberList(ownerId: string, createIfMissing = false) {
    if (!supabase) return

    setLoadingList(true)
    setMessage('')
    setWishlist(null)
    setGifts([])
    setGiftPhotos({})
    setPhotoViewer(null)

    try {
      let { data: wishlistData, error: wishlistError } = await supabase
        .from('wishlist_years')
        .select('id, owner_id, year, archived')
        .eq('owner_id', ownerId)
        .eq('year', YEAR)
        .maybeSingle()

      if (wishlistError) throw wishlistError

      if (!wishlistData && createIfMissing) {
        const { data: createdWishlist, error: createError } = await supabase
          .from('wishlist_years')
          .insert({
            owner_id: ownerId,
            year: YEAR,
            archived: false,
          })
          .select('id, owner_id, year, archived')
          .single()

        if (createError) throw createError
        wishlistData = createdWishlist
      }

      if (!wishlistData) {
        setWishlist(null)
        setGifts([])
        return
      }

      setWishlist(wishlistData as Wishlist)

      const { data: giftData, error: giftsError } = await supabase
        .from('gifts')
        .select('id, wishlist_id, title, price, link, description')
        .eq('wishlist_id', wishlistData.id)
        .order('created_at', { ascending: false })

      if (giftsError) throw giftsError

      const loadedGifts = (giftData || []) as GiftItem[]
      setGifts(loadedGifts)

      if (loadedGifts.length === 0) {
        setGiftPhotos({})
        return
      }

      const { data: photoData, error: photoError } = await supabase
        .from('gift_photos')
        .select('id, gift_id, storage_path, sort_order')
        .in('gift_id', loadedGifts.map(gift => gift.id))
        .order('sort_order', { ascending: true })

      if (photoError) throw photoError

      const photos: Record<string, GiftPhoto[]> = {}

      for (const photo of photoData || []) {
        const { data: signedPhoto, error: signedError } = await supabase
          .storage
          .from('gift-photos')
          .createSignedUrl(photo.storage_path, 3600)

        if (signedError) {
          console.error(signedError)
          continue
        }

        if (signedPhoto?.signedUrl) {
          if (!photos[photo.gift_id]) {
            photos[photo.gift_id] = []
          }

          photos[photo.gift_id].push({
            ...photo,
            url: signedPhoto.signedUrl,
          })
        }
      }

      setGiftPhotos(photos)
    } catch (error) {
      console.error('Erreur de chargement de la liste :', error)
      setMessage(
        "Impossible de charger cette liste. Vérifie les autorisations Supabase."
      )
    } finally {
      setLoadingList(false)
    }
  }

  async function selectMember(member: Profile) {
    setSelectedMemberId(member.id)
    await loadMemberList(
      member.id,
      member.id === session?.user.id
    )
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
    if (!canManageSelectedList || !wishlist) return

    setEditingGift(null)
    setGiftTitle('')
    setGiftPrice('')
    setGiftLink('')
    setGiftDescription('')
    setSelectedPhotos([])
    setFormOpen(true)
  }

  function openEditGift(item: GiftItem) {
    if (!canManageSelectedList) return

    setEditingGift(item)
    setGiftTitle(item.title)
    setGiftPrice(item.price == null ? '' : String(item.price))
    setGiftLink(item.link || '')
    setGiftDescription(item.description || '')
    setSelectedPhotos([])
    setFormOpen(true)
  }

  function openPhotoViewer(giftId: string, photoIndex: number) {
    setPhotoViewer({ giftId, photoIndex })
  }

  function showPreviousPhoto() {
    setPhotoViewer(current => {
      if (!current) return null
      const photos = giftPhotos[current.giftId] || []
      if (photos.length === 0) return null

      return {
        ...current,
        photoIndex:
          (current.photoIndex - 1 + photos.length) % photos.length,
      }
    })
  }

  function showNextPhoto() {
    setPhotoViewer(current => {
      if (!current) return null
      const photos = giftPhotos[current.giftId] || []
      if (photos.length === 0) return null

      return {
        ...current,
        photoIndex: (current.photoIndex + 1) % photos.length,
      }
    })
  }

  async function saveGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !wishlist || !giftTitle.trim()) return
    if (!canManageSelectedList) return

    setBusy(true)
    setMessage('')

    try {
      const values = {
        wishlist_id: wishlist.id,
        title: giftTitle.trim(),
        price: giftPrice.trim() ? Number(giftPrice) : null,
        link: giftLink.trim() || null,
        description: giftDescription.trim() || null,
      }

      let giftId: string

      if (editingGift) {
        const { data, error } = await supabase
          .from('gifts')
          .update(values)
          .eq('id', editingGift.id)
          .select('id')
          .single()

        if (error) throw error
        giftId = data.id
      } else {
        const { data, error } = await supabase
          .from('gifts')
          .insert(values)
          .select('id')
          .single()

        if (error) throw error
        giftId = data.id
      }

      const { data: existingPhotos, error: existingPhotosError } =
        await supabase
          .from('gift_photos')
          .select('sort_order')
          .eq('gift_id', giftId)
          .order('sort_order', { ascending: false })
          .limit(1)

      if (existingPhotosError) throw existingPhotosError

      let nextOrder = existingPhotos?.[0]?.sort_order != null
        ? existingPhotos[0].sort_order + 1
        : 0

      for (const file of selectedPhotos) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Un fichier sélectionné n’est pas une image.')
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath =
          `${giftId}/${crypto.randomUUID()}-${safeName}`

        const { error: uploadError } = await supabase
          .storage
          .from('gift-photos')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) throw uploadError

        const { error: recordError } = await supabase
          .from('gift_photos')
          .insert({
            gift_id: giftId,
            storage_path: storagePath,
            sort_order: nextOrder,
          })

        if (recordError) {
          await supabase.storage
            .from('gift-photos')
            .remove([storagePath])

          throw recordError
        }

        nextOrder++
      }

      setFormOpen(false)
      setSelectedPhotos([])

      await loadMemberList(
        selectedMemberId,
        selectedMemberId === session?.user.id
      )
    } catch (error) {
      console.error('Erreur lors de l’enregistrement :', error)
      setMessage(
        "Le cadeau ou certaines photos n'ont pas pu être enregistrés. Vérifie les autorisations Supabase."
      )
    } finally {
      setBusy(false)
    }
  }

  async function deletePhoto(photo: GiftPhoto) {
    if (!supabase || !canManageSelectedList) return

    if (!window.confirm('Supprimer cette photo ?')) return

    setBusy(true)
    setMessage('')

    try {
      const { error: recordError } = await supabase
        .from('gift_photos')
        .delete()
        .eq('id', photo.id)

      if (recordError) throw recordError

      const { error: storageError } = await supabase
        .storage
        .from('gift-photos')
        .remove([photo.storage_path])

      setGiftPhotos(current => ({
        ...current,
        [photo.gift_id]: (current[photo.gift_id] || [])
          .filter(item => item.id !== photo.id),
      }))

      if (storageError) {
        console.error(storageError)
        setMessage(
          "La photo a été retirée de la liste, mais son fichier n'a pas pu être supprimé du stockage."
        )
      }
    } catch (error) {
      console.error(error)
      setMessage("Impossible de supprimer cette photo.")
    } finally {
      setBusy(false)
    }
  }

  async function deleteGift(item: GiftItem) {
    if (!supabase || !canManageSelectedList) return

    if (!window.confirm(`Supprimer « ${item.title} » ?`)) return

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

    setGiftPhotos(current => {
      const updated = { ...current }
      delete updated[item.id]
      return updated
    })

    setPhotoViewer(current =>
      current?.giftId === item.id ? null : current
    )
  }

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
                {isAdmin ? 'Administrateur' : 'Membre de la famille'}
                {' · Préparons Noël ensemble.'}
              </p>
            </div>

            <button className="text-button signout" onClick={signOut}>
              <LogOut size={15}/> Se déconnecter
            </button>
          </div>

          <div className="family-heading">
            <div>
              <span className="welcome-kicker">NOTRE PETITE TRIBU</span>
              <h2><Users size={23}/> La famille</h2>
              <p>Choisis un membre pour découvrir sa liste de Noël.</p>
            </div>
          </div>

          {loadingList && familyProfiles.length === 0 && (
            <p className="empty-state">Chargement de la famille…</p>
          )}

          <div className="family-members">
            {familyProfiles.map(member => {
              const memberName =
                member.display_name || member.username

              return (
                <button
                  type="button"
                  key={member.id}
                  className={`member-card ${
                    selectedMemberId === member.id ? 'selected' : ''
                  }`}
                  onClick={() => void selectMember(member)}
                >
                  <span className="member-avatar">
                    {avatarEmoji[member.avatar_key] || '🎄'}
                  </span>
                  <span className="member-name">{memberName}</span>
                  <span className="member-username">
                    @{member.username}
                  </span>
                  {member.id === profile?.id && (
                    <span className="member-you">C'est toi</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="list-heading">
            <div>
              <span className="welcome-kicker">ÉDITION {YEAR}</span>
              <h2>
                {selectedMemberId === profile?.id
                  ? 'Ma liste de cadeaux'
                  : `La liste de ${selectedDisplayName}`}
              </h2>
            </div>

            {canManageSelectedList && wishlist && (
              <button className="primary add-button" onClick={openNewGift}>
                <Plus size={17}/> Ajouter un cadeau
              </button>
            )}
          </div>

          {!loadingList && !wishlist && (
            <div className="empty-state">
              <div className="empty-icon">
                <Gift size={25}/>
              </div>
              <h3>Cette liste n'est pas encore créée</h3>
              <p>
                {selectedMemberId === profile?.id
                  ? 'Ta liste sera créée dès que ton espace sera prêt.'
                  : `${selectedDisplayName} n'a pas encore ouvert son espace pour créer sa liste.`}
              </p>
            </div>
          )}

          {loadingList && (
            <p className="empty-state">Chargement de la liste…</p>
          )}

          {!loadingList && wishlist && gifts.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <Gift size={25}/>
              </div>
              <h3>Cette liste est encore vide</h3>
              <p>
                {canManageSelectedList
                  ? 'Ajoute ton premier souhait pour commencer ta liste de Noël.'
                  : `${selectedDisplayName} n'a pas encore ajouté de cadeau.`}
              </p>

              {canManageSelectedList && (
                <button className="primary" onClick={openNewGift}>
                  <Plus size={17}/> Ajouter mon premier cadeau
                </button>
              )}
            </div>
          )}

          {!loadingList && gifts.length > 0 && (
            <div className="gift-grid">
              {gifts.map(item => (
                <article className="gift-card" key={item.id}>
                  <div className="gift-card-top">
                    <span className="gift-card-icon">🎁</span>

                    {canManageSelectedList && (
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
                    )}
                  </div>

                  {giftPhotos[item.id]?.length > 0 && (
                    <div className="gift-photos">
                      {giftPhotos[item.id].map((photo, index) => (
                        <button
                          key={photo.id}
                          type="button"
                          className="gift-photo-button"
                          onClick={() => openPhotoViewer(item.id, index)}
                          aria-label={`Afficher la photo ${index + 1} en grand`}
                        >
                          <img
                            src={photo.url}
                            alt={`Photo du cadeau ${item.title}`}
                            loading="lazy"
                          />
                          <span className="photo-zoom-hint">Agrandir</span>
                        </button>
                      ))}
                    </div>
                  )}

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

              <label htmlFor="gift-photos-input">
                Ajouter de nouvelles photos
              </label>

              <input
                id="gift-photos-input"
                type="file"
                accept="image/*"
                multiple
                onChange={event => {
                  setSelectedPhotos(
                    Array.from(event.target.files || [])
                  )
                }}
              />

              {selectedPhotos.length > 0 && (
                <p className="selected-photos">
                  {selectedPhotos.length} photo(s) sélectionnée(s) :
                  {' '}
                  {selectedPhotos.map(file => file.name).join(', ')}
                </p>
              )}

              {editingGift && giftPhotos[editingGift.id]?.length > 0 && (
                <>
                  <label>Photos déjà enregistrées</label>

                  <div className="existing-photos">
                    {giftPhotos[editingGift.id].map(photo => (
                      <div className="existing-photo-item" key={photo.id}>
                        <img
                          src={photo.url}
                          alt="Photo déjà enregistrée"
                        />

                        <button
                          type="button"
                          className="photo-remove-button"
                          disabled={busy}
                          onClick={() => void deletePhoto(photo)}
                          aria-label="Supprimer cette photo"
                        >
                          <X size={15}/>
                          Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {editingGift && (
                <p className="selected-photos">
                  Les photos conservées resteront sur le cadeau.
                  Tu peux aussi en ajouter de nouvelles.
                </p>
              )}

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

      {currentViewerPhoto && photoViewer && (
        <div
          className="photo-viewer-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setPhotoViewer(null)
            }
          }}
        >
          <section
            className="photo-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Photo agrandie"
          >
            <button
              type="button"
              className="photo-viewer-close"
              onClick={() => setPhotoViewer(null)}
              aria-label="Fermer la photo"
            >
              <X size={24}/>
            </button>

            {viewerPhotos.length > 1 && (
              <button
                type="button"
                className="photo-viewer-arrow photo-viewer-previous"
                onClick={showPreviousPhoto}
                aria-label="Photo précédente"
              >
                <ChevronLeft size={30}/>
              </button>
            )}

            <div className="photo-viewer-content">
              <img
                src={currentViewerPhoto.url}
                alt={
                  currentViewerGift
                    ? `Photo agrandie du cadeau ${currentViewerGift.title}`
                    : 'Photo agrandie'
                }
              />

              <div className="photo-viewer-caption">
                <span>{currentViewerGift?.title || 'Photo du cadeau'}</span>
                {viewerPhotos.length > 1 && (
                  <span>
                    {photoViewer.photoIndex + 1} / {viewerPhotos.length}
                  </span>
                )}
              </div>
            </div>

            {viewerPhotos.length > 1 && (
              <button
                type="button"
                className="photo-viewer-arrow photo-viewer-next"
                onClick={showNextPhoto}
                aria-label="Photo suivante"
              >
                <ChevronRight size={30}/>
              </button>
            )}
          </section>
        </div>
      )}

      <footer>
        Fait avec <span>♥</span> pour notre famille · Noël {YEAR}
      </footer>
    </main>
  )
}
