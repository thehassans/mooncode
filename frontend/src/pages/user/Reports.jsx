import React, { useEffect, useRef, useState } from 'react'
import { apiGet } from '../../api'

const COUNTRIES = [
  { code: 'KSA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'UAE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'Oman', name: 'Oman', currency: 'OMR' },
  { code: 'Bahrain', name: 'Bahrain', currency: 'BHD' },
  { code: 'India', name: 'India', currency: 'INR' },
  { code: 'Kuwait', name: 'Kuwait', currency: 'KWD' },
  { code: 'Qatar', name: 'Qatar', currency: 'QAR' },
]

const REPORT_TEMPLATES = [
  { id: 1, name: 'Classic Corporate', description: 'Traditional formal business report' },
  { id: 2, name: 'Modern Executive', description: 'Clean contemporary design' },
  { id: 3, name: 'Financial Statement', description: 'Data-focused spreadsheet style' },
  { id: 4, name: 'Monthly Report', description: 'Premium prestige layout' },
  { id: 5, name: 'Minimal Professional', description: 'Sleek minimalist design' }
]

export default function Reports(){
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState(1)
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
      
      const templateName = REPORT_TEMPLATES.find(t => t.id === selectedTemplate)?.name.replace(/\s+/g, '-') || 'Report'
      const filename = selectedCountry === 'all' 
        ? `Buysial-${templateName}-${new Date().toISOString().split('T')[0]}.pdf`
        : `Buysial-${selectedCountry}-${templateName}-${new Date().toISOString().split('T')[0]}.pdf`
      
      pdf.save(filename)
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

  // Filter countries based on selection
  const filteredCountries = selectedCountry === 'all' 
    ? COUNTRIES 
    : COUNTRIES.filter(c => c.code === selectedCountry)

  return (
    <div style={{maxWidth: 1400, margin: '0 auto'}}>
      {/* Header with Controls */}
      <div style={{marginBottom: 24}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20}}>
          <div>
            <h1 style={{fontSize:28, fontWeight:700, margin:0, color:'#111'}}>Business Financial Report</h1>
            <p style={{fontSize:14, color:'#6b7280', margin:'4px 0 0 0'}}>Comprehensive financial overview and analysis</p>
          </div>
          <div style={{display: 'flex', gap: 12, alignItems:'center', flexWrap:'wrap'}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <label style={{fontSize:14, fontWeight:600, color:'#374151'}}>Country:</label>
              <select 
                className="input" 
                value={selectedCountry} 
                onChange={(e) => setSelectedCountry(e.target.value)}
                style={{minWidth:160, padding:'8px 12px', fontSize:14}}
              >
                <option value="all">All Countries</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <button className="btn secondary" onClick={loadMetrics} disabled={loading} style={{padding:'8px 16px'}}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button 
              className="btn" 
              onClick={downloadPDF}
              disabled={generating}
              style={{
                background: '#1e40af',
                border: 'none',
                padding: '8px 20px',
                fontWeight: 600,
                color:'#fff'
              }}
            >
              {generating ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Template Selector */}
        <div style={{background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16}}>
          <div style={{fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111'}}>Report Design Template:</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12}}>
            {REPORT_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                style={{
                  padding: '12px 16px',
                  border: selectedTemplate === template.id ? '2px solid #1e40af' : '2px solid #e5e7eb',
                  borderRadius: 8,
                  background: selectedTemplate === template.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{fontSize: 14, fontWeight: 600, color: selectedTemplate === template.id ? '#1e40af' : '#111', marginBottom: 4}}>
                  {template.name}
                </div>
                <div style={{fontSize: 12, color: '#6b7280'}}>
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} style={{background: '#fff', padding: 40, borderRadius: 12, boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
        {selectedTemplate === 1 && <Template1 logo="/BuySial2.png" selectedCountry={selectedCountry} profitLoss={profitLoss} byCountry={byCountry} filteredCountries={filteredCountries} globalProfit={globalProfit} globalRevenue={globalRevenue} globalPurchaseCost={globalPurchaseCost} globalDriverComm={globalDriverComm} globalAgentComm={globalAgentComm} globalInvestorComm={globalInvestorComm} globalAdExpense={globalAdExpense} />}
        {selectedTemplate === 2 && <Template2 logo="/BuySial2.png" selectedCountry={selectedCountry} profitLoss={profitLoss} byCountry={byCountry} filteredCountries={filteredCountries} globalProfit={globalProfit} globalRevenue={globalRevenue} globalPurchaseCost={globalPurchaseCost} globalDriverComm={globalDriverComm} globalAgentComm={globalAgentComm} globalInvestorComm={globalInvestorComm} globalAdExpense={globalAdExpense} />}
        {selectedTemplate === 3 && <Template3 logo="/BuySial2.png" selectedCountry={selectedCountry} profitLoss={profitLoss} byCountry={byCountry} filteredCountries={filteredCountries} globalProfit={globalProfit} globalRevenue={globalRevenue} globalPurchaseCost={globalPurchaseCost} globalDriverComm={globalDriverComm} globalAgentComm={globalAgentComm} globalInvestorComm={globalInvestorComm} globalAdExpense={globalAdExpense} />}
        {selectedTemplate === 4 && <Template4 logo="/BuySial2.png" selectedCountry={selectedCountry} profitLoss={profitLoss} byCountry={byCountry} filteredCountries={filteredCountries} globalProfit={globalProfit} globalRevenue={globalRevenue} globalPurchaseCost={globalPurchaseCost} globalDriverComm={globalDriverComm} globalAgentComm={globalAgentComm} globalInvestorComm={globalInvestorComm} globalAdExpense={globalAdExpense} />}
        {selectedTemplate === 5 && <Template5 logo="/BuySial2.png" selectedCountry={selectedCountry} profitLoss={profitLoss} byCountry={byCountry} filteredCountries={filteredCountries} globalProfit={globalProfit} globalRevenue={globalRevenue} globalPurchaseCost={globalPurchaseCost} globalDriverComm={globalDriverComm} globalAgentComm={globalAgentComm} globalInvestorComm={globalInvestorComm} globalAdExpense={globalAdExpense} />}
      </div>
    </div>
  )
}

// Template 1: Classic Corporate
function Template1({ logo, selectedCountry, byCountry, filteredCountries, globalProfit, globalRevenue, globalPurchaseCost, globalDriverComm, globalAgentComm, globalInvestorComm, globalAdExpense }) {
  return (
    <>
      {/* Report Header with Logo */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', borderBottom: '3px solid #1e40af', paddingBottom: 20, marginBottom: 32}}>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <img 
            src={logo}
            alt="Logo" 
            style={{height: 120, width: 'auto', objectFit: 'contain'}}
            onError={(e) => { e.target.style.display = 'none' }}
          />
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize: 12, color: '#6b7280', fontWeight: 500, letterSpacing: '0.5px', marginBottom: 8}}>
            BUSINESS REPORT
          </div>
          <div style={{fontSize: 11, color: '#6b7280', marginBottom: 2}}>Report Date</div>
          <div style={{fontSize: 14, fontWeight: 700, color: '#111'}}>
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div style={{fontSize: 11, color: '#6b7280', marginTop: 8}}>
            {selectedCountry === 'all' ? 'Global Report' : `${COUNTRIES.find(c => c.code === selectedCountry)?.name} Report`}
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      {selectedCountry === 'all' && (
      <div style={{marginBottom: 32}}>
        <h3 style={{fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb', paddingBottom: 8}}>Executive Summary</h3>
        <div style={{border: '2px solid ' + (globalProfit >= 0 ? '#10b981' : '#ef4444'), borderRadius: 12, padding: 20, background: globalProfit >= 0 ? '#10b98110' : '#ef444410'}}>
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
          <table style={{width: '100%', fontSize: 13, marginTop: 16, borderCollapse: 'collapse'}}>
            <tbody>
              <ReportRow label="Total Revenue" value={`AED ${fmtNum(globalRevenue)}`} color="#0ea5e9" bold />
              <ReportRow label="Purchase Cost" value={`AED ${fmtNum(globalPurchaseCost)}`} color="#374151" indent />
              <ReportRow label="Driver Commission" value={`AED ${fmtNum(globalDriverComm)}`} color="#374151" indent />
              <ReportRow label="Agent Commission" value={`AED ${fmtNum(globalAgentComm)}`} color="#374151" indent />
              <ReportRow label="Investor Commission" value={`AED ${fmtNum(globalInvestorComm)}`} color="#374151" indent />
              <ReportRow label="Advertisement Expense" value={`AED ${fmtNum(globalAdExpense)}`} color="#374151" indent />
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Country-wise Breakdown */}
      <div style={{marginBottom: 32}}>
        <h3 style={{fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb', paddingBottom: 8}}>
          {selectedCountry === 'all' ? 'Regional Performance Analysis' : 'Country Performance'}
        </h3>
        <div style={{display: 'grid', gap: 20}}>
          {filteredCountries.map(country => {
            const data = byCountry[country.code]
            if (!data) return null
            const profit = data.profit || 0
            const isProfit = profit >= 0
            const currency = data.currency || country.currency
            return (
              <div key={country.code} style={{border: '2px solid #e5e7eb', borderRadius: 8, padding: 20, background: '#fafafa', pageBreakInside: 'avoid'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb'}}>
                  <div>
                    <div style={{fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 2}}>{country.name}</div>
                    <div style={{fontSize: 11, color: '#6b7280', fontWeight: 500}}>Reporting Currency: {currency}</div>
                  </div>
                  <div style={{textAlign: 'right', padding: '8px 16px', background: isProfit ? '#10b98115' : '#ef444415', borderRadius: 6}}>
                    <div style={{fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 2}}>NET {isProfit ? 'PROFIT' : 'LOSS'}</div>
                    <div style={{fontSize: 20, fontWeight: 900, color: isProfit ? '#10b981' : '#ef4444'}}>{isProfit ? '+' : ''} {currency} {fmtNum(profit)}</div>
                  </div>
                </div>
                <table style={{width: '100%', fontSize: 13, borderCollapse: 'collapse'}}>
                  <tbody>
                    <ReportRow label="Revenue (Delivered Orders)" value={`${currency} ${fmtNum(data.revenue || 0)}`} color="#0ea5e9" bold />
                    <ReportRow label="Purchase Cost" value={`${currency} ${fmtNum(data.purchaseCost || 0)}`} color="#374151" indent />
                    <ReportRow label="Driver Commission" value={`${currency} ${fmtNum(data.driverCommission || 0)}`} color="#374151" indent />
                    <ReportRow label="Agent Commission" value={`${currency} ${fmtNum(data.agentCommission || 0)}`} color="#374151" indent />
                    <ReportRow label="Investor Commission" value={`${currency} ${fmtNum(data.investorCommission || 0)}`} color="#374151" indent />
                    <ReportRow label="Advertisement Expense" value={`${currency} ${fmtNum(data.advertisementExpense || 0)}`} color="#374151" indent />
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{borderTop: '3px solid #1e40af', paddingTop: 24, marginTop: 40}}>
        <div style={{background: 'linear-gradient(to bottom, #f8fafc, #ffffff)', border: '2px solid #1e40af', borderRadius: 8, padding: 28, marginBottom: 20, boxShadow: '0 2px 8px rgba(30, 64, 175, 0.08)'}}>
          <div style={{borderTop: '1px solid #e5e7eb', paddingTop: 16, textAlign: 'center'}}>
            <div style={{fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4}}>Qadeer Hussain, Owner of Buysial</div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
        <div style={{textAlign:'center', fontSize: 11, color: '#6b7280'}}>
          <div>Financial Business Intelligence</div>
          <div style={{marginTop: 4}}>© {new Date().getFullYear()} All Rights Reserved</div>
        </div>
      </div>
    </>
  )
}

// Template 2: Modern Executive - Clean contemporary design
function Template2({ logo, selectedCountry, byCountry, filteredCountries, globalProfit, globalRevenue, globalPurchaseCost, globalDriverComm, globalAgentComm, globalInvestorComm, globalAdExpense }) {
  return (
    <>
      {/* Modern Header */}
      <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 30, borderRadius: 12, marginBottom: 32}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{background: '#fff', padding: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center'}}>
            <img src={logo} alt="Logo" style={{height: 100}} onError={(e) => { e.target.style.display = 'none' }} />
          </div>
          <div style={{textAlign:'right', color:'#fff'}}>
            <div style={{fontSize: 14, fontWeight: 600, marginBottom: 8}}>BUSINESS REPORT</div>
            <div style={{fontSize: 12, opacity: 0.9}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div style={{fontSize: 11, opacity: 0.8, marginTop: 4}}>{selectedCountry === 'all' ? 'Global' : COUNTRIES.find(c => c.code === selectedCountry)?.name}</div>
          </div>
        </div>
      </div>

      {/* Executive Summary Card */}
      {selectedCountry === 'all' && (
      <div style={{marginBottom: 32}}>
        <div style={{background: globalProfit >= 0 ? '#10b981' : '#ef4444', color: '#fff', padding: 24, borderRadius: 12, marginBottom: 20}}>
          <div style={{fontSize: 13, opacity: 0.9, marginBottom: 8}}>NET {globalProfit >= 0 ? 'PROFIT' : 'LOSS'}</div>
          <div style={{fontSize: 42, fontWeight: 900}}>{globalProfit >= 0 ? '+' : ''} AED {fmtNum(Math.abs(globalProfit))}</div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16}}>
          <div style={{background: '#f0f9ff', padding: 16, borderRadius: 8, border: '1px solid #e0f2fe'}}>
            <div style={{fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 4}}>REVENUE</div>
            <div style={{fontSize: 20, fontWeight: 800, color: '#0c4a6e'}}>AED {fmtNum(globalRevenue)}</div>
          </div>
          <div style={{background: '#fef3c7', padding: 16, borderRadius: 8, border: '1px solid #fde68a'}}>
            <div style={{fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 4}}>COSTS</div>
            <div style={{fontSize: 20, fontWeight: 800, color: '#78350f'}}>AED {fmtNum(globalPurchaseCost + globalDriverComm + globalAgentComm + globalInvestorComm)}</div>
          </div>
          <div style={{background: '#fee2e2', padding: 16, borderRadius: 8, border: '1px solid #fecaca'}}>
            <div style={{fontSize: 11, color: '#991b1b', fontWeight: 600, marginBottom: 4}}>AD EXPENSE</div>
            <div style={{fontSize: 20, fontWeight: 800, color: '#7f1d1d'}}>AED {fmtNum(globalAdExpense)}</div>
          </div>
        </div>
      </div>
      )}

      {/* Countries */}
      <div style={{display: 'grid', gap: 16}}>
        {filteredCountries.map(country => {
          const data = byCountry[country.code]
          if (!data) return null
          const profit = data.profit || 0
          const isProfit = profit >= 0
          const currency = data.currency || country.currency
          return (
            <div key={country.code} style={{background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 16}}>
                <div style={{fontSize: 18, fontWeight: 700, color: '#111'}}>{country.name}</div>
                <div style={{fontSize: 24, fontWeight: 900, color: isProfit ? '#10b981' : '#ef4444'}}>{isProfit ? '+' : ''}{currency} {fmtNum(profit)}</div>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13}}>
                <div><span style={{color: '#6b7280'}}>Revenue:</span> <span style={{fontWeight: 700, color: '#111'}}>{currency} {fmtNum(data.revenue || 0)}</span></div>
                <div><span style={{color: '#6b7280'}}>Purchase:</span> <span style={{fontWeight: 700, color: '#111'}}>{currency} {fmtNum(data.purchaseCost || 0)}</span></div>
                <div><span style={{color: '#6b7280'}}>Driver:</span> <span style={{fontWeight: 700, color: '#111'}}>{currency} {fmtNum(data.driverCommission || 0)}</span></div>
                <div><span style={{color: '#6b7280'}}>Agent:</span> <span style={{fontWeight: 700, color: '#111'}}>{currency} {fmtNum(data.agentCommission || 0)}</span></div>
                <div><span style={{color: '#6b7280'}}>Investor:</span> <span style={{fontWeight: 700, color: '#111'}}>{currency} {fmtNum(data.investorCommission || 0)}</span></div>
                <div><span style={{color: '#6b7280'}}>Ads:</span> <span style={{fontWeight: 700, color: '#111'}}>{currency} {fmtNum(data.advertisementExpense || 0)}</span></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{marginTop: 40, paddingTop: 20, borderTop: '2px solid #e5e7eb', textAlign: 'center'}}>
        <div style={{fontSize: 16, fontWeight: 800, color: '#111'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, color: '#6b7280', marginTop: 4}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style={{fontSize: 11, color: '#9ca3af', marginTop: 12}}>© {new Date().getFullYear()} Financial Business Intelligence</div>
      </div>
    </>
  )
}

// Template 3: Financial Statement - Spreadsheet style
function Template3({ logo, selectedCountry, byCountry, filteredCountries, globalProfit, globalRevenue, globalPurchaseCost, globalDriverComm, globalAgentComm, globalInvestorComm, globalAdExpense }) {
  return (
    <>
      {/* Header */}
      <div style={{borderBottom: '4px double #000', paddingBottom: 16, marginBottom: 24}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <img src={logo} alt="Logo" style={{height: 120}} onError={(e) => { e.target.style.display = 'none' }} />
          <div style={{textAlign:'right'}}>
            <div style={{fontSize: 16, fontWeight: 700, color: '#000'}}>FINANCIAL STATEMENT</div>
            <div style={{fontSize: 12, marginTop: 4, color: '#000'}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      {selectedCountry === 'all' && (
      <table style={{width: '100%', marginBottom: 32, borderCollapse: 'collapse', border: '2px solid #000'}}>
        <thead>
          <tr style={{background: '#f3f4f6'}}>
            <th style={{padding: 12, textAlign: 'left', border: '1px solid #000', fontWeight: 700, color: '#000'}}>ITEM</th>
            <th style={{padding: 12, textAlign: 'right', border: '1px solid #000', fontWeight: 700, color: '#000'}}>AMOUNT (AED)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{padding: 12, border: '1px solid #000', color: '#000'}}>Revenue</td><td style={{padding: 12, textAlign: 'right', border: '1px solid #000', fontWeight: 600, color: '#000'}}>{fmtNum(globalRevenue)}</td></tr>
          <tr style={{background: '#fafafa'}}><td style={{padding: 12, border: '1px solid #000', color: '#000'}}>Purchase Cost</td><td style={{padding: 12, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(globalPurchaseCost)})</td></tr>
          <tr><td style={{padding: 12, border: '1px solid #000', color: '#000'}}>Driver Commission</td><td style={{padding: 12, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(globalDriverComm)})</td></tr>
          <tr style={{background: '#fafafa'}}><td style={{padding: 12, border: '1px solid #000', color: '#000'}}>Agent Commission</td><td style={{padding: 12, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(globalAgentComm)})</td></tr>
          <tr><td style={{padding: 12, border: '1px solid #000', color: '#000'}}>Investor Commission</td><td style={{padding: 12, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(globalInvestorComm)})</td></tr>
          <tr style={{background: '#fafafa'}}><td style={{padding: 12, border: '1px solid #000', color: '#000'}}>Advertisement Expense</td><td style={{padding: 12, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(globalAdExpense)})</td></tr>
          <tr style={{background: globalProfit >= 0 ? '#dcfce7' : '#fee2e2', borderTop: '2px solid #000'}}>
            <td style={{padding: 12, border: '1px solid #000', fontWeight: 700, color: '#000'}}>NET {globalProfit >= 0 ? 'PROFIT' : 'LOSS'}</td>
            <td style={{padding: 12, textAlign: 'right', border: '1px solid #000', fontWeight: 800, color: globalProfit >= 0 ? '#166534' : '#991b1b'}}>{fmtNum(Math.abs(globalProfit))}</td>
          </tr>
        </tbody>
      </table>
      )}

      {/* Country Tables */}
      {filteredCountries.map(country => {
        const data = byCountry[country.code]
        if (!data) return null
        const profit = data.profit || 0
        const currency = data.currency || country.currency
        return (
          <table key={country.code} style={{width: '100%', marginBottom: 24, borderCollapse: 'collapse', border: '2px solid #000'}}>
            <thead>
              <tr style={{background: '#111', color: '#fff'}}>
                <th colSpan={2} style={{padding: 12, textAlign: 'left', fontWeight: 700}}>{country.name} ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Revenue</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', fontWeight: 600, color: '#000'}}>{fmtNum(data.revenue || 0)}</td></tr>
              <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Purchase Cost</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(data.purchaseCost || 0)})</td></tr>
              <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Driver Commission</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(data.driverCommission || 0)})</td></tr>
              <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Agent Commission</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(data.agentCommission || 0)})</td></tr>
              <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Investor Commission</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(data.investorCommission || 0)})</td></tr>
              <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Advertisement</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>({fmtNum(data.advertisementExpense || 0)})</td></tr>
              <tr style={{background: profit >= 0 ? '#dcfce7' : '#fee2e2', borderTop: '2px solid #000'}}>
                <td style={{padding: 10, border: '1px solid #000', fontWeight: 700, color: '#000'}}>Net {profit >= 0 ? 'Profit' : 'Loss'}</td>
                <td style={{padding: 10, textAlign: 'right', border: '1px solid #000', fontWeight: 800, color: '#000'}}>{fmtNum(Math.abs(profit))}</td>
              </tr>
            </tbody>
          </table>
        )
      })}

      {/* Footer */}
      <div style={{marginTop: 32, paddingTop: 16, borderTop: '4px double #000', textAlign: 'center'}}>
        <div style={{fontSize: 16, fontWeight: 800, color: '#000'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, marginTop: 4, color: '#000'}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </>
  )
}

// Template 4: Monthly Report - Premium prestige layout
function Template4({ logo, selectedCountry, byCountry, filteredCountries, globalProfit, globalRevenue, globalPurchaseCost, globalDriverComm, globalAgentComm, globalInvestorComm, globalAdExpense }) {
  return (
    <>
      {/* Luxury Header */}
      <div style={{textAlign: 'center', borderBottom: '3px solid #d97706', paddingBottom: 24, marginBottom: 32}}>
        <img src={logo} alt="Logo" style={{height: 120, marginBottom: 16}} onError={(e) => { e.target.style.display = 'none' }} />
        <div style={{fontSize: 28, fontWeight: 900, color: '#78350f', fontFamily: 'Georgia, serif', letterSpacing: '2px'}}>MONTHLY BUSINESS REPORT</div>
        <div style={{fontSize: 13, color: '#92400e', marginTop: 8, fontWeight: 600}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style={{fontSize: 12, color: '#a16207', marginTop: 4}}>{selectedCountry === 'all' ? 'Global Operations' : COUNTRIES.find(c => c.code === selectedCountry)?.name}</div>
      </div>

      {/* Premium Summary */}
      {selectedCountry === 'all' && (
      <div style={{marginBottom: 40}}>
        <div style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '2px solid #d97706', borderRadius: 16, padding: 32, textAlign: 'center', marginBottom: 24}}>
          <div style={{fontSize: 14, color: '#92400e', fontWeight: 600, marginBottom: 12, letterSpacing: '1px'}}>FINANCIAL PERFORMANCE</div>
          <div style={{fontSize: 48, fontWeight: 900, color: globalProfit >= 0 ? '#166534' : '#991b1b', marginBottom: 8}}>{globalProfit >= 0 ? '+' : ''} AED {fmtNum(Math.abs(globalProfit))}</div>
          <div style={{fontSize: 14, color: '#78350f', fontWeight: 600}}>{globalProfit >= 0 ? 'Net Profit' : 'Net Loss'}</div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20}}>
          <div style={{background: '#fffbeb', border: '1px solid #fde047', padding: 20, borderRadius: 12}}>
            <div style={{fontSize: 12, color: '#854d0e', fontWeight: 600, marginBottom: 8}}>Total Revenue</div>
            <div style={{fontSize: 24, fontWeight: 800, color: '#78350f'}}>AED {fmtNum(globalRevenue)}</div>
          </div>
          <div style={{background: '#fffbeb', border: '1px solid #fde047', padding: 20, borderRadius: 12}}>
            <div style={{fontSize: 12, color: '#854d0e', fontWeight: 600, marginBottom: 8}}>Total Expenses</div>
            <div style={{fontSize: 24, fontWeight: 800, color: '#78350f'}}>AED {fmtNum(globalPurchaseCost + globalDriverComm + globalAgentComm + globalInvestorComm + globalAdExpense)}</div>
          </div>
        </div>
      </div>
      )}

      {/* Country Sections */}
      {filteredCountries.map(country => {
        const data = byCountry[country.code]
        if (!data) return null
        const profit = data.profit || 0
        const isProfit = profit >= 0
        const currency = data.currency || country.currency
        return (
          <div key={country.code} style={{marginBottom: 32, pageBreakInside: 'avoid'}}>
            <div style={{background: '#78350f', color: '#fef3c7', padding: 16, borderRadius: '12px 12px 0 0', fontWeight: 700, fontSize: 18}}>{country.name}</div>
            <div style={{border: '2px solid #d97706', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 24, background: '#fffbeb'}}>
              <div style={{textAlign: 'center', marginBottom: 20}}>
                <div style={{fontSize: 11, color: '#92400e', marginBottom: 4}}>Net {isProfit ? 'Profit' : 'Loss'}</div>
                <div style={{fontSize: 32, fontWeight: 900, color: isProfit ? '#166534' : '#991b1b'}}>{isProfit ? '+' : ''} {currency} {fmtNum(profit)}</div>
              </div>
              <table style={{width: '100%', fontSize: 13}}>
                <tbody>
                  <tr><td style={{padding: '8px 0', color: '#78350f'}}>Revenue</td><td style={{textAlign: 'right', padding: '8px 0', fontWeight: 700, color: '#78350f'}}>{currency} {fmtNum(data.revenue || 0)}</td></tr>
                  <tr><td style={{padding: '8px 0', color: '#92400e'}}>Purchase Cost</td><td style={{textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#92400e'}}>{currency} {fmtNum(data.purchaseCost || 0)}</td></tr>
                  <tr><td style={{padding: '8px 0', color: '#92400e'}}>Driver Commission</td><td style={{textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#92400e'}}>{currency} {fmtNum(data.driverCommission || 0)}</td></tr>
                  <tr><td style={{padding: '8px 0', color: '#92400e'}}>Agent Commission</td><td style={{textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#92400e'}}>{currency} {fmtNum(data.agentCommission || 0)}</td></tr>
                  <tr><td style={{padding: '8px 0', color: '#92400e'}}>Investor Commission</td><td style={{textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#92400e'}}>{currency} {fmtNum(data.investorCommission || 0)}</td></tr>
                  <tr><td style={{padding: '8px 0', color: '#92400e'}}>Advertisement</td><td style={{textAlign: 'right', padding: '8px 0', fontWeight: 600, color: '#92400e'}}>{currency} {fmtNum(data.advertisementExpense || 0)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Signature */}
      <div style={{marginTop: 40, paddingTop: 24, borderTop: '3px solid #d97706', textAlign: 'center'}}>
        <div style={{fontSize: 18, fontWeight: 800, color: '#78350f', fontFamily: 'Georgia, serif'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, color: '#92400e', marginTop: 8}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style={{fontSize: 11, color: '#a16207', marginTop: 16}}>© {new Date().getFullYear()} Financial Business Intelligence · All Rights Reserved</div>
      </div>
    </>
  )
}

// Template 5: Minimal Professional - Sleek minimalist design
function Template5({ logo, selectedCountry, byCountry, filteredCountries, globalProfit, globalRevenue, globalPurchaseCost, globalDriverComm, globalAgentComm, globalInvestorComm, globalAdExpense }) {
  return (
    <>
      {/* Minimal Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom: 32, marginBottom: 40, borderBottom: '1px solid #000'}}>
        <img src={logo} alt="Logo" style={{height: 120}} onError={(e) => { e.target.style.display = 'none' }} />
        <div style={{textAlign:'right'}}>
          <div style={{fontSize: 11, color: '#6b7280', marginBottom: 4}}>Business Report</div>
          <div style={{fontSize: 13, fontWeight: 600, color: '#000'}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* Clean Summary */}
      {selectedCountry === 'all' && (
      <div style={{marginBottom: 48}}>
        <div style={{fontSize: 48, fontWeight: 300, color: globalProfit >= 0 ? '#000' : '#000', marginBottom: 8}}>{globalProfit >= 0 ? '+' : '−'} AED {fmtNum(Math.abs(globalProfit))}</div>
        <div style={{fontSize: 13, color: '#6b7280', marginBottom: 32}}>Net {globalProfit >= 0 ? 'Profit' : 'Loss'}</div>
        <div style={{borderTop: '1px solid #e5e7eb', paddingTop: 16}}>
          <div style={{display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px 32px', fontSize: 14}}>
            <div style={{color: '#6b7280'}}>Revenue</div><div style={{fontWeight: 600, textAlign: 'right'}}>AED {fmtNum(globalRevenue)}</div>
            <div style={{color: '#6b7280'}}>Purchase Cost</div><div style={{fontWeight: 600, textAlign: 'right'}}>AED {fmtNum(globalPurchaseCost)}</div>
            <div style={{color: '#6b7280'}}>Driver Commission</div><div style={{fontWeight: 600, textAlign: 'right'}}>AED {fmtNum(globalDriverComm)}</div>
            <div style={{color: '#6b7280'}}>Agent Commission</div><div style={{fontWeight: 600, textAlign: 'right'}}>AED {fmtNum(globalAgentComm)}</div>
            <div style={{color: '#6b7280'}}>Investor Commission</div><div style={{fontWeight: 600, textAlign: 'right'}}>AED {fmtNum(globalInvestorComm)}</div>
            <div style={{color: '#6b7280'}}>Advertisement</div><div style={{fontWeight: 600, textAlign: 'right'}}>AED {fmtNum(globalAdExpense)}</div>
          </div>
        </div>
      </div>
      )}

      {/* Minimal Countries */}
      {filteredCountries.map(country => {
        const data = byCountry[country.code]
        if (!data) return null
        const profit = data.profit || 0
        const currency = data.currency || country.currency
        return (
          <div key={country.code} style={{marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20}}>
              <div style={{fontSize: 20, fontWeight: 600, color: '#000'}}>{country.name}</div>
              <div style={{fontSize: 28, fontWeight: 300, color: '#000'}}>{profit >= 0 ? '+' : '−'} {currency} {fmtNum(Math.abs(profit))}</div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px 32px', fontSize: 13}}>
              <div style={{color: '#6b7280'}}>Revenue</div><div style={{fontWeight: 600, textAlign: 'right'}}>{currency} {fmtNum(data.revenue || 0)}</div>
              <div style={{color: '#6b7280'}}>Purchase Cost</div><div style={{fontWeight: 600, textAlign: 'right'}}>{currency} {fmtNum(data.purchaseCost || 0)}</div>
              <div style={{color: '#6b7280'}}>Driver Commission</div><div style={{fontWeight: 600, textAlign: 'right'}}>{currency} {fmtNum(data.driverCommission || 0)}</div>
              <div style={{color: '#6b7280'}}>Agent Commission</div><div style={{fontWeight: 600, textAlign: 'right'}}>{currency} {fmtNum(data.agentCommission || 0)}</div>
              <div style={{color: '#6b7280'}}>Investor Commission</div><div style={{fontWeight: 600, textAlign: 'right'}}>{currency} {fmtNum(data.investorCommission || 0)}</div>
              <div style={{color: '#6b7280'}}>Advertisement</div><div style={{fontWeight: 600, textAlign: 'right'}}>{currency} {fmtNum(data.advertisementExpense || 0)}</div>
            </div>
          </div>
        )
      })}

      {/* Minimal Footer */}
      <div style={{marginTop: 48, paddingTop: 24, borderTop: '1px solid #000'}}>
        <div style={{fontSize: 14, fontWeight: 600, color: '#000'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, color: '#6b7280', marginTop: 8}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </>
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

function ReportRow({ label, value, color, bold, indent }) {
  return (
    <tr style={{borderBottom: '1px solid #e5e7eb'}}>
      <td style={{
        padding: '10px 0', 
        paddingLeft: indent ? '16px' : '0',
        color: bold ? '#111' : '#374151', 
        fontWeight: bold ? 700 : 600,
        fontSize: bold ? '14px' : '13px'
      }}>
        {label}
      </td>
      <td style={{
        padding: '10px 0', 
        textAlign: 'right', 
        color: bold ? color : '#374151', 
        fontWeight: bold ? 800 : 600,
        fontSize: bold ? '14px' : '13px'
      }}>
        {value}
      </td>
    </tr>
  )
}

function fmtNum(n){ 
  const v = Number(n||0)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
