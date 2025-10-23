import React, { useState, useEffect, useRef, useMemo } from 'react'
import { apiGet } from '../../utils/api'
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
                style={{minWidth:160, padding:'8px 12px', fontSize:14}}
              >
                <option value="all">All Drivers</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
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
        <Template1 
          logo="/BuySial2.png" 
          selectedCountry={selectedCountry}
          selectedDriver={selectedDriver}
          drivers={filteredDrivers}
        />
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

function fmtNum(n){ 
  const v = Number(n||0)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
