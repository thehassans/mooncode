import React, { useEffect, useState } from 'react'
import { apiGet, apiUpload, API_BASE } from '../../api'

const FRAME_STYLES = [
  { id: 'none', label: 'No Frame', border: 'none' },
  {
    id: 'classic',
    label: 'Classic White',
    border: '8px solid #ffffff',
    shadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  {
    id: 'elegant',
    label: 'Elegant Black',
    border: '6px solid #1a1a1a',
    shadow: '0 4px 20px rgba(0,0,0,0.25)',
  },
  {
    id: 'gold',
    label: 'Luxury Gold',
    border: '10px solid #d4af37',
    shadow: '0 8px 30px rgba(212,175,55,0.3)',
  },
  {
    id: 'modern',
    label: 'Modern Gray',
    border: '4px solid #6b7280',
    shadow: '0 4px 15px rgba(0,0,0,0.1)',
  },
]

const BACKGROUNDS = [
  { id: 'white', label: 'Pure White', value: '#ffffff' },
  { id: 'cream', label: 'Cream', value: '#fef7e6' },
  {
    id: 'gradient1',
    label: 'Sunset Gradient',
    value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'gradient2',
    label: 'Ocean Gradient',
    value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  },
  {
    id: 'gradient3',
    label: 'Rose Gold',
    value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  },
  { id: 'light', label: 'Light Gray', value: '#f9fafb' },
]

const COLLAGE_LAYOUTS = [
  { id: 'single', label: 'Single', images: 1, grid: '1fr' },
  { id: 'double', label: 'Side by Side', images: 2, grid: '1fr 1fr' },
  { id: 'triple', label: 'Triple', images: 3, grid: '1fr 1fr 1fr' },
  { id: 'quad', label: 'Quad', images: 4, grid: '1fr 1fr / 1fr 1fr' },
  { id: 'showcase', label: 'Showcase (1+2)', images: 3, grid: '2fr 1fr / 1fr 1fr' },
]

export default function InvestorProducts() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [packages_, setPackages] = useState([
    {
      index: 1,
      name: 'Products Package 1',
      price: '',
      profitPercentage: '',
      image: '',
      imageFile: null,
      images: [],
      imageFiles: [],
      collageLayout: 'single',
      frameStyle: 'none',
      background: 'white',
    },
    {
      index: 2,
      name: 'Products Package 2',
      price: '',
      profitPercentage: '',
      image: '',
      imageFile: null,
      images: [],
      imageFiles: [],
      collageLayout: 'single',
      frameStyle: 'none',
      background: 'white',
    },
    {
      index: 3,
      name: 'Products Package 3',
      price: '',
      profitPercentage: '',
      image: '',
      imageFile: null,
      images: [],
      imageFiles: [],
      collageLayout: 'single',
      frameStyle: 'none',
      background: 'white',
    },
  ])

  async function load() {
    try {
      setLoading(true)
      const { packages } = await apiGet('/api/users/investor-plans')
      const hydrated = (packages || []).map((p) => ({
        index: p.index,
        name: p.name || `Products Package ${p.index}`,
        price: String(p.price ?? ''),
        profitPercentage: String(p.profitPercentage ?? ''),
        image: p.image || '',
        imageFile: null,
        images: p.images || [],
        imageFiles: [],
        collageLayout: p.collageLayout || 'single',
        frameStyle: p.frameStyle || 'none',
        background: p.background || 'white',
      }))
      setPackages(hydrated)
    } catch (err) {
      console.error('Failed to load investor plans', err)
      setMsg(err?.message || 'Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function updateField(idx, key, val) {
    setPackages((arr) => arr.map((p) => (p.index === idx ? { ...p, [key]: val } : p)))
  }

  function onFileChange(idx, file) {
    setPackages((arr) => arr.map((p) => (p.index === idx ? { ...p, imageFile: file } : p)))
  }

  function onMultiFileChange(idx, files) {
    const fileArray = Array.from(files || [])
    setPackages((arr) =>
      arr.map((p) => (p.index === idx ? { ...p, imageFiles: [...p.imageFiles, ...fileArray] } : p))
    )
  }

  function removeImage(pkgIdx, imgIdx) {
    setPackages((arr) =>
      arr.map((p) =>
        p.index === pkgIdx ? { ...p, imageFiles: p.imageFiles.filter((_, i) => i !== imgIdx) } : p
      )
    )
  }

  function getFrameStyle(frameId) {
    return FRAME_STYLES.find((f) => f.id === frameId) || FRAME_STYLES[0]
  }

  function getBackground(bgId) {
    return BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS[0]
  }

  function getLayout(layoutId) {
    return COLLAGE_LAYOUTS.find((l) => l.id === layoutId) || COLLAGE_LAYOUTS[0]
  }

  async function save() {
    try {
      setSaving(true)
      setMsg('')
      const form = new FormData()
      const payload = packages_.map((p) => ({
        index: p.index,
        name: String(p.name || '').trim() || `Products Package ${p.index}`,
        price: Number(p.price || 0),
        profitPercentage: Number(p.profitPercentage || 0),
        image: p.image || '',
        collageLayout: p.collageLayout,
        frameStyle: p.frameStyle,
        background: p.background,
      }))
      form.append('packages', JSON.stringify(payload))
      packages_.forEach((p) => {
        if (p.imageFile) form.append(`image${p.index}`, p.imageFile)
        p.imageFiles.forEach((file, i) => {
          form.append(`images${p.index}[]`, file)
        })
      })
      const res = await apiUpload('/api/users/investor-plans', form)
      setMsg('Saved! Investor panel updated.')
      // Reload to normalize values
      await load()
    } catch (err) {
      setMsg(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 24 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div
            className="page-title gradient heading-orange"
            style={{ fontSize: 32, fontWeight: 700 }}
          >
            Investor Products
          </div>
          <div className="page-subtitle" style={{ fontSize: 15, opacity: 0.8, marginTop: 8 }}>
            Configure three investment packages for your investors with premium collages
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="card-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel-2)',
          }}
        >
          <div className="card-title" style={{ fontSize: 18, fontWeight: 700 }}>
            Investment Plans
          </div>
        </div>
        <div style={{ padding: 24 }}>
          {msg && (
            <div
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 8,
                background: msg.includes('Saved') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: msg.includes('Saved') ? '#10b981' : '#ef4444',
                border: `1px solid ${msg.includes('Saved') ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              {msg}
            </div>
          )}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div className="spinner" />
              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>Loading packages…</div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24,
              }}
            >
              {packages_.map((p) => {
                const frame = getFrameStyle(p.frameStyle)
                const bg = getBackground(p.background)
                const layout = getLayout(p.collageLayout)

                return (
                  <div
                    key={p.index}
                    className="card"
                    style={{
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                  >
                    <div
                      className="card-header"
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--panel-2)',
                      }}
                    >
                      <div className="card-title" style={{ fontSize: 16, fontWeight: 700 }}>
                        Products Package {p.index}
                      </div>
                    </div>
                    <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                      {/* Collage Preview */}
                      <div>
                        <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                          Image Collage
                        </div>
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '16 / 9',
                            borderRadius: 12,
                            border: '2px solid var(--border)',
                            background: bg.value,
                            display: 'grid',
                            gridTemplateColumns: layout.grid,
                            gap: 8,
                            padding: 12,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          {p.imageFiles.length > 0 ? (
                            p.imageFiles.slice(0, layout.images).map((file, idx) => (
                              <div
                                key={idx}
                                style={{
                                  position: 'relative',
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                  border: frame.border,
                                  boxShadow: frame.shadow,
                                  background: '#f9fafb',
                                }}
                              >
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Preview ${idx + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                                <button
                                  onClick={() => removeImage(p.index, idx)}
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          ) : (
                            <div
                              style={{
                                gridColumn: '1 / -1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.5,
                                fontSize: 14,
                              }}
                            >
                              Upload images to see collage
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Image Upload */}
                      <div>
                        <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                          Upload Images ({p.imageFiles.length} / {layout.images})
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => onMultiFileChange(p.index, e.target.files)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '2px dashed var(--border)',
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        />
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                          Upload up to {layout.images} images for this package
                        </div>
                      </div>

                      {/* Layout Selection */}
                      <div>
                        <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                          Collage Layout
                        </div>
                        <select
                          className="input"
                          value={p.collageLayout}
                          onChange={(e) => updateField(p.index, 'collageLayout', e.target.value)}
                          style={{ padding: '10px 12px', fontSize: 14 }}
                        >
                          {COLLAGE_LAYOUTS.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.label} ({l.images} image{l.images > 1 ? 's' : ''})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Frame Style */}
                      <div>
                        <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                          Frame Style
                        </div>
                        <div
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}
                        >
                          {FRAME_STYLES.map((frame) => (
                            <button
                              key={frame.id}
                              onClick={() => updateField(p.index, 'frameStyle', frame.id)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: `2px solid ${p.frameStyle === frame.id ? '#ea580c' : 'var(--border)'}`,
                                background:
                                  p.frameStyle === frame.id ? 'rgba(234, 88, 12, 0.1)' : 'white',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: p.frameStyle === frame.id ? 600 : 400,
                                transition: 'all 0.2s',
                              }}
                            >
                              {frame.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Background */}
                      <div>
                        <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                          Background
                        </div>
                        <div
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}
                        >
                          {BACKGROUNDS.map((bgOption) => (
                            <button
                              key={bgOption.id}
                              onClick={() => updateField(p.index, 'background', bgOption.id)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: `2px solid ${p.background === bgOption.id ? '#ea580c' : 'var(--border)'}`,
                                background:
                                  p.background === bgOption.id ? 'rgba(234, 88, 12, 0.1)' : 'white',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: p.background === bgOption.id ? 600 : 400,
                                transition: 'all 0.2s',
                              }}
                            >
                              <div
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  background: bgOption.value,
                                  display: 'inline-block',
                                  marginRight: 6,
                                  verticalAlign: 'middle',
                                  border: '1px solid var(--border)',
                                }}
                              />
                              {bgOption.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Name */}
                      <div>
                        <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                          Package Name
                        </div>
                        <input
                          className="input"
                          type="text"
                          value={p.name}
                          onChange={(e) => updateField(p.index, 'name', e.target.value)}
                          placeholder={`Products Package ${p.index}`}
                          style={{ padding: '10px 12px', fontSize: 14 }}
                        />
                      </div>

                      {/* Price & Profit */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                            Price
                          </div>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.price}
                            onChange={(e) => updateField(p.index, 'price', e.target.value)}
                            placeholder="0"
                            style={{ padding: '10px 12px', fontSize: 14 }}
                          />
                        </div>
                        <div>
                          <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                            Profit %
                          </div>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={p.profitPercentage}
                            onChange={(e) =>
                              updateField(p.index, 'profitPercentage', e.target.value)
                            }
                            placeholder="0"
                            style={{ padding: '10px 12px', fontSize: 14 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--panel)',
          }}
        >
          <button
            className="btn primary large"
            onClick={save}
            disabled={saving || loading}
            style={{
              padding: '12px 32px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div
        style={{
          padding: 16,
          background: 'var(--panel)',
          borderRadius: 8,
          fontSize: 13,
          border: '1px solid var(--border)',
        }}
      >
        <strong>Note:</strong> Investors will see these plans under their Investment Plans page.
        Choose layouts, frames, and backgrounds to create stunning product showcases!
      </div>
    </div>
  )
}
