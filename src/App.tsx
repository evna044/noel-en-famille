
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight, Gift, LogOut, Plus, Save, Snowflake,
  Trash2, TreePine, Pencil, X,
  ChevronLeft, ChevronRight, Users, Heart,
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
  category_id: string | null
}

type GiftCategory = {
  id: string
  owner_id: string
  name: string
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

type ReservationParticipant = {
  id: string
  reservation_id: string
  user_id: string
  contribution_amount: number | null
}

type Reservation = {
  id: string
  gift_id: string
  created_by: string
  status: 'active' | 'cancelled'
  participant_limit: number
  participants: ReservationParticipant[]
}

type FamilyFavorite = {
  gift_id: string
  user_id: string
}

const reservationStyles = `
.reservation-panel{margin-top:16px;padding:13px;border:1px solid #e8e2d4;border-radius:11px;background:#f7f6ef}
.reservation-button{width:100%;margin-top:8px;padding:0 12px}
.reservation-status{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0;color:#45664f;font-size:12px}
.reservation-status span{color:#8b8d83;font-size:11px}
.reservation-participants{font-size:11px;line-height:1.5;color:#7c8278;margin:8px 0}
.gift-modal select{font:inherit;height:43px;border:1px solid #e7e3d8;border-radius:8px;padding:0 12px;background:#fffefa;margin-bottom:14px;color:#27372e;width:100%}

/* Coups de cœur */
.favorite-button{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;border:1px solid #e8e2d4;border-radius:50%;background:#fffefa;color:#9a9488;cursor:pointer;transition:all .2s ease}
.favorite-button:hover{border-color:#c94d54;color:#c94d54}
.favorite-button.is-favorite{color:#c94d54;background:#fff0f0;border-color:#f0d0d0}
.favorite-button:disabled{opacity:.55;cursor:wait}
.favorite-filters{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.gift-favorite-names{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:7px 0;color:#c94d54;font-size:12px;line-height:1.5}

/* Catégories */
.gift-category{display:inline-block;margin:6px 0;padding:5px 10px;border-radius:20px;background:#edf2e9;color:#45664f;font-size:12px;font-weight:600}
.new-category-row{display:flex;gap:8px;align-items:center;margin-bottom:14px}
.new-category-row input{flex:1;min-width:0}
.new-category-row button{flex-shrink:0}
`

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

  // Favoris partagés
  const [favoriteGiftIds, setFavoriteGiftIds] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favoriteBusyIds, setFavoriteBusyIds] = useState<string[]>([])
  const [familyFavorites, setFamilyFavorites] = useState<FamilyFavorite[]>([])

  // Catégories
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<GiftCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  const [editingGift, setEditingGift] = useState<GiftItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const [giftTitle, setGiftTitle] = useState('')
  const [giftPrice, setGiftPrice] = useState('')
  const [giftLink, setGiftLink] = useState('')
  const [giftDescription, setGiftDescription] = useState('')

  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([])
  const [giftPhotos, setGiftPhotos] = useState<Record<string, GiftPhoto[]>>({})
  const [photoViewer, setPhotoViewer] = useState<PhotoViewer>(null)

  const [reservations, setReservations] = useState<Record<string, Reservation>>({})
  const [reservationGift, setReservationGift] = useState<GiftItem | null>(null)
  const [reservationLimit, setReservationLimit] = useState('2')
  const [reservationContribution, setReservationContribution] = useState('')
  const [reservationBusy, setReservationBusy] = useState(false)
  const [reservationError, setReservationError] = useState('')

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

 const displayedGifts = gifts.filter(gift => {
  const matchesFavorite =
    !showFavoritesOnly || favoriteGiftIds.includes(gift.id)

  const matchesCategory =
    selectedCategoryFilter === 'all' ||
    gift.category_id === selectedCategoryFilter

  return matchesFavorite && matchesCategory
})

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
      setReservations({})
      setFavoriteGiftIds([])
      setFamilyFavorites([])
      setCategories([])
      setShowFavoritesOnly(false)
      setFavoriteBusyIds([])
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
    setReservations({})
    setFavoriteGiftIds([])
    setFamilyFavorites([])
    setCategories([])

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

      // Charger les catégories appartenant au membre sélectionné
      const { data: categoryData, error: categoryError } = await supabase
          .from('gift_categories')
          .select('id, owner_id, name')
          .order('name', { ascending: true })

      if (categoryError) throw categoryError

      setCategories((categoryData || []) as GiftCategory[])

      const { data: giftData, error: giftsError } = await supabase
        .from('gifts')
        .select('id, wishlist_id, title, price, link, description, category_id')
        .eq('wishlist_id', wishlistData.id)
        .order('created_at', { ascending: false })

      if (giftsError) throw giftsError

      const loadedGifts = (giftData || []) as GiftItem[]
      setGifts(loadedGifts)

      // Charger les favoris de tous les membres pour les cadeaux affichés
      if (session?.user.id && loadedGifts.length > 0) {
        const { data: favoriteData, error: favoriteError } = await supabase
          .from('gift_favorites')
          .select('gift_id, user_id')
          .in('gift_id', loadedGifts.map(gift => gift.id))

        if (favoriteError) throw favoriteError

        const loadedFavorites = (favoriteData || []) as FamilyFavorite[]
        setFamilyFavorites(loadedFavorites)

        setFavoriteGiftIds(
          loadedFavorites
            .filter(favorite => favorite.user_id === session.user.id)
            .map(favorite => favorite.gift_id)
        )
      } else {
        setFamilyFavorites([])
        setFavoriteGiftIds([])
      }

      if (loadedGifts.length === 0) {
        setGiftPhotos({})
        setReservations({})
        return
      }

      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, gift_id, created_by, status, participant_limit')
        .in('gift_id', loadedGifts.map(gift => gift.id))
        .eq('status', 'active')

      if (reservationError) throw reservationError

      const reservationRows = reservationData || []
      const participantsByReservation: Record<string, ReservationParticipant[]> = {}

      if (reservationRows.length > 0) {
        const { data: participantData, error: participantError } = await supabase
          .from('reservation_participants')
          .select('id, reservation_id, user_id, contribution_amount')
          .in('reservation_id', reservationRows.map(row => row.id))

        if (participantError) throw participantError

        for (const participant of participantData || []) {
          if (!participantsByReservation[participant.reservation_id]) {
            participantsByReservation[participant.reservation_id] = []
          }

          participantsByReservation[participant.reservation_id].push(
            participant as ReservationParticipant
          )
        }
      }

      const reservationMap: Record<string, Reservation> = {}

      for (const row of reservationRows) {
        if (!reservationMap[row.gift_id]) {
          reservationMap[row.gift_id] = {
            ...(row as Omit<Reservation, 'participants'>),
            participants: participantsByReservation[row.id] || [],
          }
        }
      }

      setReservations(reservationMap)

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
    setShowFavoritesOnly(false)
    await loadMemberList(
      member.id,
      member.id === profile?.id
    )
  }

  async function toggleFavorite(item: GiftItem) {
    if (!supabase || !session?.user.id) return

    const userId = session.user.id
    const alreadyFavorite = favoriteGiftIds.includes(item.id)

    setFavoriteBusyIds(current => [...current, item.id])

    try {
      if (alreadyFavorite) {
        const { error } = await supabase
          .from('gift_favorites')
          .delete()
          .eq('gift_id', item.id)
          .eq('user_id', userId)

        if (error) throw error

        setFavoriteGiftIds(current =>
          current.filter(id => id !== item.id)
        )

        setFamilyFavorites(current =>
          current.filter(favorite =>
            !(
              favorite.gift_id === item.id &&
              favorite.user_id === userId
            )
          )
        )
      } else {
        const { error } = await supabase
          .from('gift_favorites')
          .insert({
            gift_id: item.id,
            user_id: userId,
          })

        if (error) throw error

        setFavoriteGiftIds(current => [...current, item.id])

        setFamilyFavorites(current => [
          ...current,
          {
            gift_id: item.id,
            user_id: userId,
          },
        ])
      }
    } catch (error) {
      console.error('Erreur favori :', error)
      setMessage(
        "Impossible de modifier ce favori. Vérifie les autorisations Supabase."
      )
    } finally {
      setFavoriteBusyIds(current =>
        current.filter(id => id !== item.id)
      )
    }
  }

  async function createGiftCategory() {
    if (
      !supabase ||
      !session?.user.id ||
      !canManageSelectedList ||
      !selectedMemberId
    ) return

    const name = newCategoryName.trim()

    if (!name) {
      setMessage('Entre un nom pour la catégorie.')
      return
    }

    if (
      categories.some(
        category =>
          category.name.toLocaleLowerCase('fr') ===
          name.toLocaleLowerCase('fr')
      )
    ) {
      setMessage('Cette catégorie existe déjà.')
      return
    }

    setCreatingCategory(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('gift_categories')
        .insert({
          owner_id: selectedMemberId,
          name,
        })
        .select('id, owner_id, name')
        .single()

      if (error) throw error

      setCategories(current =>
        [...current, data as GiftCategory].sort(
          (a, b) => a.name.localeCompare(b.name, 'fr')
        )
      )

      setSelectedCategoryId(data.id)
      setNewCategoryName('')
      setMessage('Catégorie créée !')
    } catch (error) {
      console.error('Erreur création catégorie :', error)
      setMessage(
        'Impossible de créer cette catégorie. Vérifie les autorisations Supabase.'
      )
    } finally {
      setCreatingCategory(false)
    }
  }

  function openNewGift() {
    setEditingGift(null)
    setGiftTitle('')
    setGiftPrice('')
    setGiftLink('')
    setGiftDescription('')
    setSelectedPhotos([])
    setSelectedCategoryId('')
    setNewCategoryName('')
    setMessage('')
    setFormOpen(true)
  }

  function openEditGift(item: GiftItem) {
    setEditingGift(item)
    setGiftTitle(item.title)
    setGiftPrice(item.price?.toString() || '')
    setGiftLink(item.link || '')
    setGiftDescription(item.description || '')
    setSelectedPhotos([])
    setSelectedCategoryId(item.category_id || '')
    setNewCategoryName('')
    setMessage('')
    setFormOpen(true)
  }

  function openReservation(item: GiftItem) {
    setReservationGift(item)
    setReservationLimit('2')
    setReservationContribution(
      item.price ? (item.price / 2).toFixed(2) : ''
    )
    setReservationError('')
  }

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !session?.user.id || !reservationGift) return

    const limit = Number(reservationLimit)
    const contribution = Number(reservationContribution)

    if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
      setReservationError(
        'Choisis un nombre de participants entre 1 et 12.'
      )
      return
    }

    if (
      !Number.isFinite(contribution) ||
      contribution < 0
    ) {
      setReservationError('Entre une contribution valide.')
      return
    }

    setReservationBusy(true)
    setReservationError('')

    try {
      const { data: reservation, error: reservationCreateError } =
        await supabase
          .from('reservations')
          .insert({
            gift_id: reservationGift.id,
            created_by: session.user.id,
            status: 'active',
            participant_limit: limit,
          })
          .select('id')
          .single()

      if (reservationCreateError) throw reservationCreateError

      const { error: participantError } = await supabase
        .from('reservation_participants')
        .insert({
          reservation_id: reservation.id,
          user_id: session.user.id,
          contribution_amount: contribution,
        })

      if (participantError) {
        await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation.id)

        throw participantError
      }

      setReservationGift(null)
      await loadMemberList(selectedMemberId)
      setMessage('Réservation créée !')
    } catch (error) {
      console.error('Erreur réservation :', error)
      setReservationError(
        'Impossible de créer la réservation. Vérifie les autorisations Supabase.'
      )
    } finally {
      setReservationBusy(false)
    }
  }

  async function joinReservation(item: GiftItem) {
    if (!supabase || !session?.user.id) return

    const reservation = reservations[item.id]

    if (!reservation) return

    if (
      reservation.participants.some(
        participant => participant.user_id === session.user.id
      )
    ) {
      setMessage('Tu participes déjà à cette réservation.')
      return
    }

    if (
      reservation.participants.length >=
      reservation.participant_limit
    ) {
      setMessage('Cette réservation est complète.')
      return
    }

    const answer = window.prompt(
      'Quel montant souhaites-tu contribuer ?'
    )

    if (answer === null) return

    const contribution = Number(answer.replace(',', '.'))

    if (!Number.isFinite(contribution) || contribution < 0) {
      setMessage('Montant invalide.')
      return
    }

    setReservationBusy(true)

    try {
      const { error } = await supabase
        .from('reservation_participants')
        .insert({
          reservation_id: reservation.id,
          user_id: session.user.id,
          contribution_amount: contribution,
        })

      if (error) throw error

      await loadMemberList(selectedMemberId)
      setMessage('Tu participes maintenant à ce cadeau !')
    } catch (error) {
      console.error('Erreur participation :', error)
      setMessage(
        'Impossible de rejoindre cette réservation.'
      )
    } finally {
      setReservationBusy(false)
    }
  }

  async function leaveOrCancelReservation(item: GiftItem) {
    if (!supabase || !session?.user.id) return

    const reservation = reservations[item.id]

    if (!reservation) return

    const participant = reservation.participants.find(
      person => person.user_id === session.user.id
    )

    if (!participant) return

    setReservationBusy(true)

    try {
      if (reservation.created_by === session.user.id) {
        const confirmed = window.confirm(
          'Tu es à l’origine de cette réservation. Veux-tu vraiment l’annuler pour tout le monde ?'
        )

        if (!confirmed) {
          setReservationBusy(false)
          return
        }

        const { error } = await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reservation_participants')
          .delete()
          .eq('id', participant.id)
          .eq('user_id', session.user.id)

        if (error) throw error
      }

      await loadMemberList(selectedMemberId)
      setMessage('Réservation mise à jour.')
    } catch (error) {
      console.error('Erreur réservation :', error)
      setMessage(
        'Impossible de modifier cette réservation.'
      )
    } finally {
      setReservationBusy(false)
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) {
      setMessage('Supabase n’est pas configuré.')
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
    } catch (error) {
      console.error('Erreur connexion :', error)
      setMessage(
        'Connexion impossible. Vérifie ton adresse e-mail et ton mot de passe.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!supabase || !email.trim()) {
      setMessage('Entre ton adresse e-mail avant de demander un lien.')
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: window.location.origin,
        }
      )

      if (error) throw error

      setMessage(
        'Si cette adresse est associée à un compte, un e-mail de réinitialisation a été envoyé.'
      )
    } catch (error) {
      console.error('Erreur réinitialisation :', error)
      setMessage(
        'Impossible d’envoyer le lien de réinitialisation.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Erreur déconnexion :', error)
      setMessage('Impossible de se déconnecter.')
    }
  }

  function openPhotoViewer(giftId: string, photoIndex: number) {
    setPhotoViewer({ giftId, photoIndex })
  }

  function showPreviousPhoto() {
    if (!photoViewer || viewerPhotos.length === 0) return

    setPhotoViewer({
      ...photoViewer,
      photoIndex:
        (photoViewer.photoIndex - 1 + viewerPhotos.length) %
        viewerPhotos.length,
    })
  }

  function showNextPhoto() {
    if (!photoViewer || viewerPhotos.length === 0) return

    setPhotoViewer({
      ...photoViewer,
      photoIndex:
        (photoViewer.photoIndex + 1) % viewerPhotos.length,
    })
  }

  async function saveGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !wishlist || !giftTitle.trim()) return

    if (!canManageSelectedList) {
      setMessage("Tu n'as pas l'autorisation de modifier cette liste.")
      return
    }

    setBusy(true)
    setMessage('')

    let giftId = editingGift?.id || ''

    try {
      const giftValues = {
        wishlist_id: wishlist.id,
        title: giftTitle.trim(),
        price: giftPrice.trim()
          ? Number(giftPrice.replace(',', '.'))
          : null,
        link: giftLink.trim() || null,
        description: giftDescription.trim() || null,
        category_id: selectedCategoryId || null,
      }

      if (
        giftValues.price !== null &&
        (!Number.isFinite(giftValues.price) || giftValues.price < 0)
      ) {
        throw new Error('Le prix doit être un nombre positif.')
      }

      if (editingGift) {
        const { error } = await supabase
          .from('gifts')
          .update(giftValues)
          .eq('id', editingGift.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('gifts')
          .insert(giftValues)
          .select('id')
          .single()

        if (error) throw error

        giftId = data.id
      }

      if (selectedPhotos.length > 0) {
        const { data: existingPhotos, error: existingPhotosError } =
          await supabase
            .from('gift_photos')
            .select('sort_order')
            .eq('gift_id', giftId)
            .order('sort_order', { ascending: false })
            .limit(1)

        if (existingPhotosError) throw existingPhotosError

        let nextSortOrder =
          (existingPhotos?.[0]?.sort_order ?? -1) + 1

        for (const file of selectedPhotos) {
          const safeName = file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          )

          const storagePath =
            `${giftId}/${crypto.randomUUID()}-${safeName}`

          const { error: uploadError } = await supabase
            .storage
            .from('gift-photos')
            .upload(storagePath, file)

          if (uploadError) throw uploadError

          const { error: photoInsertError } = await supabase
            .from('gift_photos')
            .insert({
              gift_id: giftId,
              storage_path: storagePath,
              sort_order: nextSortOrder,
            })

          if (photoInsertError) {
            await supabase.storage
              .from('gift-photos')
              .remove([storagePath])

            throw photoInsertError
          }

          nextSortOrder += 1
        }
      }

      setFormOpen(false)
      setSelectedPhotos([])
      setMessage('Cadeau enregistré !')

      await loadMemberList(selectedMemberId)
    } catch (error) {
      console.error('Erreur sauvegarde cadeau :', error)

      setMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer ce cadeau.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function deletePhoto(photo: GiftPhoto) {
    if (!supabase) return

    const confirmed = window.confirm(
      'Supprimer cette photo ?'
    )

    if (!confirmed) return

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

      if (storageError) {
        console.error('Erreur suppression fichier :', storageError)
      }

      setGiftPhotos(current => ({
        ...current,
        [photo.gift_id]: (current[photo.gift_id] || []).filter(
          item => item.id !== photo.id
        ),
      }))

      setMessage('Photo supprimée.')
    } catch (error) {
      console.error('Erreur suppression photo :', error)
      setMessage('Impossible de supprimer cette photo.')
    }
  }

  async function deleteGift(item: GiftItem) {
    if (!supabase || !canManageSelectedList) return

    const confirmed = window.confirm(
      `Supprimer le cadeau « ${item.title} » ?`
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('gifts')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      setGifts(current =>
        current.filter(gift => gift.id !== item.id)
      )

      setFavoriteGiftIds(current =>
        current.filter(id => id !== item.id)
      )

      setFamilyFavorites(current =>
        current.filter(favorite => favorite.gift_id !== item.id)
      )

      setGiftPhotos(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })

      if (photoViewer?.giftId === item.id) {
        setPhotoViewer(null)
      }

      setMessage('Cadeau supprimé.')
    } catch (error) {
      console.error('Erreur suppression cadeau :', error)
      setMessage('Impossible de supprimer ce cadeau.')
    }
  }

  return (
    <main className="app">
      <style>{reservationStyles}</style>

      <div className="snow-decoration" aria-hidden="true">
        ❄️　 ✦　 ❄️　 ✧　 ❄️
      </div>

      <header className="site-header">
        <div className="brand">
          <TreePine size={30} />
          <span>Notre Noël</span>
        </div>

        {session && (
          <button
            className="logout-button"
            onClick={signOut}
            type="button"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        )}
      </header>

      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">La magie de Noël en famille</span>
          <h1>Préparons Noël ensemble !</h1>
          <p>
            Toutes les envies de cadeaux de la famille réunies au même endroit.
          </p>
        </div>

        <div className="hero-tree" aria-hidden="true">
          <TreePine size={110} strokeWidth={1.2} />
          <span>✦</span>
        </div>
      </section>

      <section className="countdown-section">
        <p className="countdown-label">
          <Snowflake size={16} />
          Le compte à rebours avant Noël 2026
          <Snowflake size={16} />
        </p>

        <div className="countdown">
          {countdownItems.map(([label, value]) => (
            <div className="countdown-item" key={label}>
              <strong>{String(value).padStart(2, '0')}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {!session ? (
        <section className="login-section">
          <div className="login-card">
            <div className="login-icon">
              <Gift size={34} />
            </div>

            <h2>Bienvenue !</h2>
            <p>Connecte-toi pour retrouver les listes de cadeaux de la famille.</p>

            <form onSubmit={signIn}>
              <label htmlFor="login-email">Adresse e-mail</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="ton@email.com"
                required
              />

              <label htmlFor="login-password">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Ton mot de passe"
                required
              />

              <button
                className="primary-button"
                type="submit"
                disabled={busy || !supabaseReady}
              >
                {busy ? 'Connexion...' : 'Se connecter'}
                <ArrowRight size={17} />
              </button>
            </form>

            <button
              className="text-button"
              type="button"
              onClick={resetPassword}
              disabled={busy}
            >
              Mot de passe oublié ?
            </button>

            {!supabaseReady && (
              <p className="error-message">
                Supabase n'est pas encore configuré.
              </p>
            )}

            {message && <p className="status-message">{message}</p>}
          </div>
        </section>
      ) : (
        <section className="family-area">
          <div className="welcome-panel">
            <div className="welcome-avatar">{avatar}</div>

            <div>
              <p className="welcome-small">Ravi de te retrouver !</p>
              <h2>Bonjour {displayName} !</h2>
              <p>Choisis une liste pour découvrir les envies de chacun.</p>
            </div>
          </div>

          <section className="family-members">
            <div className="section-heading">
              <Users size={21} />
              <h2>La famille</h2>
            </div>

            <div className="member-list">
              {familyProfiles.map(member => (
                <button
                  type="button"
                  key={member.id}
                  className={`member-button ${
                    selectedMemberId === member.id ? 'selected' : ''
                  }`}
                  onClick={() => selectMember(member)}
                >
                  <span className="member-avatar">
                    {avatarEmoji[member.avatar_key] || '🎄'}
                  </span>
                  <span>
                    {member.display_name || member.username}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="wishlist-section">
            <div className="wishlist-heading">
              <div>
                <p className="eyebrow">Liste de cadeaux {YEAR}</p>
                <h2>
                  Les envies de {selectedDisplayName}
                </h2>
              </div>

              {canManageSelectedList && (
                <button
                  type="button"
                  className="primary-button add-gift-button"
                  onClick={openNewGift}
                >
                  <Plus size={18} />
                  Ajouter un cadeau
                </button>
              )}
            </div>

            {message && (
              <p className="status-message">{message}</p>
            )}

            {loadingList ? (
              <div className="empty-state">
                <p>Chargement de la liste...</p>
              </div>
            ) : !wishlist ? (
              <div className="empty-state">
                <Gift size={40} />
                <h3>Pas encore de liste</h3>
                <p>
                  Cette liste de Noël n'existe pas encore.
                </p>
              </div>
            ) : (
              <>
                {gifts.length > 0 && (
                  <div className="favorite-filters">
                    <button
                      type="button"
                      className={!showFavoritesOnly ? 'filter-active' : ''}
                      onClick={() => setShowFavoritesOnly(false)}
                    >
                      Tous les cadeaux
                    </button>

                    <button
                      type="button"
                      className={showFavoritesOnly ? 'filter-active' : ''}
                      onClick={() => setShowFavoritesOnly(true)}
                    >
                      <Heart size={15} />
                      Mes coups de cœur
                    </button>
                    <select
  value={selectedCategoryFilter}
  onChange={event => setSelectedCategoryFilter(event.target.value)}
  aria-label="Filtrer les cadeaux par catégorie"
>
  <option value="all">Toutes les catégories</option>

  {categories.map(category => (
    <option key={category.id} value={category.id}>
      {category.name}
    </option>
  ))}
</select>
                  </div>
                )}

                {gifts.length === 0 ? (
                  <div className="empty-state">
                    <Gift size={40} />
                    <h3>La liste est encore vide</h3>
                    <p>
                      Les idées de cadeaux apparaîtront ici.
                    </p>

                    {canManageSelectedList && (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={openNewGift}
                      >
                        <Plus size={17} />
                        Ajouter le premier cadeau
                      </button>
                    )}
                  </div>
                ) : displayedGifts.length === 0 ? (
                  <div className="empty-state">
                    <Heart size={38} />
                    <h3>Aucun coup de cœur pour le moment</h3>
                    <p>
                      Tu peux ajouter un cadeau à tes favoris avec le cœur.
                    </p>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setShowFavoritesOnly(false)}
                    >
                      Voir tous les cadeaux
                    </button>
                  </div>
                ) : (
                  <div className="gift-grid">
                    {displayedGifts.map(item => {
                      const photos = giftPhotos[item.id] || []
                      const reservation = reservations[item.id]
                      const isFavorite = favoriteGiftIds.includes(item.id)

                      const favoriteNames = familyFavorites
                        .filter(favorite => favorite.gift_id === item.id)
                        .map(favorite =>
                          familyProfiles.find(
                            member => member.id === favorite.user_id
                          )
                        )
                        .filter(Boolean)

                      const currentParticipant =
                        reservation?.participants.find(
                          participant =>
                            participant.user_id === session.user.id
                        )

                      const isReservationCreator =
                        reservation?.created_by === session.user.id

                      const isFull =
                        Boolean(reservation) &&
                        reservation!.participants.length >=
                          reservation!.participant_limit

                      return (
                        <article className="gift-card" key={item.id}>
                          <div className="gift-card-top">
                            <button
                              type="button"
                              className={`favorite-button ${
                                isFavorite ? 'is-favorite' : ''
                              }`}
                              onClick={() => toggleFavorite(item)}
                              disabled={favoriteBusyIds.includes(item.id)}
                              aria-label={
                                isFavorite
                                  ? 'Retirer des favoris'
                                  : 'Ajouter aux favoris'
                              }
                            >
                              <Heart
                                size={19}
                                fill={isFavorite ? 'currentColor' : 'none'}
                              />
                            </button>

                            {canManageSelectedList && (
                              <div className="gift-actions">
                                <button
                                  type="button"
                                  onClick={() => openEditGift(item)}
                                  aria-label="Modifier le cadeau"
                                >
                                  <Pencil size={17} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteGift(item)}
                                  aria-label="Supprimer le cadeau"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            )}
                          </div>

                          {photos.length > 0 && (
                            <div className="gift-photos">
                              {photos.map((photo, index) => (
                                <button
                                  type="button"
                                  key={photo.id}
                                  className="gift-photo-button"
                                  onClick={() =>
                                    openPhotoViewer(item.id, index)
                                  }
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Photo de ${item.title}`}
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="gift-card-content">
                            <h3>{item.title}</h3>

                            {item.category_id && (
                              <p className="gift-category">
                                {categories.find(
                                  category =>
                                    category.id === item.category_id
                                )?.name || ''}
                              </p>
                            )}

                            {favoriteNames.length > 0 && (
                              <div className="gift-favorite-names">
                                <Heart size={14} fill="currentColor" />
                                Aimé par{' '}
                                {favoriteNames
                                  .map(member =>
                                    member?.display_name ||
                                    member?.username
                                  )
                                  .join(', ')}
                              </div>
                            )}

                            {item.price !== null && (
                              <p className="gift-price">
                                {Number(item.price).toLocaleString('fr-FR', {
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
                                rel="noopener noreferrer"
                              >
                                Voir le cadeau
                                <ArrowRight size={15} />
                              </a>
                            )}

                            {selectedMemberId !== session.user.id && (
                              <div className="reservation-panel">
                                {reservation ? (
                                  <>
                                    <p className="reservation-status">
                                      <strong>Réservation en cours</strong>
                                      <span>
                                        {reservation.participants.length}/
                                        {reservation.participant_limit} participants
                                      </span>
                                    </p>

                                    <div className="reservation-participants">
                                      {reservation.participants.map(participant => {
                                        const participantProfile =
                                          familyProfiles.find(
                                            member =>
                                              member.id === participant.user_id
                                          )

                                        return (
                                          <p key={participant.id}>
                                            {participantProfile?.display_name ||
                                              participantProfile?.username ||
                                              'Membre de la famille'}
                                            {participant.contribution_amount !== null
                                              ? ` — ${Number(
                                                  participant.contribution_amount
                                                ).toLocaleString('fr-FR', {
                                                  style: 'currency',
                                                  currency: 'EUR',
                                                })}`
                                              : ''}
                                          </p>
                                        )
                                      })}
                                    </div>

                                    {currentParticipant ? (
                                      <button
                                        type="button"
                                        className="secondary-button reservation-button"
                                        disabled={reservationBusy}
                                        onClick={() =>
                                          leaveOrCancelReservation(item)
                                        }
                                      >
                                        {isReservationCreator
                                          ? 'Annuler la réservation'
                                          : 'Ne plus participer'}
                                      </button>
                                    ) : !isFull ? (
                                      <button
                                        type="button"
                                        className="primary-button reservation-button"
                                        disabled={reservationBusy}
                                        onClick={() => joinReservation(item)}
                                      >
                                        Participer
                                      </button>
                                    ) : (
                                      <p>Cette réservation est complète.</p>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="primary-button reservation-button"
                                    onClick={() => openReservation(item)}
                                  >
                                    <Users size={16} />
                                    Proposer un cadeau commun
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      )}

      {formOpen && (
        <div
          className="modal-backdrop"
          onClick={event => {
            if (event.target === event.currentTarget) {
              setFormOpen(false)
            }
          }}
        >
          <section className="modal gift-modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Liste de Noël</p>
                <h2>
                  {editingGift ? 'Modifier le cadeau' : 'Nouveau cadeau'}
                </h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setFormOpen(false)}
                aria-label="Fermer"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={saveGift}>
              <label htmlFor="gift-title">Nom du cadeau *</label>
              <input
                id="gift-title"
                type="text"
                value={giftTitle}
                onChange={event => setGiftTitle(event.target.value)}
                placeholder="Ex : Un livre, un jeu..."
                required
              />

              <label htmlFor="gift-category">Catégorie</label>
              <select
                id="gift-category"
                value={selectedCategoryId}
                onChange={event =>
                  setSelectedCategoryId(event.target.value)
                }
              >
                <option value="">Sans catégorie</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <div className="new-category-row">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={event =>
                    setNewCategoryName(event.target.value)
                  }
                  placeholder="Nouvelle catégorie..."
                  aria-label="Nom de la nouvelle catégorie"
                />

                <button
                  type="button"
                  className="secondary-button"
                  onClick={createGiftCategory}
                  disabled={creatingCategory}
                >
                  {creatingCategory ? 'Création...' : 'Créer'}
                </button>
              </div>

              <label htmlFor="gift-price">Prix (€)</label>
              <input
                id="gift-price"
                type="number"
                min="0"
                step="0.01"
                value={giftPrice}
                onChange={event => setGiftPrice(event.target.value)}
                placeholder="Ex : 25"
              />

              <label htmlFor="gift-link">Lien du cadeau</label>
              <input
                id="gift-link"
                type="url"
                value={giftLink}
                onChange={event => setGiftLink(event.target.value)}
                placeholder="https://..."
              />

              <label htmlFor="gift-description">Description</label>
              <textarea
                id="gift-description"
                value={giftDescription}
                onChange={event =>
                  setGiftDescription(event.target.value)
                }
                placeholder="Quelques détails sur le cadeau..."
                rows={3}
              />

              <label htmlFor="gift-photos">Photos du cadeau</label>
              <input
                id="gift-photos"
                type="file"
                accept="image/*"
                multiple
                onChange={event =>
                  setSelectedPhotos(
                    Array.from(event.target.files || [])
                  )
                }
              />

              {selectedPhotos.length > 0 && (
                <p className="form-help">
                  {selectedPhotos.length} nouvelle(s) photo(s) sélectionnée(s).
                </p>
              )}

              {editingGift &&
                (giftPhotos[editingGift.id] || []).length > 0 && (
                  <div className="existing-photos">
                    <p>Photos déjà ajoutées</p>

                    <div className="existing-photo-list">
                      {(giftPhotos[editingGift.id] || []).map(photo => (
                        <div className="existing-photo" key={photo.id}>
                          <img src={photo.url} alt="Photo du cadeau" />
                          <button
                            type="button"
                            onClick={() => deletePhoto(photo)}
                            aria-label="Supprimer cette photo"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setFormOpen(false)}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy || !giftTitle.trim()}
                >
                  <Save size={17} />
                  {busy ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {reservationGift && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Cadeau commun</p>
                <h2>{reservationGift.title}</h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setReservationGift(null)}
                aria-label="Fermer"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={createReservation}>
              <label htmlFor="reservation-limit">
                Nombre maximum de participants
              </label>
              <select
                id="reservation-limit"
                value={reservationLimit}
                onChange={event =>
                  setReservationLimit(event.target.value)
                }
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  number => (
                    <option key={number} value={String(number)}>
                      {number} participant{number > 1 ? 's' : ''}
                    </option>
                  )
                )}
              </select>

              <label htmlFor="reservation-contribution">
                Ta contribution (€)
              </label>
              <input
                id="reservation-contribution"
                type="number"
                min="0"
                step="0.01"
                value={reservationContribution}
                onChange={event =>
                  setReservationContribution(event.target.value)
                }
                placeholder="Ex : 15"
                required
              />

              {reservationError && (
                <p className="error-message">{reservationError}</p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setReservationGift(null)}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={reservationBusy}
                >
                  {reservationBusy ? 'Création...' : 'Créer la réservation'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {photoViewer && currentViewerPhoto && (
        <div
          className="photo-viewer-backdrop"
          onClick={() => setPhotoViewer(null)}
        >
          <button
            type="button"
            className="photo-viewer-close"
            onClick={() => setPhotoViewer(null)}
            aria-label="Fermer"
          >
            <X size={25} />
          </button>

          {viewerPhotos.length > 1 && (
            <button
              type="button"
              className="photo-viewer-arrow previous"
              onClick={event => {
                event.stopPropagation()
                showPreviousPhoto()
              }}
              aria-label="Photo précédente"
            >
              <ChevronLeft size={30} />
            </button>
          )}

          <div
            className="photo-viewer-content"
            onClick={event => event.stopPropagation()}
          >
            <img
              src={currentViewerPhoto.url}
              alt={currentViewerGift?.title || 'Photo du cadeau'}
            />

            <p>
              {currentViewerGift?.title}
              {viewerPhotos.length > 1
                ? ` — ${photoViewer.photoIndex + 1}/${viewerPhotos.length}`
                : ''}
            </p>
          </div>

          {viewerPhotos.length > 1 && (
            <button
              type="button"
              className="photo-viewer-arrow next"
              onClick={event => {
                event.stopPropagation()
                showNextPhoto()
              }}
              aria-label="Photo suivante"
            >
              <ChevronRight size={30} />
            </button>
          )}
        </div>
      )}

      <footer className="site-footer">
        <TreePine size={18} />
        <p>Fait avec magie pour Noël 2026</p>
        <Snowflake size={18} />
      </footer>
    </main>
  )
}
