import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'

function ensureDir(p){ if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive:true }) }

function getLogoPath(){
  const candidates = [
    path.resolve(process.cwd(), 'backend/assets/BuySial2.png'),
    path.resolve(process.cwd(), 'assets/BuySial2.png'),
    path.resolve(process.cwd(), 'BuySial2.png'),
    path.resolve(process.cwd(), '../frontend/public/BuySial2.png'),
  ]
  for (const p of candidates){ try{ if (fs.existsSync(p)) return p }catch{} }
  return null
}

export async function generatePayoutReceiptPDF(agent, amountPKR){
  const uploadsRoot = path.resolve(process.cwd(), 'uploads')
  const outDir = path.join(uploadsRoot, 'payouts')
  ensureDir(outDir)
  const safeName = `${String(agent.firstName||'').trim()}_${String(agent.lastName||'').trim()}`.replace(/\s+/g,'_') || 'agent'
  const outPath = path.join(outDir, `receipt_${safeName}_${Date.now()}.pdf`)

  const doc = new PDFDocument({ size:'A4', margin: 40 })
  const ws = fs.createWriteStream(outPath)
  doc.pipe(ws)

  const brandDark = '#0b1220'
  doc.roundedRect(40, 40, doc.page.width-80, 80, 10).fill(brandDark)
  const logo = getLogoPath()
  let x = 52
  if (logo){
    try{ doc.image(logo, 52, 52, { width: 48, height:48, fit:[48,48] }); x = 52 + 48 + 10 }catch{}
  }
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(20).text('BuySial', x, 58)
  doc.font('Helvetica').fontSize(12).text('Payout Receipt', x, 84)

  const bodyY = 150
  doc.fillColor('#0f172a').font('Helvetica').fontSize(14)
  const name = `${agent.firstName||''} ${agent.lastName||''}`.trim() || 'Agent'
  const amt = Number(amountPKR||0).toLocaleString('en-PK')
  const lines = [
    `Dear ${name},`,
    `You have received PKR ${amt} from team BuySial.`,
    `Thank you.`,
  ]
  let y=bodyY
  for (const ln of lines){ doc.text(ln, 52, y); y+=26 }

  doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
  doc.text(new Date().toLocaleString(), 52, y+20)

  doc.end()
  await new Promise((res, rej)=>{ ws.on('finish', res); ws.on('error', rej) })
  return outPath
}
