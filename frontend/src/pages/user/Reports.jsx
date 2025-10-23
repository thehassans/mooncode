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
  { id: 4, name: 'Annual Report', description: 'Premium prestige layout' },
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
            style={{height: 60, width: 'auto', objectFit: 'contain'}}
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

// Template 2: Modern Executive
function Template2(props) { return <Template1 {...props} /> }

// Template 3: Financial Statement  
function Template3(props) { return <Template1 {...props} /> }

// Template 4: Annual Report
function Template4(props) { return <Template1 {...props} /> }

// Template 5: Minimal Professional
function Template5(props) { return <Template1 {...props} /> }

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
