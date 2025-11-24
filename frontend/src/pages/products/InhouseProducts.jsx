import React, { useEffect, useState } from 'react'
import {
  apiGet,
  apiUpload,
  apiPatch,
  apiDelete,
  apiUploadPatch,
  API_BASE,
  apiPost,
} from '../../api'
import { getCurrencyConfig, convert as fxConvert } from '../../util/currency'

// Convert ISO 3166-1 alpha-2 country code to emoji flag
function codeToFlag(code) {
  if (!code) return ''
  const base = 127397
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .map((c) => String.fromCodePoint(base + c.charCodeAt(0)))
    .join('')
}

// Generate product images using AI backend endpoint
async function aiGenerateImages(productId, count, prompt) {
  try {
    setAiBusy(true)
    const body = { count: Math.max(1, Number(count || 2)), prompt: String(prompt || '').trim() }
    const res = await apiPost(`/api/products/${productId}/images/ai`, body)
    if (res?.success) {
      setMsg(`AI images generated: ${res.added || 0}`)
      await load()
    } else {
      setMsg(res?.message || 'Failed to generate images')
    }
  } catch (err) {
    setMsg(err?.message || 'Failed to generate images')
  } finally {
    setAiBusy(false)
  }
}

export default function InhouseProducts() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [me, setMe] = useState(null)
  const COUNTRY_OPTS = [
    { key: 'UAE', name: 'UAE', flag: '🇦🇪' },
    { key: 'Oman', name: 'Oman', flag: '🇴🇲' },
    { key: 'KSA', name: 'KSA', flag: '🇸🇦' },
    { key: 'Bahrain', name: 'Bahrain', flag: '🇧🇭' },
    { key: 'India', name: 'India', flag: '🇮🇳' },
    { key: 'Kuwait', name: 'Kuwait', flag: '🇰🇼' },
    { key: 'Qatar', name: 'Qatar', flag: '🇶🇦' },
  ]
  const [worldCountries, setWorldCountries] = useState([])
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    name: '',
    price: '',
    purchasePrice: '',
    baseCurrency: 'AED',
    category: 'Other',
    madeInCountry: '',
    description: '',
    availableCountries: [],
    inStock: true,
    displayOnWebsite: false,
    isForMobile: false,
    displayOnShopify: false,
    stockUAE: 0,
    stockOman: 0,
    stockKSA: 0,
    stockBahrain: 0,
    stockIndia: 0,
    stockKuwait: 0,
    stockQatar: 0,
    images: [],
  })
  const [imagePreviews, setImagePreviews] = useState([])
  const [editing, setEditing] = useState(null) // holds product doc when editing
  const [editForm, setEditForm] = useState(null)
  const [editPreviews, setEditPreviews] = useState([])
  // Gallery/lightbox state
  const [gallery, setGallery] = useState({ open: false, images: [], index: 0, zoom: 1, fit: 'fit' })
  // Quick popups
  const [stockPopup, setStockPopup] = useState({
    open: false,
    product: null,
    stockUAE: 0,
    stockOman: 0,
    stockKSA: 0,
    stockBahrain: 0,
    stockIndia: 0,
    stockKuwait: 0,
    stockQatar: 0,
    inStock: true,
  })
  const [pricePopup, setPricePopup] = useState({
    open: false,
    product: null,
    baseCurrency: 'SAR',
    price: '',
    purchasePrice: '',
    x: 0,
    y: 0,
  })
  // Gemini AI state
  const [categories, setCategories] = useState([])
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  // AI image generation state
  const [aiAfterSave, setAiAfterSave] = useState(false)
  const [aiCount, setAiCount] = useState(2)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [ccyCfg, setCcyCfg] = useState(null)

  // Generate product images using AI backend endpoint (uses API settings saved in User > API Setup)
  async function aiGenerateImages(productId, count, customPrompt) {
    try {
      setAiBusy(true)
      // Compose a strong prompt using product fields + saved defaultImagePrompt
      let prompt = String(customPrompt || '').trim()
      if (!prompt) {
        try {
          const ai = await apiGet('/api/settings/ai')
          const madeIn = String(form.madeInCountry || '').trim()
          const parts = [
            `High-quality product photos for ${form.name || 'product'} (${form.category || 'Other'})`,
            madeIn ? `Made in ${madeIn}.` : '',
            form.description ? `Details: ${form.description}` : '',
            ai?.defaultImagePrompt ||
              'Clean white background, multiple angles (front, back, side, 45-degree, top), consistent lighting, no watermark.',
          ].filter(Boolean)
          prompt = parts.join(' ')
        } catch {}
      }
      const body = { count: Math.max(1, Number(count || 2)), prompt }
      const res = await apiPost(`/api/products/${productId}/images/ai`, body)
      if (res?.success) {
        setMsg(`AI images generated: ${res.added || 0}`)
        await load()
      } else {
        setMsg(res?.message || 'Failed to generate images')
      }
    } catch (err) {
      setMsg(err?.message || 'Failed to generate images')
    } finally {
      setAiBusy(false)
    }
  }

  function openGallery(images, startIdx = 0) {
    const imgs = (images || []).filter(Boolean)
    if (!imgs.length) return
    setGallery({
      open: true,
      images: imgs,
      index: Math.max(0, Math.min(startIdx, imgs.length - 1)),
      zoom: 1,
      fit: 'fit',
    })
  }
  function openImageOrGallery(images) {
    const imgs = (images || []).filter(Boolean)
    if (!imgs.length) return
    if (imgs.length === 1) {
      try {
        window.open(`${API_BASE}${imgs[0]}`, '_blank', 'noopener,noreferrer')
      } catch {}
      return
    }
    openGallery(imgs, 0)
  }
  function closeGallery() {
    setGallery((g) => ({ ...g, open: false }))
  }
  function nextImg() {
    setGallery((g) => ({ ...g, index: (g.index + 1) % g.images.length, zoom: 1 }))
  }
  function prevImg() {
    setGallery((g) => ({ ...g, index: (g.index - 1 + g.images.length) % g.images.length, zoom: 1 }))
  }
  function zoomIn() {
    setGallery((g) => ({ ...g, zoom: Math.min(4, g.zoom + 0.25) }))
  }
  function zoomOut() {
    setGallery((g) => ({ ...g, zoom: Math.max(0.5, g.zoom - 0.25) }))
  }
  function resetZoom() {
    setGallery((g) => ({ ...g, zoom: 1, fit: 'fit' }))
  }

  // Close popups with Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setPricePopup((pp) =>
          pp.open
            ? {
                open: false,
                product: null,
                baseCurrency: 'SAR',
                price: '',
                purchasePrice: '',
                x: 0,
                y: 0,
              }
            : pp
        )
        setStockPopup((sp) =>
          sp.open
            ? {
                open: false,
                product: null,
                stockUAE: 0,
                stockOman: 0,
                stockKSA: 0,
                stockBahrain: 0,
                stockIndia: 0,
                stockKuwait: 0,
                stockQatar: 0,
                inStock: true,
              }
            : sp
        )
        setGallery((g) => (g.open ? { ...g, open: false } : g))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function openStockPopup(p) {
    setStockPopup({
      open: true,
      product: p,
      stockUAE: p.stockByCountry?.UAE ?? 0,
      stockOman: p.stockByCountry?.Oman ?? 0,
      stockKSA: p.stockByCountry?.KSA ?? 0,
      stockBahrain: p.stockByCountry?.Bahrain ?? 0,
      stockIndia: p.stockByCountry?.India ?? 0,
      stockKuwait: p.stockByCountry?.Kuwait ?? 0,
      stockQatar: p.stockByCountry?.Qatar ?? 0,
      inStock: !!p.inStock,
    })
  }
  function openPricePopup(ev, p) {
    const rect = ev.currentTarget.getBoundingClientRect()
    const x = rect.left + window.scrollX
    const y = rect.bottom + window.scrollY + 6
    setPricePopup({
      open: true,
      product: p,
      baseCurrency: p.baseCurrency || 'SAR',
      price: String(p.price || ''),
      purchasePrice: String(p.purchasePrice || ''),
      x,
      y,
    })
  }
  async function saveStockPopup() {
    const p = stockPopup
    if (!p.product) return
    try {
      await apiPatch(`/api/products/${p.product._id}`, {
        inStock: p.inStock,
        stockUAE: p.stockUAE,
        stockOman: p.stockOman,
        stockKSA: p.stockKSA,
        stockBahrain: p.stockBahrain,
        stockIndia: p.stockIndia,
        stockKuwait: p.stockKuwait,
        stockQatar: p.stockQatar,
      })
      setStockPopup({
        open: false,
        product: null,
        stockUAE: 0,
        stockOman: 0,
        stockKSA: 0,
        stockBahrain: 0,
        stockIndia: 0,
        stockKuwait: 0,
        stockQatar: 0,
        inStock: true,
      })
      load()
    } catch (err) {
      alert(err?.message || 'Failed to save stock')
    }
  }
  async function savePricePopup() {
    const p = pricePopup
    if (!p.product) return
    try {
      await apiPatch(`/api/products/${p.product._id}`, {
        baseCurrency: p.baseCurrency,
        price: Number(p.price),
        purchasePrice: p.purchasePrice === '' ? '' : Number(p.purchasePrice),
      })
      setPricePopup({
        open: false,
        product: null,
        baseCurrency: 'SAR',
        price: '',
        purchasePrice: '',
        x: 0,
        y: 0,
      })
      load()
    } catch (err) {
      alert(err?.message || 'Failed to save prices')
    }
  }

  function onChange(e) {
    const { name, value, type, checked, files } = e.target
    if (type === 'checkbox') setForm((f) => ({ ...f, [name]: checked }))
    else if (type === 'file') {
      const all = Array.from(files || [])
      const arr = all.slice(0, 5)
      if (all.length > 5) setMsg('You can upload up to 5 images')
      setForm((f) => ({ ...f, images: arr }))
      setImagePreviews(arr.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })))
    } else setForm((f) => ({ ...f, [name]: value }))
  }

  // Generate product description using Gemini AI
  async function generateDescription() {
    if (!form.name || !form.category) {
      setMsg('Please enter product name and select category first')
      return
    }

    setGeneratingDescription(true)
    setMsg('')

    try {
      const madeIn = String(form.madeInCountry || '').trim()
      const extra = []
      if (madeIn) extra.push(`Made in ${madeIn}`)
      extra.push(`Product name: ${form.name}`)
      extra.push(`Category: ${form.category}`)
      if (form.description) extra.push(`Notes: ${form.description}`)
      const response = await apiPost('/api/products/generate-description', {
        productName: form.name,
        category: form.category,
        madeIn,
        additionalInfo: extra.join('\n'),
      })

      const text =
        response && (response.description || response.data?.description || response.data)
          ? String(response.description || response.data?.description || response.data)
          : ''
      if (text) {
        setAiDescription(text)
        setMsg('AI description generated successfully! You can review and use it below.')
      } else {
        setAiDescription('')
        setMsg('Failed to generate description. Please try again.')
      }
    } catch (error) {
      console.error('Error generating description:', error)
      setMsg(
        error.message ||
          'Failed to generate description. Please check your internet connection and try again.'
      )
    } finally {
      setGeneratingDescription(false)
    }
  }

  // Use AI generated description
  function useAiDescription() {
    if (!aiDescription) return
    setForm((f) => ({
      ...f,
      description: aiDescription || f.description,
    }))
    setAiDescription('')
    setMsg('AI description applied to the form')
  }

  // Clear AI description
  function clearAiDescription() {
    setAiDescription('')
    setMsg('')
  }

  function toggleCountry(k) {
    setForm((f) => {
      const has = f.availableCountries.includes(k)
      return {
        ...f,
        availableCountries: has
          ? f.availableCountries.filter((x) => x !== k)
          : [...f.availableCountries, k],
      }
    })
  }

  // Load world countries with flags
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags')
        const data = await res.json()
        const list = (data || [])
          .map((c) => ({
            code: c.cca2,
            name: c.name?.common || '',
            flag: codeToFlag(c.cca2),
          }))
          .filter((x) => x.name && x.code)
        // sort by name
        list.sort((a, b) => a.name.localeCompare(b.name))
        setWorldCountries(list)
      } catch (_) {
        setWorldCountries([])
      }
    })()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet('/api/products')
      const list = data.products || []
      // Basic sort by name asc for stable display
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      setRows(list)
    } catch (err) {
      setMsg(err?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  // Load categories from API
  async function loadCategories() {
    try {
      const data = await apiGet('/api/products/categories')
      if (data.success && data.categories) {
        setCategories(data.categories)
      }
    } catch (err) {
      console.error('Failed to load categories:', err)
      // Fallback to default categories
      setCategories([
        'Skincare',
        'Haircare',
        'Bodycare',
        'Makeup',
        'Fragrance',
        'Health & Wellness',
        'Baby Care',
        "Men's Grooming",
        'Tools & Accessories',
        'Gift Sets',
        'Other',
      ])
    }
  }

  useEffect(() => {
    load()
    loadCategories()
  }, [])

  // Load currency config once
  useEffect(() => {
    let alive = true
    getCurrencyConfig()
      .then((cfg) => {
        if (alive) setCcyCfg(cfg)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Load current user to determine permissions
  useEffect(() => {
    ;(async () => {
      try {
        const { user } = await apiGet('/api/users/me')
        setMe(user || null)
      } catch {
        setMe(null)
      }
    })()
  }, [])

  const canManage = !!(
    me &&
    (me.role === 'admin' ||
      me.role === 'user' ||
      (me.role === 'manager' && me.managerPermissions && me.managerPermissions.canManageProducts))
  )

  // Custom Image Handling
  function handleImageAdd(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    // Combine with existing
    const currentFiles = form.images || []
    const newFiles = [...currentFiles, ...files].slice(0, 5) // Limit to 5

    if (newFiles.length > 5) setMsg('You can upload up to 5 images')

    setForm((f) => ({ ...f, images: newFiles }))

    // Generate previews
    const newPreviews = newFiles.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      file: f,
    }))
    setImagePreviews(newPreviews)

    // Reset input
    e.target.value = ''
  }

  function handleRemoveImage(index) {
    const newFiles = [...(form.images || [])]
    newFiles.splice(index, 1)
    setForm((f) => ({ ...f, images: newFiles }))

    const newPreviews = [...imagePreviews]
    if (newPreviews[index]?.url) URL.revokeObjectURL(newPreviews[index].url)
    newPreviews.splice(index, 1)
    setImagePreviews(newPreviews)
  }

  function handleSetMainImage(index) {
    if (index === 0) return // Already main

    const newFiles = [...(form.images || [])]
    const fileToMove = newFiles[index]
    newFiles.splice(index, 1)
    newFiles.unshift(fileToMove)
    setForm((f) => ({ ...f, images: newFiles }))

    const newPreviews = [...imagePreviews]
    const previewToMove = newPreviews[index]
    newPreviews.splice(index, 1)
    newPreviews.unshift(previewToMove)
    setImagePreviews(newPreviews)
  }

  async function onCreate(e) {
    e.preventDefault()
    setMsg('')

    // Validation
    if (!form.name.trim()) {
      setMsg('Product name is required')
      return
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      setMsg('Valid price is required')
      return
    }
    if (!form.category) {
      setMsg('Category is required')
      return
    }
    if (!form.description.trim()) {
      setMsg('Product description is required')
      return
    }
    if (form.availableCountries.length === 0) {
      setMsg('At least one country must be selected')
      return
    }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('price', form.price)
      if (form.purchasePrice) fd.append('purchasePrice', form.purchasePrice)
      fd.append('availableCountries', form.availableCountries.join(','))
      fd.append('baseCurrency', form.baseCurrency)
      fd.append('category', form.category)
      fd.append('madeInCountry', form.madeInCountry)
      fd.append('description', form.description.trim())
      fd.append('inStock', String(form.inStock))
      fd.append('displayOnWebsite', String(!!form.displayOnWebsite))
      fd.append('isForMobile', String(!!form.isForMobile))
      fd.append('displayOnShopify', String(!!form.displayOnShopify))
      fd.append('stockUAE', String(form.stockUAE))
      fd.append('stockOman', String(form.stockOman))
      fd.append('stockKSA', String(form.stockKSA))
      fd.append('stockBahrain', String(form.stockBahrain))
      fd.append('stockIndia', String(form.stockIndia))
      fd.append('stockKuwait', String(form.stockKuwait))
      fd.append('stockQatar', String(form.stockQatar))
      for (const f of form.images || []) fd.append('images', f)

      const response = await apiUpload('/api/products', fd)

      const createdId = response?.product?._id
      if (response.success || createdId) {
        setForm({
          name: '',
          price: '',
          purchasePrice: '',
          baseCurrency: 'AED',
          category: 'Other',
          madeInCountry: '',
          description: '',
          availableCountries: [],
          inStock: true,
          displayOnWebsite: false,
          isForMobile: false,
          displayOnShopify: false,
          stockUAE: 0,
          stockOman: 0,
          stockKSA: 0,
          stockBahrain: 0,
          stockIndia: 0,
          stockKuwait: 0,
          stockQatar: 0,
          images: [],
        })
        setImagePreviews([])
        setAiDescription('')
        setMsg('Product created successfully!')
        load()
        // Optionally generate additional AI images after saving
        if (aiAfterSave && (createdId || typeof response?.product?._id === 'string')) {
          const pid = createdId || response.product._id
          const prompt = String(aiPrompt || '').trim() || null
          aiGenerateImages(pid, aiCount, prompt)
        }
      } else {
        setMsg(response.message || 'Failed to create product')
      }
    } catch (err) {
      console.error('Error creating product:', err)
      setMsg(
        err?.message || 'Failed to create product. Please check your connection and try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id) {
    if (!confirm('Delete this product?')) return
    try {
      await apiDelete(`/api/products/${id}`)
      load()
    } catch (err) {
      alert(err?.message || 'Failed')
    }
  }

  async function onToggleStock(p) {
    try {
      await apiPatch(`/api/products/${p._id}`, { inStock: !p.inStock })
      load()
    } catch (err) {
      alert(err?.message || 'Failed')
    }
  }

  function openEdit(p) {
    setEditing(p)
    setEditForm({
      name: p.name || '',
      price: p.price || '',
      purchasePrice: p.purchasePrice || '',
      baseCurrency: p.baseCurrency || 'SAR',
      category: p.category || 'Other',
      madeInCountry: p.madeInCountry || '',
      description: p.description || '',
      availableCountries: p.availableCountries || [],
      inStock: !!p.inStock,
      displayOnWebsite: !!p.displayOnWebsite,
      isForMobile: !!p.isForMobile,
      displayOnShopify: !!p.displayOnShopify,
      stockUAE: p.stockByCountry?.UAE || 0,
      stockOman: p.stockByCountry?.Oman || 0,
      stockKSA: p.stockByCountry?.KSA || 0,
      stockBahrain: p.stockByCountry?.Bahrain || 0,
      stockIndia: p.stockByCountry?.India || 0,
      stockKuwait: p.stockByCountry?.Kuwait || 0,
      stockQatar: p.stockByCountry?.Qatar || 0,
      images: [],
    })
    setEditPreviews([])
  }

  function onEditChange(e) {
    const { name, value, type, checked, files } = e.target
    if (type === 'checkbox') setEditForm((f) => ({ ...f, [name]: checked }))
    else if (type === 'file') {
      const all = Array.from(files || [])
      const arr = all.slice(0, 5)
      if (all.length > 5) setMsg('You can upload up to 5 images')
      setEditForm((f) => ({ ...f, images: arr }))
      setEditPreviews(arr.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })))
    } else setEditForm((f) => ({ ...f, [name]: value }))
  }

  async function onEditSave() {
    if (!editing || !editForm) return
    try {
      const fd = new FormData()
      fd.append('name', editForm.name)
      fd.append('price', editForm.price)
      fd.append('purchasePrice', editForm.purchasePrice)
      fd.append('availableCountries', (editForm.availableCountries || []).join(','))
      fd.append('baseCurrency', editForm.baseCurrency)
      fd.append('category', editForm.category)
      fd.append('madeInCountry', editForm.madeInCountry)
      fd.append('description', editForm.description)
      fd.append('inStock', String(editForm.inStock))
      fd.append('displayOnWebsite', String(!!editForm.displayOnWebsite))
      fd.append('isForMobile', String(!!editForm.isForMobile))
      fd.append('displayOnShopify', String(!!editForm.displayOnShopify))
      fd.append('stockUAE', String(editForm.stockUAE))
      fd.append('stockOman', String(editForm.stockOman))
      fd.append('stockKSA', String(editForm.stockKSA))
      fd.append('stockBahrain', String(editForm.stockBahrain))
      fd.append('stockIndia', String(editForm.stockIndia))
      fd.append('stockKuwait', String(editForm.stockKuwait))
      fd.append('stockQatar', String(editForm.stockQatar))
      for (const f of editForm.images || []) fd.append('images', f)
      await apiUploadPatch(`/api/products/${editing._id}`, fd)
      setEditing(null)
      setEditForm(null)
      setEditPreviews([])
      load()
    } catch (err) {
      alert(err?.message || 'Failed to update')
    }
  }

  function convertPrice(value, from, to) {
    return fxConvert(value, from || 'SAR', to || 'SAR', ccyCfg)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-orange">Create Product</div>
          <div className="page-subtitle">Add a new product with pricing and stock per country</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="#products-list" className="btn secondary">
            Go to Products
          </a>
        </div>
      </div>

      {canManage && (
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 24 }}>
          {/* Main Card */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--panel-2)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>Basic Information</div>
            </div>
            <div style={{ padding: 24, display: 'grid', gap: 20 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
                  gap: 20,
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Product Name
                  </div>
                  <input
                    className="input"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    placeholder="e.g. Luxury Face Cream"
                    required
                    style={{ padding: 12, fontSize: 15 }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Category
                  </div>
                  <select
                    className="input"
                    name="category"
                    value={form.category}
                    onChange={onChange}
                    style={{ padding: 12 }}
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Skincare">Skincare</option>
                        <option value="Haircare">Haircare</option>
                        <option value="Bodycare">Bodycare</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <div
                  className="label"
                  style={{
                    marginBottom: 8,
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Description</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn small"
                      onClick={generateDescription}
                      disabled={generatingDescription || !form.name || !form.category}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                      }}
                    >
                      {generatingDescription ? 'Generating...' : '✨ AI Generate'}
                    </button>
                    {aiDescription && (
                      <>
                        <button
                          type="button"
                          className="btn small secondary"
                          onClick={useAiDescription}
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={clearAiDescription}
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  className="input"
                  name="description"
                  value={form.description}
                  onChange={onChange}
                  placeholder="Describe the product features and benefits..."
                  rows={4}
                  style={{ padding: 12, lineHeight: 1.6 }}
                />
                {aiDescription && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 16,
                      background: 'var(--panel-2)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 8,
                        color: 'var(--primary)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      AI Suggestion
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {aiDescription}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--panel-2)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>Pricing & Inventory</div>
            </div>
            <div style={{ padding: 24, display: 'grid', gap: 20 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                  gap: 20,
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Base Currency
                  </div>
                  <select
                    className="input"
                    name="baseCurrency"
                    value={form.baseCurrency}
                    onChange={onChange}
                    style={{ padding: 12 }}
                  >
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="OMR">OMR (Omani Rial)</option>
                    <option value="BHD">BHD (Bahraini Dinar)</option>
                    <option value="KWD">KWD (Kuwaiti Dinar)</option>
                    <option value="QAR">QAR (Qatari Riyal)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="CNY">CNY (Chinese Yuan)</option>
                  </select>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Selling Price
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0.5,
                        fontWeight: 600,
                      }}
                    >
                      {form.baseCurrency}
                    </span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="price"
                      value={form.price}
                      onChange={onChange}
                      placeholder="0.00"
                      style={{
                        paddingLeft: 50,
                        paddingRight: 12,
                        paddingTop: 12,
                        paddingBottom: 12,
                      }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Purchase Price (Batch)
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0.5,
                        fontWeight: 600,
                      }}
                    >
                      {form.baseCurrency}
                    </span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      name="purchasePrice"
                      value={form.purchasePrice}
                      onChange={onChange}
                      placeholder="0.00"
                      style={{
                        paddingLeft: 50,
                        paddingRight: 12,
                        paddingTop: 12,
                        paddingBottom: 12,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 20,
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Made In
                  </div>
                  <input
                    className="input"
                    list="world-countries"
                    name="madeInCountry"
                    value={form.madeInCountry}
                    onChange={onChange}
                    placeholder="Search country..."
                    style={{ padding: 12 }}
                  />
                  <datalist id="world-countries">
                    {worldCountries.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Availability
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 4 }}>
                    {COUNTRY_OPTS.map((c) => (
                      <label
                        key={c.key}
                        className={`badge ${form.availableCountries.includes(c.name) ? 'primary' : ''}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.availableCountries.includes(c.name)}
                          onChange={() => toggleCountry(c.name)}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: 16 }}>{c.flag}</span>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {form.availableCountries.length > 0 && (
                <div style={{ background: 'var(--panel-2)', padding: 16, borderRadius: 12 }}>
                  <div className="label" style={{ marginBottom: 12, fontWeight: 600 }}>
                    Stock by Country
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile
                        ? '1fr 1fr'
                        : 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {form.availableCountries.map((c) => (
                      <div key={c}>
                        <div
                          className="label"
                          style={{ fontSize: 12, marginBottom: 4, opacity: 0.7 }}
                        >
                          {c}
                        </div>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={
                            form[
                              `stock${c === 'UAE' || c === 'KSA' ? c : c.replace(/\s+/g, '')}`
                            ] || 0
                          }
                          onChange={(e) => {
                            const key = `stock${c === 'UAE' || c === 'KSA' ? c : c.replace(/\s+/g, '')}`
                            setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                          }}
                          style={{ padding: 8 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 8 }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 40,
                      height: 24,
                      background: form.inStock ? '#10b981' : '#e5e7eb',
                      borderRadius: 12,
                      transition: '0.3s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: form.inStock ? 18 : 2,
                        top: 2,
                        width: 20,
                        height: 20,
                        background: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <input
                    type="checkbox"
                    name="inStock"
                    checked={form.inStock}
                    onChange={onChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontWeight: 500 }}>In Stock</span>
                </label>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 40,
                      height: 24,
                      background: form.displayOnWebsite ? '#3b82f6' : '#e5e7eb',
                      borderRadius: 12,
                      transition: '0.3s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: form.displayOnWebsite ? 18 : 2,
                        top: 2,
                        width: 20,
                        height: 20,
                        background: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <input
                    type="checkbox"
                    name="displayOnWebsite"
                    checked={!!form.displayOnWebsite}
                    onChange={onChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontWeight: 500 }}>Public Website</span>
                </label>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 40,
                      height: 24,
                      background: form.isForMobile ? '#8b5cf6' : '#e5e7eb',
                      borderRadius: 12,
                      transition: '0.3s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: form.isForMobile ? 18 : 2,
                        top: 2,
                        width: 20,
                        height: 20,
                        background: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <input
                    type="checkbox"
                    name="isForMobile"
                    checked={!!form.isForMobile}
                    onChange={onChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontWeight: 500 }}>Mobile App</span>
                </label>
              </div>
            </div>
          </div>

          {/* Media */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--panel-2)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>Product Images</div>
            </div>
            <div style={{ padding: 24 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Upload Button */}
                <label
                  style={{
                    aspectRatio: '1',
                    border: '2px dashed var(--border)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'var(--panel)',
                    transition: 'all 0.2s',
                    color: 'var(--muted)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.color = 'var(--primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--muted)'
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 4 }}>+</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Add Image</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageAdd}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Image Previews */}
                {imagePreviews.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: i === 0 ? '2px solid var(--primary)' : '1px solid var(--border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    }}
                  >
                    <img
                      src={p.url}
                      alt="preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {/* Actions Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
                    >
                      {i !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetMainImage(i)}
                          className="btn small"
                          style={{
                            background: 'white',
                            color: 'black',
                            fontSize: 11,
                            padding: '4px 8px',
                          }}
                        >
                          Make Main
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        className="btn small danger"
                        style={{ padding: '4px 8px' }}
                      >
                        Remove
                      </button>
                    </div>

                    {/* Main Label */}
                    {i === 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: 'var(--primary)',
                          color: 'white',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                      >
                        MAIN
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={aiAfterSave}
                    onChange={(e) => setAiAfterSave(e.target.checked)}
                  />
                  <span style={{ fontWeight: 500 }}>Generate extra AI images after saving</span>
                </label>
                {aiAfterSave && (
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      background: 'var(--panel-2)',
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 24 }}>✨</div>
                    <div style={{ flex: 1 }}>
                      <input
                        className="input"
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder={`e.g. Studio shot of ${form.name || 'product'} on marble surface`}
                        style={{ background: 'white' }}
                      />
                    </div>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="6"
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value || 2))}
                      style={{ width: 60, background: 'white' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 40 }}>
            <button
              type="button"
              className="btn secondary large"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary large"
              disabled={saving}
              style={{ minWidth: 160 }}
            >
              {saving ? 'Creating...' : 'Create Product'}
            </button>
          </div>

          {msg && (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: msg.includes('success') ? '#dcfce7' : '#fee2e2',
                color: msg.includes('success') ? '#166534' : '#991b1b',
                border: `1px solid ${msg.includes('success') ? '#bbf7d0' : '#fecaca'}`,
                marginBottom: 20,
              }}
            >
              {msg}
            </div>
          )}
        </form>
      )}

      {stockPopup.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 120,
          }}
        >
          <div className="card" style={{ width: 'min(92vw, 560px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Edit Stock by Country</div>
              <button
                className="btn"
                onClick={() =>
                  setStockPopup({
                    open: false,
                    product: null,
                    stockUAE: 0,
                    stockOman: 0,
                    stockKSA: 0,
                    stockBahrain: 0,
                    inStock: true,
                  })
                }
              >
                Close
              </button>
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}
            >
              <label className="field">
                <div>UAE</div>
                <input
                  type="number"
                  value={stockPopup.stockUAE}
                  min={0}
                  onChange={(e) =>
                    setStockPopup((s) => ({ ...s, stockUAE: Number(e.target.value || 0) }))
                  }
                />
              </label>
              <label className="field">
                <div>Oman</div>
                <input
                  type="number"
                  value={stockPopup.stockOman}
                  min={0}
                  onChange={(e) =>
                    setStockPopup((s) => ({ ...s, stockOman: Number(e.target.value || 0) }))
                  }
                />
              </label>
              <label className="field">
                <div>KSA</div>
                <input
                  type="number"
                  value={stockPopup.stockKSA}
                  min={0}
                  onChange={(e) =>
                    setStockPopup((s) => ({ ...s, stockKSA: Number(e.target.value || 0) }))
                  }
                />
              </label>
              <label className="field">
                <div>Bahrain</div>
                <input
                  type="number"
                  value={stockPopup.stockBahrain}
                  min={0}
                  onChange={(e) =>
                    setStockPopup((s) => ({ ...s, stockBahrain: Number(e.target.value || 0) }))
                  }
                />
              </label>
              <label
                style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={stockPopup.inStock}
                  onChange={(e) => setStockPopup((s) => ({ ...s, inStock: e.target.checked }))}
                />
                <span>Product In Stock</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                className="btn secondary"
                onClick={() =>
                  setStockPopup({
                    open: false,
                    product: null,
                    stockUAE: 0,
                    stockOman: 0,
                    stockKSA: 0,
                    stockBahrain: 0,
                    inStock: true,
                  })
                }
              >
                Cancel
              </button>
              <button className="btn" onClick={saveStockPopup}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {pricePopup.open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 130 }}
          onClick={() =>
            setPricePopup({
              open: false,
              product: null,
              baseCurrency: 'SAR',
              price: '',
              purchasePrice: '',
              x: 0,
              y: 0,
            })
          }
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: Math.max(8, Math.min(pricePopup.x, window.innerWidth - 320)),
              top: Math.max(8, Math.min(pricePopup.y, window.innerHeight - 240)),
              width: 300,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Edit Prices</div>
              <button
                className="btn"
                onClick={() =>
                  setPricePopup({
                    open: false,
                    product: null,
                    baseCurrency: 'SAR',
                    price: '',
                    purchasePrice: '',
                    x: 0,
                    y: 0,
                  })
                }
              >
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 10 }}>
              <label className="field">
                <div>Base Currency</div>
                <select
                  value={pricePopup.baseCurrency}
                  onChange={(e) => setPricePopup((p) => ({ ...p, baseCurrency: e.target.value }))}
                >
                  {['AED', 'OMR', 'SAR', 'BHD', 'INR', 'KWD', 'QAR', 'USD', 'CNY'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <div>Price</div>
                <input
                  type="number"
                  step="0.01"
                  value={pricePopup.price}
                  onChange={(e) => setPricePopup((p) => ({ ...p, price: e.target.value }))}
                />
              </label>
              <label className="field">
                <div>Total Purchase Price (batch)</div>
                <input
                  type="number"
                  step="0.01"
                  value={pricePopup.purchasePrice}
                  onChange={(e) => setPricePopup((p) => ({ ...p, purchasePrice: e.target.value }))}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                className="btn secondary"
                onClick={() =>
                  setPricePopup({
                    open: false,
                    product: null,
                    baseCurrency: 'SAR',
                    price: '',
                    purchasePrice: '',
                    x: 0,
                    y: 0,
                  })
                }
              >
                Cancel
              </button>
              <button className="btn" onClick={savePricePopup}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {gallery.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 110,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '98vw',
              height: '96vh',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff',
              }}
            >
              <div>
                Images {gallery.index + 1} / {gallery.images.length}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn secondary"
                  onClick={() => setGallery((g) => ({ ...g, fit: 'fit', zoom: 1 }))}
                >
                  Fit
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setGallery((g) => ({ ...g, fit: 'actual', zoom: 1 }))}
                >
                  100%
                </button>
                <button
                  className="btn secondary"
                  onClick={() =>
                    window.open(
                      `${API_BASE}${gallery.images[gallery.index]}`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                >
                  Open
                </button>
                <button className="btn secondary" onClick={resetZoom}>
                  Reset
                </button>
                <button className="btn secondary" onClick={zoomOut}>
                  -
                </button>
                <button className="btn secondary" onClick={zoomIn}>
                  +
                </button>
                <button className="btn" onClick={closeGallery}>
                  Close
                </button>
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                overflow: gallery.fit === 'actual' ? 'auto' : 'hidden',
                display: 'grid',
                placeItems: 'center',
                background: '#000',
              }}
            >
              <img
                src={`${API_BASE}${gallery.images[gallery.index]}`}
                alt={`img-${gallery.index}`}
                onDoubleClick={() =>
                  setGallery((g) => ({ ...g, fit: g.fit === 'fit' ? 'actual' : 'fit', zoom: 1 }))
                }
                style={{
                  ...(gallery.fit === 'fit'
                    ? {
                        width: '100%',
                        height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }
                    : { width: 'auto', height: 'auto', maxWidth: 'none', maxHeight: 'none' }),
                  ...(gallery.zoom !== 1
                    ? { transform: `scale(${gallery.zoom})`, transformOrigin: 'center center' }
                    : {}),
                  transition: 'transform 120ms ease',
                }}
              />
              <button
                aria-label="Prev"
                onClick={prevImg}
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                {'‹'}
              </button>
              <button
                aria-label="Next"
                onClick={nextImg}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                {'›'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {gallery.images.map((g, i) => (
                <img
                  key={i}
                  onClick={() => setGallery((x) => ({ ...x, index: i, zoom: 1 }))}
                  src={`${API_BASE}${g}`}
                  alt={`thumb-${i}`}
                  style={{
                    height: 48,
                    width: 48,
                    objectFit: 'cover',
                    borderRadius: 6,
                    border:
                      i === gallery.index
                        ? `2px solid var(--wa-accent)`
                        : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div id="products-list" className="card" style={{ marginTop: 12 }}>
        <div className="page-header">
          <div>
            <div className="page-title gradient heading-green">Inhouse Products</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              placeholder="Search by name, category, country"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>
        </div>
        <div style={{ overflow: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Image</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Price (AED/OMR/SAR/BHD)</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Total Purchase Price</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Made In</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Available In</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Stock</th>
                {canManage && <th style={{ textAlign: 'left', padding: '10px 12px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '10px 12px', opacity: 0.7 }}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '10px 12px', opacity: 0.7 }}>
                    No products
                  </td>
                </tr>
              ) : (
                rows
                  .filter((p) => {
                    if (!query.trim()) return true
                    const q = query.trim().toLowerCase()
                    const hay = [
                      p.name,
                      p.category,
                      p.madeInCountry,
                      ...(p.availableCountries || []),
                    ]
                      .join(' ')
                      .toLowerCase()
                    return hay.includes(q)
                  })
                  .map((p) => (
                    <tr key={p._id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        {(() => {
                          const imgs =
                            p.images && p.images.length > 0
                              ? p.images
                              : p.imagePath
                                ? [p.imagePath]
                                : []
                          if (imgs.length === 0) return '-'
                          const first = imgs[0]
                          return (
                            <div style={{ position: 'relative', width: 48, height: 48 }}>
                              <img
                                onClick={() => openImageOrGallery(imgs)}
                                src={`${API_BASE}${first}`}
                                alt={p.name}
                                style={{
                                  height: 48,
                                  width: 48,
                                  objectFit: 'cover',
                                  borderRadius: 6,
                                  cursor: 'zoom-in',
                                }}
                              />
                              {imgs.length > 1 && (
                                <button
                                  onClick={() => openGallery(imgs, 0)}
                                  title={`+${imgs.length - 1} more`}
                                  style={{
                                    position: 'absolute',
                                    right: -6,
                                    bottom: -6,
                                    transform: 'translate(0,0)',
                                    background: 'var(--panel-2)',
                                    color: 'var(--fg)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 12,
                                    padding: '2px 6px',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                >
                                  +{imgs.length - 1}
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {String(p?.createdByRole || '').toLowerCase() === 'manager' &&
                        p?.createdByActorName ? (
                          <div className="helper" style={{ fontSize: 11, opacity: 0.85 }}>
                            Created by {p.createdByActorName}
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{ padding: '10px 12px', cursor: 'pointer' }}
                        onClick={(e) => openPricePopup(e, p)}
                        title="Edit price"
                      >
                        {(() => {
                          const COUNTRY_TO_CCY = {
                            UAE: 'AED',
                            Oman: 'OMR',
                            KSA: 'SAR',
                            Bahrain: 'BHD',
                          }
                          const av = (p.availableCountries || [])
                            .map((c) => COUNTRY_TO_CCY[c])
                            .filter(Boolean)
                          const uniq = Array.from(new Set(av))
                          const show = uniq.length > 0 ? uniq : ['AED', 'OMR', 'SAR', 'BHD']
                          return (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {show.map((cc) => (
                                <span key={cc} className="badge">
                                  {cc}{' '}
                                  {convertPrice(p.price, p.baseCurrency || 'SAR', cc).toFixed(2)}
                                </span>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{p.category || '-'}</td>
                      <td
                        style={{ padding: '10px 12px', cursor: 'pointer' }}
                        onClick={(e) => openPricePopup(e, p)}
                        title="Edit purchase price"
                      >
                        {p.purchasePrice
                          ? (() => {
                              const COUNTRY_TO_CCY = {
                                UAE: 'AED',
                                Oman: 'OMR',
                                KSA: 'SAR',
                                Bahrain: 'BHD',
                              }
                              const av = (p.availableCountries || [])
                                .map((c) => COUNTRY_TO_CCY[c])
                                .filter(Boolean)
                              const uniq = Array.from(new Set(av))
                              const show = uniq.length > 0 ? uniq : ['AED', 'OMR', 'SAR', 'BHD']
                              return (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {show.map((cc) => (
                                    <span key={cc} className="badge">
                                      {cc}{' '}
                                      {convertPrice(
                                        p.purchasePrice,
                                        p.baseCurrency || 'SAR',
                                        cc
                                      ).toFixed(2)}
                                    </span>
                                  ))}
                                </div>
                              )
                            })()
                          : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{p.madeInCountry || '-'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {(p.availableCountries || []).length === 0 ? (
                          <span className="badge warn">No Availability</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(p.availableCountries || []).map((c) => (
                              <span key={c} className="badge">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td
                        style={{ padding: '10px 12px', cursor: 'pointer' }}
                        onClick={() => openStockPopup(p)}
                        title="Edit stock by country"
                      >
                        {p.inStock ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span className="badge success">In Stock</span>
                            {[
                              { k: 'UAE', v: p.stockByCountry?.UAE ?? 0 },
                              { k: 'Oman', v: p.stockByCountry?.Oman ?? 0 },
                              { k: 'KSA', v: p.stockByCountry?.KSA ?? 0 },
                              { k: 'Bahrain', v: p.stockByCountry?.Bahrain ?? 0 },
                            ]
                              .filter((x) => Number(x.v) > 0)
                              .map((x) => (
                                <span key={x.k} className="badge">
                                  {x.k}: {x.v}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="badge danger">Out of Stock</span>
                        )}
                      </td>
                      {canManage && (
                        <td style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                          <button
                            className="btn"
                            onClick={() => aiGenerateImages(p._id, 2, null)}
                            disabled={aiBusy}
                            title="Generate Images Now"
                            aria-label="Generate Images Now"
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            ✨
                          </button>
                          <button
                            className="btn secondary"
                            onClick={() => openEdit(p)}
                            title="Edit"
                            aria-label="Edit"
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => onDelete(p._id)}
                            title="Delete"
                            aria-label="Delete"
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && editForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
          }}
        >
          <div
            className="card"
            style={{
              width: 'min(900px, 96vw)',
              maxHeight: '90vh',
              overflow: 'auto',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Edit Product</div>
              <button
                className="btn secondary"
                onClick={() => {
                  setEditing(null)
                  setEditForm(null)
                  setEditPreviews([])
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <div className="label">Name</div>
                  <input
                    className="input"
                    name="name"
                    value={editForm.name}
                    onChange={onEditChange}
                  />
                </div>
                <div>
                  <div className="label">Price</div>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    name="price"
                    value={editForm.price}
                    onChange={onEditChange}
                  />
                </div>
                <div>
                  <div className="label">Purchase Price</div>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    name="purchasePrice"
                    value={editForm.purchasePrice}
                    onChange={onEditChange}
                  />
                </div>
                <div>
                  <div className="label">Base Currency</div>
                  <select
                    className="input"
                    name="baseCurrency"
                    value={editForm.baseCurrency}
                    onChange={onEditChange}
                  >
                    <option value="AED">AED</option>
                    <option value="OMR">OMR</option>
                    <option value="SAR">SAR</option>
                    <option value="BHD">BHD</option>
                    <option value="INR">INR</option>
                    <option value="KWD">KWD</option>
                    <option value="QAR">QAR</option>
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
                <div>
                  <div className="label">Category</div>
                  <select
                    className="input"
                    name="category"
                    value={editForm.category}
                    onChange={onEditChange}
                  >
                    <option value="Skincare">Skincare</option>
                    <option value="Haircare">Haircare</option>
                    <option value="Bodycare">Bodycare</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <div className="label">Made In</div>
                  <input
                    className="input"
                    list="world-countries"
                    name="madeInCountry"
                    value={editForm.madeInCountry}
                    onChange={onEditChange}
                    placeholder="Type to search country"
                  />
                </div>
                <div>
                  <div className="label">In Stock</div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      name="inStock"
                      checked={editForm.inStock}
                      onChange={onEditChange}
                    />{' '}
                    Product In Stock
                  </label>
                </div>
                <div>
                  <div className="label">Display on Website</div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      name="displayOnWebsite"
                      checked={!!editForm.displayOnWebsite}
                      onChange={onEditChange}
                    />{' '}
                    Show in public e-commerce
                  </label>
                </div>
                <div>
                  <div className="label">Mobile Application</div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      name="isForMobile"
                      checked={!!editForm.isForMobile}
                      onChange={onEditChange}
                    />{' '}
                    Show on Mobile Application
                  </label>
                </div>
                <div>
                  <div className="label">Shopify Store</div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      name="displayOnShopify"
                      checked={!!editForm.displayOnShopify}
                      onChange={onEditChange}
                    />{' '}
                    Sync to Shopify
                  </label>
                </div>
              </div>
              {(editForm.availableCountries || []).length > 0 && (
                <div>
                  <div className="label">Stock by Selected Countries</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                      gap: 12,
                    }}
                  >
                    {editForm.availableCountries.includes('UAE') && (
                      <div>
                        <div className="label" style={{ opacity: 0.8 }}>
                          UAE
                        </div>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          name="stockUAE"
                          value={editForm.stockUAE}
                          onChange={onEditChange}
                        />
                      </div>
                    )}
                    {editForm.availableCountries.includes('Oman') && (
                      <div>
                        <div className="label" style={{ opacity: 0.8 }}>
                          Oman
                        </div>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          name="stockOman"
                          value={editForm.stockOman}
                          onChange={onEditChange}
                        />
                      </div>
                    )}
                    {editForm.availableCountries.includes('KSA') && (
                      <div>
                        <div className="label" style={{ opacity: 0.8 }}>
                          KSA
                        </div>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          name="stockKSA"
                          value={editForm.stockKSA}
                          onChange={onEditChange}
                        />
                      </div>
                    )}
                    {editForm.availableCountries.includes('Bahrain') && (
                      <div>
                        <div className="label" style={{ opacity: 0.8 }}>
                          Bahrain
                        </div>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          name="stockBahrain"
                          value={editForm.stockBahrain}
                          onChange={onEditChange}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                <div className="label">Availability Countries</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {COUNTRY_OPTS.map((c) => {
                    const checked = (editForm.availableCountries || []).includes(c.name)
                    return (
                      <label
                        key={c.key}
                        className="badge"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditForm((f) => ({
                              ...f,
                              availableCountries: checked
                                ? f.availableCountries.filter((x) => x !== c.name)
                                : [...f.availableCountries, c.name],
                            }))
                          }
                        />{' '}
                        {c.flag} {c.name}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="label">Description</div>
                <textarea
                  className="input"
                  name="description"
                  value={editForm.description}
                  onChange={onEditChange}
                  rows={3}
                />
              </div>
              <div>
                <div className="label">Replace Images (up to 5)</div>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onEditChange}
                  name="images"
                />
                <div className="helper" style={{ marginTop: 6 }}>
                  Up to 5 images
                </div>
                {editPreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {editPreviews.map((p, i) => (
                      <img
                        key={i}
                        src={p.url}
                        alt={p.name}
                        style={{
                          height: 64,
                          width: 64,
                          objectFit: 'cover',
                          borderRadius: 6,
                          border: '1px solid #233',
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="helper" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  <div className="label">AI Images</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '120px 1fr auto',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <input type="number" min="1" max="6" defaultValue={2} id="edit-ai-count" />
                    <input
                      type="text"
                      defaultValue={`Studio photos of ${editForm.name}, ${editForm.category}. Clean white background.`}
                      id="edit-ai-prompt"
                    />
                    <button
                      className="btn"
                      disabled={aiBusy}
                      onClick={async () => {
                        const cnt = Number(document.getElementById('edit-ai-count').value || 2)
                        const pr = String(document.getElementById('edit-ai-prompt').value || '')
                        await aiGenerateImages(editing._id, cnt, pr)
                      }}
                    >
                      {aiBusy ? 'Generating…' : 'Generate AI Images'}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setEditing(null)
                    setEditForm(null)
                    setEditPreviews([])
                  }}
                >
                  Cancel
                </button>
                <button className="btn" onClick={onEditSave}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
