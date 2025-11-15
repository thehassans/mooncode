import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'

export default function InvestorReferrals() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  }, [])
  const refCode = useMemo(
    () => me?.referralCode || me?.refCode || me?.inviteCode || me?._id || me?.id || '',
    [me]
  )
  const link = useMemo(() => {
    try {
      const origin = window.location.origin
      return `${origin}/investor/signup?ref=${encodeURIComponent(refCode)}`
    } catch {
      return `/investor/signup?ref=${encodeURIComponent(refCode)}`
    }
  }, [refCode])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    try {
      abortRef.current && abortRef.current.abort()
    } catch {}
    const c = new AbortController()
    abortRef.current = c
    ;(async () => {
      const candidates = [
        `/api/investors/referrals?code=${encodeURIComponent(refCode)}`,
        `/api/investor/referrals?code=${encodeURIComponent(refCode)}`,
        `/api/referrals?code=${encodeURIComponent(refCode)}`,
      ]
      for (const url of candidates) {
        try {
          const res = await apiGet(url, { signal: c.signal })
          if (!mounted) return
          const list = Array.isArray(res?.referrals) ? res.referrals : Array.isArray(res) ? res : []
          setRows(list)
          setLoading(false)
          return
        } catch (e) {
          if (e?.name === 'AbortError') return
          // try next
        }
      }
      if (!mounted) return
      setRows([])
      setLoading(false)
    })()
    return () => {
      mounted = false
      try {
        c.abort()
      } catch {}
    }
  }, [refCode])

  function copy() {
    try {
      navigator.clipboard.writeText(link)
      toast.success('Referral link copied')
    } catch {
      toast.info('Select and copy the link')
    }
  }
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join BuySial as Investor',
          text: 'Use my referral link to join:',
          url: link,
        })
      } else {
        copy()
      }
    } catch {}
  }

  function wa() {
    const msg = encodeURIComponent(`Join as an investor on BuySial using my referral link: ${link}`)
    try {
      window.open(`https://wa.me/?text=${msg}`, '_blank')
    } catch {}
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Referral Program</div>
          <div className="helper">
            Share your unique link. New investors who sign up via your link appear below.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={copy}>
            Copy Link
          </button>
          <button className="btn" onClick={share}>
            Share
          </button>
          <button className="btn" onClick={wa} style={{ background: '#25d366' }}>
            WhatsApp
          </button>
        </div>
      </div>
      <div className="panel" style={{ padding: 12, borderRadius: 12 }}>
        <div className="helper" style={{ marginBottom: 6 }}>
          Your referral link
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            readOnly
            value={link}
            style={{
              flex: '1 1 360px',
              minWidth: 260,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--input-bg)',
              color: 'var(--fg)',
            }}
          />
          <button className="btn secondary" onClick={copy}>
            Copy
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 12, borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Referred Investors</div>
        {loading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 42, borderRadius: 10 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="helper">No referrals yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Joined</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.name || '-'
                  const email = r.email || r.contactEmail || '-'
                  const joined = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'
                  const status = r.status || r.approvalStatus || 'pending'
                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{name}</td>
                      <td style={{ padding: '8px 10px' }}>{email}</td>
                      <td style={{ padding: '8px 10px' }}>{joined}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          className="badge"
                          style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
