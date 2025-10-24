import React, { useState, useEffect, useRef, useMemo } from 'react'
import { apiGet } from '../../api'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const COUNTRIES = [
  { code: 'KSA', name: 'Saudi Arabia' },
  { code: 'UAE', name: 'United Arab Emirates' },
  { code: 'Oman', name: 'Oman' },
  { code: 'Bahrain', name: 'Bahrain' },
  { code: 'India', name: 'India' },
  { code: 'Kuwait', name: 'Kuwait' },
  { code: 'Qatar', name: 'Qatar' },
]

const REPORT_TEMPLATES = [
  { id: 1, name: 'Classic Corporate', description: 'Traditional formal driver report' },
  { id: 2, name: 'Modern Executive', description: 'Clean contemporary design' },
  { id: 3, name: 'Financial Statement', description: 'Data-focused spreadsheet style' },
  { id: 4, name: 'Monthly Report', description: 'Premium prestige layout' },
  { id: 5, name: 'Minimal Professional', description: 'Sleek minimalist design' }
]

export default function DriverReports(){
  const [loading, setLoading] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [generating, setGenerating] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [selectedDriver, setSelectedDriver] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState(1)
  const reportRef = useRef(null)

  async function loadDrivers(){
    setLoading(true)
    try{
      const res = await apiGet('/api/reports/driver-metrics')
      setDrivers(res.drivers || [])
    }catch(err){
      console.error('Failed to load driver data', err)
    }finally{
      setLoading(false)
    }
  }
  
  useEffect(()=>{ loadDrivers() }, [])

  async function downloadPDF(){
    if(!reportRef.current) return
    setGenerating(true)
    try{
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true })
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
      const driverPart = selectedDriver === 'all' ? 'All-Drivers' : selectedDriver.replace(/\s+/g, '-')
      const filename = `Driver-${templateName}-${driverPart}-${new Date().toISOString().split('T')[0]}.pdf`
      
      pdf.save(filename)
    } catch (err) {
      console.error('Failed to generate PDF', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const filteredDrivers = useMemo(() => {
    let filtered = drivers
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(d => d.country === selectedCountry)
    }
    if (selectedDriver !== 'all') {
      filtered = filtered.filter(d => d.name === selectedDriver)
    }
    return filtered
  }, [drivers, selectedCountry, selectedDriver])

  if(loading && drivers.length === 0){
    return <div style={{textAlign:'center', padding:40}}>Loading driver data...</div>
  }

  return (
    <div style={{maxWidth: 1400, margin: '0 auto'}}>
      {/* Header with Controls */}
      <div style={{marginBottom: 24}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20}}>
          <div>
            <h1 style={{fontSize:28, fontWeight:700, margin:0, color:'#111'}}>Driver Performance Report</h1>
            <p style={{fontSize:14, color:'#6b7280', margin:'4px 0 0 0'}}>Comprehensive driver analytics and settlements</p>
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
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <label style={{fontSize:14, fontWeight:600, color:'#374151'}}>Driver:</label>
              <select 
                className="input" 
                value={selectedDriver} 
                onChange={(e) => setSelectedDriver(e.target.value)}
                style={{minWidth:200, padding:'8px 12px', fontSize:14}}
              >
                <option value="all">All Drivers ({drivers.length})</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.name}>{d.name} - {d.city}</option>
                ))}
              </select>
            </div>
            {selectedDriver !== 'all' && (
              <button 
                onClick={() => setSelectedDriver('all')}
                style={{
                  padding: '8px 12px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear Filter ✕
              </button>
            )}
            <button className="btn secondary" onClick={loadDrivers} disabled={loading} style={{padding:'8px 16px'}}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button 
              className="btn" 
              onClick={downloadPDF}
              disabled={generating}
              style={{background: '#1e40af', border: 'none', padding: '8px 20px', fontWeight: 600, color:'#fff'}}
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
        {selectedTemplate === 1 && <Template1 logo="/BuySial2.png" selectedCountry={selectedCountry} selectedDriver={selectedDriver} drivers={filteredDrivers} />}
        {selectedTemplate === 2 && <Template2 logo="/BuySial2.png" selectedCountry={selectedCountry} selectedDriver={selectedDriver} drivers={filteredDrivers} />}
        {selectedTemplate === 3 && <Template3 logo="/BuySial2.png" selectedCountry={selectedCountry} selectedDriver={selectedDriver} drivers={filteredDrivers} />}
        {selectedTemplate === 4 && <Template4 logo="/BuySial2.png" selectedCountry={selectedCountry} selectedDriver={selectedDriver} drivers={filteredDrivers} />}
        {selectedTemplate === 5 && <Template5 logo="/BuySial2.png" selectedCountry={selectedCountry} selectedDriver={selectedDriver} drivers={filteredDrivers} />}
      </div>
    </div>
  )
}

