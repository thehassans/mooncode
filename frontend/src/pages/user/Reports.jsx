import React, { useEffect, useRef, useState } from 'react'
import { apiGet } from '../../api'

const COUNTRIES = [
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR' },
  { code: 'UAE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED' },
  { code: 'Oman', name: 'Oman', flag: '🇴🇲', currency: 'OMR' },
  { code: 'Bahrain', name: 'Bahrain', flag: '🇧🇭', currency: 'BHD' },
  { code: 'India', name: 'India', flag: '🇮🇳', currency: 'INR' },
  { code: 'Kuwait', name: 'Kuwait', flag: '🇰🇼', currency: 'KWD' },
  { code: 'Qatar', name: 'Qatar', flag: '🇶🇦', currency: 'QAR' },
]

export default function Reports(){
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [generating, setGenerating] = useState(false)
  const reportRef = useRef(null)

  async function loadMetrics(){
    setLoading(true)
    try{
      const res = await apiGet('/api/reports/user-metrics')
      setMetrics(res)
    }catch(err){
      console.error('Failed to load metrics', err)
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ loadMetrics() },[])

  const profitLoss = metrics?.profitLoss || {}
  const byCountry = profitLoss.byCountry || {}

  // Calculate totals
  const globalProfit = profitLoss.profit || 0
  const globalRevenue = profitLoss.revenue || 0
  const globalPurchaseCost = profitLoss.purchaseCost || 0
  const globalDriverComm = profitLoss.driverCommission || 0
  const globalAgentComm = profitLoss.agentCommission || 0
  const globalInvestorComm = profitLoss.investorCommission || 0
  const globalAdExpense = profitLoss.advertisementExpense || 0

  const downloadPDF = async () => {
    setGenerating(true)
    try {
      // Use html2canvas to capture the report
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      
      const element = reportRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 10
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`Business-Report-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="card" style={{padding: 40, textAlign: 'center'}}>
        <div style={{fontSize: 18, opacity: 0.7}}>Loading business report...</div>
      </div>
    )
  }

  return (
    <div style={{maxWidth: 1400, margin: '0 auto'}}>
      {/* Header with Download Button */}
      <div style={{marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{
            width:48, height:48, borderRadius:16,
            background:'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
            display:'grid', placeItems:'center', fontSize:24
          }}>📊</div>
          <div>
            <h1 style={{fontSize:28, fontWeight:900, margin:0}}>Business Report</h1>
            <p style={{fontSize:14, opacity:0.7, margin:0}}>Comprehensive financial overview with all expenses and profits</p>
          </div>
        </div>
        <div style={{display: 'flex', gap: 12}}>
          <button className="btn secondary" onClick={loadMetrics} disabled={loading}>
            {loading ? '⟳ Loading...' : '⟳ Refresh'}
          </button>
          <button 
            className="btn" 
            onClick={downloadPDF}
            disabled={generating}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
              border: 'none',
              padding: '10px 20px',
              fontWeight: 700
            }}
          >
            {generating ? '⏳ Generating...' : '📥 Download PDF'}
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} style={{background: '#fff', padding: 24, borderRadius: 12}}>
        {/* Report Header */}
        <div style={{borderBottom: '2px solid #e5e7eb', paddingBottom: 16, marginBottom: 24}}>
          <h2 style={{fontSize: 24, fontWeight: 800, margin: 0, color: '#111'}}>Financial Business Report</h2>
          <p style={{fontSize: 14, color: '#6b7280', margin: '4px 0 0 0'}}>
            Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Global Summary */}
        <div style={{marginBottom: 32}}>
          <h3 style={{fontSize: 20, fontWeight: 800, marginBottom: 16, color: '#111'}}>📈 Global Summary (AED)</h3>
          <div style={{
            border: '2px solid ' + (globalProfit >= 0 ? '#10b981' : '#ef4444'),
            borderRadius: 12,
            padding: 20,
            background: globalProfit >= 0 ? '#10b98110' : '#ef444410'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <div>
                <div style={{fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 4}}>
                  {globalProfit >= 0 ? 'TOTAL PROFIT' : 'TOTAL LOSS'}
                </div>
                <div style={{fontSize: 36, fontWeight: 900, color: globalProfit >= 0 ? '#10b981' : '#ef4444'}}>
                  {globalProfit >= 0 ? '+' : '-'} AED {fmtNum(Math.abs(globalProfit))}
                </div>
              </div>
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb'}}>
              <StatBox label="Revenue" value={`AED ${fmtNum(globalRevenue)}`} color="#0ea5e9" />
              <StatBox label="Purchase Cost" value={`AED ${fmtNum(globalPurchaseCost)}`} color="#8b5cf6" />
              <StatBox label="Driver Commission" value={`AED ${fmtNum(globalDriverComm)}`} color="#f59e0b" />
              <StatBox label="Agent Commission" value={`AED ${fmtNum(globalAgentComm)}`} color="#f59e0b" />
              <StatBox label="Investor Commission" value={`AED ${fmtNum(globalInvestorComm)}`} color="#f59e0b" />
              <StatBox label="Advertisement Expense" value={`AED ${fmtNum(globalAdExpense)}`} color="#ef4444" />
            </div>
          </div>
        </div>

        {/* Country-wise Breakdown */}
        <div style={{marginBottom: 32}}>
          <h3 style={{fontSize: 20, fontWeight: 800, marginBottom: 16, color: '#111'}}>🌍 Country-wise Breakdown</h3>
          <div style={{display: 'grid', gap: 16}}>
            {COUNTRIES.map(country => {
              const data = byCountry[country.code]
              if (!data) return null
              
              const profit = data.profit || 0
              const isProfit = profit >= 0
              const currency = data.currency || country.currency

              return (
                <div key={country.code} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 16,
                  background: '#f9fafb'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <span style={{fontSize: 24}}>{country.flag}</span>
                      <div>
                        <div style={{fontWeight: 800, fontSize: 16, color: '#111'}}>{country.name}</div>
                        <div style={{fontSize: 12, color: '#6b7280'}}>Currency: {currency}</div>
                      </div>
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <div style={{fontSize: 12, fontWeight: 600, color: '#6b7280'}}>
                        {isProfit ? 'PROFIT' : 'LOSS'}
                      </div>
                      <div style={{fontSize: 24, fontWeight: 900, color: isProfit ? '#10b981' : '#ef4444'}}>
                        {isProfit ? '+' : '-'} {currency} {fmtNum(Math.abs(profit))}
                      </div>
                    </div>
                  </div>

                  <table style={{width: '100%', fontSize: 13, borderCollapse: 'collapse'}}>
                    <tbody>
                      <ReportRow label="Revenue (Delivered)" value={`${currency} ${fmtNum(data.revenue || 0)}`} color="#0ea5e9" />
                      <ReportRow label="Purchase Cost" value={`${currency} ${fmtNum(data.purchaseCost || 0)}`} color="#8b5cf6" />
                      <ReportRow label="Driver Commission" value={`${currency} ${fmtNum(data.driverCommission || 0)}`} color="#f59e0b" />
                      <ReportRow label="Agent Commission" value={`${currency} ${fmtNum(data.agentCommission || 0)}`} color="#f59e0b" />
                      <ReportRow label="Investor Commission" value={`${currency} ${fmtNum(data.investorCommission || 0)}`} color="#f59e0b" />
                      <ReportRow label="Advertisement Expense" value={`${currency} ${fmtNum(data.advertisementExpense || 0)}`} color="#ef4444" />
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{borderTop: '2px solid #e5e7eb', paddingTop: 16, textAlign: 'center', color: '#6b7280', fontSize: 12}}>
          <p style={{margin: 0}}>This report includes all revenue, expenses, commissions, and advertisement costs</p>
          <p style={{margin: '4px 0 0 0'}}>All amounts are calculated from delivered orders only</p>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div>
      <div style={{fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4}}>{label}</div>
      <div style={{fontSize: 16, fontWeight: 800, color}}>{value}</div>
    </div>
  )
}

function ReportRow({ label, value, color }) {
  return (
    <tr style={{borderBottom: '1px solid #e5e7eb'}}>
      <td style={{padding: '8px 0', color: '#374151', fontWeight: 600}}>{label}</td>
      <td style={{padding: '8px 0', textAlign: 'right', color, fontWeight: 700}}>{value}</td>
    </tr>
  )
}

function fmtNum(n){ 
  const v = Number(n||0)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