// Template 1: Classic Corporate
function Template1({ logo, selectedCountry, selectedDriver, drivers }) {
  return (
    <>
      {/* Report Header */}
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
            DRIVER PERFORMANCE REPORT
          </div>
          <div style={{fontSize: 11, color: '#6b7280', marginBottom: 2}}>Report Date</div>
          <div style={{fontSize: 14, fontWeight: 700, color: '#111'}}>
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div style={{fontSize: 11, color: '#6b7280', marginTop: 8}}>
            {selectedCountry === 'all' ? 'All Countries' : COUNTRIES.find(c => c.code === selectedCountry)?.name}
          </div>
          {selectedDriver !== 'all' && (
            <div style={{fontSize: 11, color: '#1e40af', marginTop: 4, fontWeight: 600}}>
              Driver: {selectedDriver}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {selectedDriver === 'all' && (
        <div style={{marginBottom: 32}}>
          <h3 style={{fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb', paddingBottom: 8}}>
            Overview Summary
          </h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16}}>
            <StatCard label="Total Drivers" value={drivers.length} color="#1e40af" />
            <StatCard label="Total Delivered" value={drivers.reduce((sum, d) => sum + (d.ordersDelivered || 0), 0)} color="#10b981" />
            <StatCard label="Total Assigned" value={drivers.reduce((sum, d) => sum + (d.ordersAssigned || 0), 0)} color="#f59e0b" />
            <StatCard label="Total Pending" value={drivers.reduce((sum, d) => sum + (d.pendingSettlement || 0), 0)} color="#ef4444" />
          </div>
        </div>
      )}

      {/* Driver Details */}
      <div style={{marginBottom: 32}}>
        <h3 style={{fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb', paddingBottom: 8}}>
          Driver Performance Details
        </h3>
        <div style={{display: 'grid', gap: 20}}>
          {drivers.map(driver => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
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
          <div>Driver Management & Analytics</div>
          <div style={{marginTop: 4}}>© {new Date().getFullYear()} All Rights Reserved</div>
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16}}>
      <div style={{fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8}}>{label}</div>
      <div style={{fontSize: 24, fontWeight: 800, color}}>{value}</div>
    </div>
  )
}

function DriverCard({ driver }) {
  return (
    <div style={{border: '2px solid #e5e7eb', borderRadius: 8, padding: 20, background: '#fafafa', pageBreakInside: 'avoid'}}>
      {/* Driver Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb'}}>
        <div>
          <div style={{fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4}}>{driver.name}</div>
          <div style={{fontSize: 13, color: '#6b7280', marginBottom: 2}}>📱 {driver.phone}</div>
          <div style={{fontSize: 13, color: '#6b7280'}}>📍 {driver.city}, {driver.country}</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: 11, color: '#6b7280', marginBottom: 2}}>Driver ID</div>
          <div style={{fontSize: 14, fontWeight: 600, color: '#111'}}>{driver.id}</div>
        </div>
      </div>

      {/* Orders Section */}
      <div style={{marginBottom: 16}}>
        <div style={{fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12}}>📦 Order Statistics</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
          <div style={{background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e5e7eb'}}>
            <div style={{fontSize: 11, color: '#6b7280', marginBottom: 4}}>Delivered</div>
            <div style={{fontSize: 20, fontWeight: 700, color: '#10b981'}}>{driver.ordersDelivered || 0}</div>
          </div>
          <div style={{background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e5e7eb'}}>
            <div style={{fontSize: 11, color: '#6b7280', marginBottom: 4}}>Assigned</div>
            <div style={{fontSize: 20, fontWeight: 700, color: '#f59e0b'}}>{driver.ordersAssigned || 0}</div>
          </div>
          <div style={{background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e5e7eb'}}>
            <div style={{fontSize: 11, color: '#6b7280', marginBottom: 4}}>Pending</div>
            <div style={{fontSize: 20, fontWeight: 700, color: '#ef4444'}}>{driver.ordersPending || 0}</div>
          </div>
        </div>
      </div>

      {/* Financial Section */}
      <div style={{marginBottom: 16}}>
        <div style={{fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12}}>💰 Financial Details</div>
        <table style={{width: '100%', fontSize: 13, borderCollapse: 'collapse'}}>
          <tbody>
            <tr style={{borderBottom: '1px solid #e5e7eb'}}>
              <td style={{padding: '10px 0', color: '#374151', fontWeight: 600}}>Settlement Amount</td>
              <td style={{padding: '10px 0', textAlign: 'right', color: '#111', fontWeight: 700}}>{driver.currency || 'AED'} {fmtNum(driver.settlementAmount || 0)}</td>
            </tr>
            <tr style={{borderBottom: '1px solid #e5e7eb'}}>
              <td style={{padding: '10px 0', color: '#374151', fontWeight: 600}}>Pay to Company</td>
              <td style={{padding: '10px 0', textAlign: 'right', color: '#10b981', fontWeight: 700}}>{driver.currency || 'AED'} {fmtNum(driver.payToCompany || 0)}</td>
            </tr>
            <tr style={{borderBottom: '1px solid #e5e7eb'}}>
              <td style={{padding: '10px 0', color: '#374151', fontWeight: 600}}>Pay to Manager</td>
              <td style={{padding: '10px 0', textAlign: 'right', color: '#f59e0b', fontWeight: 700}}>{driver.currency || 'AED'} {fmtNum(driver.payToManager || 0)}</td>
            </tr>
            <tr style={{borderBottom: '1px solid #e5e7eb'}}>
              <td style={{padding: '10px 0', color: '#374151', fontWeight: 600}}>Pending Settlement</td>
              <td style={{padding: '10px 0', textAlign: 'right', color: '#ef4444', fontWeight: 700}}>{driver.currency || 'AED'} {fmtNum(driver.pendingSettlement || 0)}</td>
            </tr>
            <tr style={{borderBottom: '1px solid #e5e7eb'}}>
              <td style={{padding: '10px 0', color: '#374151', fontWeight: 600}}>Total Commission</td>
              <td style={{padding: '10px 0', textAlign: 'right', color: '#8b5cf6', fontWeight: 700}}>
                {driver.commissionPerOrder != null && driver.commissionPerOrder > 0 
                  ? `${driver.commissionCurrency || driver.currency || 'AED'} ${fmtNum(driver.commissionPerOrder * (driver.ordersDelivered || 0))} (${fmtNum(driver.commissionPerOrder)}/order × ${driver.ordersDelivered || 0})` 
                  : 'Not set'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Manager Section */}
      {driver.manager && (
        <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 12}}>
          <div style={{fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 4}}>👤 Manager</div>
          <div style={{fontSize: 14, fontWeight: 700, color: '#111'}}>{driver.manager.name}</div>
          <div style={{fontSize: 12, color: '#6b7280'}}>📱 {driver.manager.phone}</div>
        </div>
      )}
    </div>
  )
}

// Template 2: Modern Executive
function Template2({ logo, selectedCountry, selectedDriver, drivers }) {
  return (
    <>
      <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 30, borderRadius: 12, marginBottom: 32}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{background: '#fff', padding: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center'}}>
            <img src={logo} alt="Logo" style={{height: 100}} onError={(e) => { e.target.style.display = 'none' }} />
          </div>
          <div style={{textAlign:'right', color:'#fff'}}>
            <div style={{fontSize: 14, fontWeight: 600, marginBottom: 8}}>DRIVER PERFORMANCE</div>
            <div style={{fontSize: 12, opacity: 0.9}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div style={{fontSize: 11, opacity: 0.8, marginTop: 4}}>{selectedCountry === 'all' ? 'All Countries' : COUNTRIES.find(c => c.code === selectedCountry)?.name}</div>
          </div>
        </div>
      </div>

      {selectedDriver === 'all' && (
        <div style={{marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16}}>
          <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: 20, color: '#fff'}}>
            <div style={{fontSize: 12, opacity: 0.9, marginBottom: 4}}>Total Drivers</div>
            <div style={{fontSize: 32, fontWeight: 900}}>{drivers.length}</div>
          </div>
          <div style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: 12, padding: 20, color: '#fff'}}>
            <div style={{fontSize: 12, opacity: 0.9, marginBottom: 4}}>Delivered</div>
            <div style={{fontSize: 32, fontWeight: 900}}>{drivers.reduce((s, d) => s + (d.ordersDelivered || 0), 0)}</div>
          </div>
          <div style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 12, padding: 20, color: '#fff'}}>
            <div style={{fontSize: 12, opacity: 0.9, marginBottom: 4}}>Assigned</div>
            <div style={{fontSize: 32, fontWeight: 900}}>{drivers.reduce((s, d) => s + (d.ordersAssigned || 0), 0)}</div>
          </div>
          <div style={{background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: 12, padding: 20, color: '#fff'}}>
            <div style={{fontSize: 12, opacity: 0.9, marginBottom: 4}}>Pending</div>
            <div style={{fontSize: 32, fontWeight: 900}}>{drivers.reduce((s, d) => s + (d.ordersPending || 0), 0)}</div>
          </div>
        </div>
      )}

      {drivers.map(driver => (
        <div key={driver.id} style={{background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'}}>
          <div style={{fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 12}}>{driver.name}</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 12}}>
            <div><span style={{color: '#6b7280'}}>Phone:</span> <span style={{fontWeight: 700, color: '#111'}}>{driver.phone}</span></div>
            <div><span style={{color: '#6b7280'}}>Location:</span> <span style={{fontWeight: 700, color: '#111'}}>{driver.city}, {driver.country}</span></div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12}}>
            <div style={{background: '#f0fdf4', padding: 12, borderRadius: 8}}><div style={{fontSize: 11, color: '#166534', marginBottom: 4}}>Delivered</div><div style={{fontSize: 20, fontWeight: 700, color: '#166534'}}>{driver.ordersDelivered || 0}</div></div>
            <div style={{background: '#fef3c7', padding: 12, borderRadius: 8}}><div style={{fontSize: 11, color: '#92400e', marginBottom: 4}}>Assigned</div><div style={{fontSize: 20, fontWeight: 700, color: '#92400e'}}>{driver.ordersAssigned || 0}</div></div>
            <div style={{background: '#fee2e2', padding: 12, borderRadius: 8}}><div style={{fontSize: 11, color: '#991b1b', marginBottom: 4}}>Pending</div><div style={{fontSize: 20, fontWeight: 700, color: '#991b1b'}}>{driver.ordersPending || 0}</div></div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13}}>
            <div><span style={{color: '#6b7280'}}>Settlement:</span> <span style={{fontWeight: 700, color: '#111'}}>{driver.currency} {fmtNum(driver.settlementAmount || 0)}</span></div>
            <div><span style={{color: '#6b7280'}}>To Company:</span> <span style={{fontWeight: 700, color: '#111'}}>{driver.currency} {fmtNum(driver.payToCompany || 0)}</span></div>
            <div><span style={{color: '#6b7280'}}>To Manager:</span> <span style={{fontWeight: 700, color: '#111'}}>{driver.currency} {fmtNum(driver.payToManager || 0)}</span></div>
            <div><span style={{color: '#6b7280'}}>Pending:</span> <span style={{fontWeight: 700, color: '#111'}}>{driver.currency} {fmtNum(driver.pendingSettlement || 0)}</span></div>
          </div>
          {driver.manager && <div style={{marginTop: 12, padding: 12, background: '#eff6ff', borderRadius: 6}}><div style={{fontSize: 12, color: '#1e40af', fontWeight: 600}}>Manager: {driver.manager.name}</div></div>}
        </div>
      ))}

      <div style={{marginTop: 40, paddingTop: 20, borderTop: '2px solid #e5e7eb', textAlign: 'center'}}>
        <div style={{fontSize: 16, fontWeight: 800, color: '#111'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, color: '#6b7280', marginTop: 4}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </>
  )
}

// Template 3: Financial Statement
function Template3({ logo, selectedCountry, selectedDriver, drivers }) {
  return (
    <>
      <div style={{borderBottom: '4px double #000', paddingBottom: 16, marginBottom: 24}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <img src={logo} alt="Logo" style={{height: 120}} onError={(e) => { e.target.style.display = 'none' }} />
          <div style={{textAlign:'right'}}>
            <div style={{fontSize: 16, fontWeight: 700, color: '#000'}}>DRIVER FINANCIAL REPORT</div>
            <div style={{fontSize: 12, marginTop: 4, color: '#000'}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {drivers.map(driver => (
        <table key={driver.id} style={{width: '100%', marginBottom: 24, borderCollapse: 'collapse', border: '2px solid #000'}}>
          <thead>
            <tr style={{background: '#111', color: '#fff'}}>
              <th colSpan={2} style={{padding: 12, textAlign: 'left', fontWeight: 700}}>{driver.name} - {driver.city}, {driver.country}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Phone Number</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', fontWeight: 600, color: '#000'}}>{driver.phone}</td></tr>
            <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Driver ID</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>{driver.id}</td></tr>
            <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Orders Delivered</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', fontWeight: 600, color: '#000'}}>{driver.ordersDelivered || 0}</td></tr>
            <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Orders Assigned</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>{driver.ordersAssigned || 0}</td></tr>
            <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Orders Pending</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>{driver.ordersPending || 0}</td></tr>
            <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Settlement Amount</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', fontWeight: 600, color: '#000'}}>{driver.currency} {fmtNum(driver.settlementAmount || 0)}</td></tr>
            <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Pay to Company</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>{driver.currency} {fmtNum(driver.payToCompany || 0)}</td></tr>
            <tr style={{background: '#fafafa'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Pay to Manager</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>{driver.currency} {fmtNum(driver.payToManager || 0)}</td></tr>
            <tr><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Pending Settlement</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', color: '#000'}}>{driver.currency} {fmtNum(driver.pendingSettlement || 0)}</td></tr>
            {driver.manager && <tr style={{background: '#eff6ff'}}><td style={{padding: 10, border: '1px solid #000', color: '#000'}}>Manager</td><td style={{padding: 10, textAlign: 'right', border: '1px solid #000', fontWeight: 600, color: '#000'}}>{driver.manager.name}</td></tr>}
          </tbody>
        </table>
      ))}

      <div style={{marginTop: 32, paddingTop: 16, borderTop: '4px double #000', textAlign: 'center'}}>
        <div style={{fontSize: 16, fontWeight: 800, color: '#000'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, marginTop: 4, color: '#000'}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </>
  )
}

// Template 4: Monthly Report
function Template4({ logo, selectedCountry, selectedDriver, drivers }) {
  return (
    <>
      <div style={{textAlign: 'center', borderBottom: '3px solid #d97706', paddingBottom: 24, marginBottom: 32}}>
        <img src={logo} alt="Logo" style={{height: 120, marginBottom: 16}} onError={(e) => { e.target.style.display = 'none' }} />
        <div style={{fontSize: 28, fontWeight: 900, color: '#78350f', fontFamily: 'Georgia, serif', letterSpacing: '2px'}}>MONTHLY DRIVER REPORT</div>
        <div style={{fontSize: 13, color: '#92400e', marginTop: 8, fontWeight: 600}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {drivers.map(driver => (
        <div key={driver.id} style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '2px solid #d97706', borderRadius: 16, padding: 32, marginBottom: 24}}>
          <div style={{fontSize: 20, fontWeight: 900, color: '#78350f', marginBottom: 16, textAlign: 'center', fontFamily: 'Georgia, serif'}}>{driver.name}</div>
          <div style={{background: '#fff', borderRadius: 8, padding: 16, marginBottom: 16}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 14}}>
              <div><span style={{color: '#92400e', fontWeight: 600}}>Phone:</span> <span style={{color: '#000'}}>{driver.phone}</span></div>
              <div><span style={{color: '#92400e', fontWeight: 600}}>Location:</span> <span style={{color: '#000'}}>{driver.city}, {driver.country}</span></div>
            </div>
          </div>
          <div style={{background: '#78350f', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12}}>
            <div style={{fontSize: 12, opacity: 0.9, marginBottom: 8, letterSpacing: '1px'}}>ORDER PERFORMANCE</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
              <div><div style={{fontSize: 11, opacity: 0.8}}>Delivered</div><div style={{fontSize: 24, fontWeight: 700}}>{driver.ordersDelivered || 0}</div></div>
              <div><div style={{fontSize: 11, opacity: 0.8}}>Assigned</div><div style={{fontSize: 24, fontWeight: 700}}>{driver.ordersAssigned || 0}</div></div>
              <div><div style={{fontSize: 11, opacity: 0.8}}>Pending</div><div style={{fontSize: 24, fontWeight: 700}}>{driver.ordersPending || 0}</div></div>
            </div>
          </div>
          <div style={{background: '#fff', borderRadius: 8, padding: 16}}>
            <table style={{width: '100%', fontSize: 13}}>
              <tbody>
                <tr style={{borderBottom: '1px solid #fde68a'}}><td style={{padding: '8px 0', color: '#92400e', fontWeight: 600}}>Settlement Amount</td><td style={{padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#000'}}>{driver.currency} {fmtNum(driver.settlementAmount || 0)}</td></tr>
                <tr style={{borderBottom: '1px solid #fde68a'}}><td style={{padding: '8px 0', color: '#92400e', fontWeight: 600}}>Pay to Company</td><td style={{padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#000'}}>{driver.currency} {fmtNum(driver.payToCompany || 0)}</td></tr>
                <tr style={{borderBottom: '1px solid #fde68a'}}><td style={{padding: '8px 0', color: '#92400e', fontWeight: 600}}>Pay to Manager</td><td style={{padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#000'}}>{driver.currency} {fmtNum(driver.payToManager || 0)}</td></tr>
                <tr><td style={{padding: '8px 0', color: '#92400e', fontWeight: 600}}>Pending Settlement</td><td style={{padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#000'}}>{driver.currency} {fmtNum(driver.pendingSettlement || 0)}</td></tr>
              </tbody>
            </table>
          </div>
          {driver.manager && <div style={{marginTop: 12, background: '#78350f', color: '#fff', padding: 12, borderRadius: 8, textAlign: 'center'}}><div style={{fontSize: 13, fontWeight: 600}}>Manager: {driver.manager.name}</div></div>}
        </div>
      ))}

      <div style={{borderTop: '3px solid #d97706', paddingTop: 24, marginTop: 32, textAlign: 'center'}}>
        <div style={{fontSize: 16, fontWeight: 800, color: '#78350f'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 12, color: '#92400e', marginTop: 4}}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </>
  )
}

// Template 5: Minimal Professional
function Template5({ logo, selectedCountry, selectedDriver, drivers }) {
  return (
    <>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', borderBottom: '1px solid #e5e7eb', paddingBottom: 16, marginBottom: 32}}>
        <img src={logo} alt="Logo" style={{height: 120}} onError={(e) => { e.target.style.display = 'none' }} />
        <div style={{textAlign:'right'}}>
          <div style={{fontSize: 12, fontWeight: 400, color: '#9ca3af', marginBottom: 4}}>Driver Performance Report</div>
          <div style={{fontSize: 11, color: '#6b7280'}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {drivers.map(driver => (
        <div key={driver.id} style={{borderBottom: '1px solid #f3f4f6', paddingBottom: 24, marginBottom: 24}}>
          <div style={{fontSize: 20, fontWeight: 300, color: '#111', marginBottom: 16}}>{driver.name}</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 20}}>
            <div>
              <div style={{fontSize: 11, color: '#9ca3af', marginBottom: 4}}>CONTACT</div>
              <div style={{fontSize: 14, fontWeight: 300, color: '#111'}}>{driver.phone}</div>
              <div style={{fontSize: 12, color: '#6b7280'}}>{driver.city}, {driver.country}</div>
            </div>
            <div>
              <div style={{fontSize: 11, color: '#9ca3af', marginBottom: 4}}>ID</div>
              <div style={{fontSize: 14, fontWeight: 300, color: '#111'}}>{driver.id}</div>
            </div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20}}>
            <div><div style={{fontSize: 11, color: '#9ca3af'}}>Delivered</div><div style={{fontSize: 32, fontWeight: 300, color: '#111'}}>{driver.ordersDelivered || 0}</div></div>
            <div><div style={{fontSize: 11, color: '#9ca3af'}}>Assigned</div><div style={{fontSize: 32, fontWeight: 300, color: '#111'}}>{driver.ordersAssigned || 0}</div></div>
            <div><div style={{fontSize: 11, color: '#9ca3af'}}>Pending</div><div style={{fontSize: 32, fontWeight: 300, color: '#111'}}>{driver.ordersPending || 0}</div></div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13, fontWeight: 300}}>
            <div><span style={{color: '#9ca3af'}}>Settlement</span> <span style={{color: '#111'}}>{driver.currency} {fmtNum(driver.settlementAmount || 0)}</span></div>
            <div><span style={{color: '#9ca3af'}}>To Company</span> <span style={{color: '#111'}}>{driver.currency} {fmtNum(driver.payToCompany || 0)}</span></div>
            <div><span style={{color: '#9ca3af'}}>To Manager</span> <span style={{color: '#111'}}>{driver.currency} {fmtNum(driver.payToManager || 0)}</span></div>
            <div><span style={{color: '#9ca3af'}}>Pending</span> <span style={{color: '#111'}}>{driver.currency} {fmtNum(driver.pendingSettlement || 0)}</span></div>
          </div>
          {driver.manager && <div style={{marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6'}}><div style={{fontSize: 11, color: '#9ca3af'}}>Manager</div><div style={{fontSize: 13, fontWeight: 300, color: '#111'}}>{driver.manager.name}</div></div>}
        </div>
      ))}

      <div style={{marginTop: 40, paddingTop: 16, borderTop: '1px solid #e5e7eb', textAlign: 'center'}}>
        <div style={{fontSize: 14, fontWeight: 300, color: '#111'}}>Qadeer Hussain, Owner of Buysial</div>
        <div style={{fontSize: 11, color: '#9ca3af', marginTop: 4}}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </>
  )
}

function fmtNum(n){ 
  const v = Number(n||0)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
