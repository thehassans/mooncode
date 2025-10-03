import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'

// Ensure a directory exists
function ensureDir(p){
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

// Try to load a brand logo from backend assets
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

// Format currency
function money(num, currency='USD'){
  const n = Number(num||0)
  try{ return new Intl.NumberFormat('en-US', { style:'currency', currency, maximumFractionDigits:2 }).format(n) }
  catch{ return `${n.toFixed(2)} ${currency}` }
}

// Generate a professional PDF invoice for an order document
// Returns absolute file path
export async function generateInvoicePDF(orderDoc, opts={}){
  const invoiceNo = orderDoc.invoiceNumber || `INV-${orderDoc._id}`
  const uploadsRoot = path.resolve(process.cwd(), 'uploads')
  const outDir = path.join(uploadsRoot, 'invoices')
  ensureDir(outDir)
  const outPath = path.join(outDir, `${invoiceNo}.pdf`)
  if (fs.existsSync(outPath) && !opts.force){
    return outPath
  }

  const doc = new PDFDocument({ size:'A4', margin: 36 })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  // Theme colors
  const brandDark = '#0b1220'
  const brandText = '#0f172a'
  const subtle = '#6b7280'
  const border = '#e5e7eb'

  // Header with logo on the left
  doc.roundedRect(36, 36, doc.page.width-72, 92, 12).fill(brandDark)
  const logo = getLogoPath()
  let cursorX = 48
  if (logo){
    try{
      doc.image(logo, 48, 48, { width: 56, height: 56, fit:[56,56] })
      cursorX = 48 + 56 + 12
    }catch{}
  }
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(22).text('BuySial', cursorX, 52)
  doc.font('Helvetica').fontSize(12).fillColor('#cbd5e1').text('Invoice', cursorX, 80)

  // Invoice meta (right)
  const metaX = doc.page.width - 250
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(12).text('Invoice #', metaX, 52)
  doc.font('Helvetica').text(String(invoiceNo), metaX, 68)
  doc.font('Helvetica-Bold').text('Date', metaX, 88)
  doc.font('Helvetica').text(new Date(orderDoc.createdAt || Date.now()).toLocaleDateString(), metaX, 104)

  // Customer block
  const startY = 150
  doc.fillColor(brandText).font('Helvetica-Bold').fontSize(16).text('Bill To', 36, startY)
  doc.fillColor('#111827').font('Helvetica').fontSize(12)
  const cc = String(orderDoc.phoneCountryCode||'').trim()
  const msisdn = `${cc} ${orderDoc.customerPhone||''}`.trim()
  // Name and phone
  doc.text(orderDoc.customerName || '—', 36, startY + 22)
  doc.text(msisdn || '—')
  // Extra spacing then multi-line address
  doc.moveDown(1.2)
  const addr = orderDoc.customerAddress || orderDoc.customerLocation || '—'
  doc.text(addr, { width: doc.page.width - 72 })
  // Track current Y after variable-height address block
  const afterAddressY = doc.y

  // Items table header (placed after address)
  const headerY = afterAddressY + 20
  // Adjusted columns to keep inside printable width (A4: ~559pt content width with 36pt margins)
  const col = { item:36, qty:300, unit:360, cur:430, amt:480 }
  doc.moveTo(36, headerY-10).lineTo(doc.page.width-36, headerY-10).stroke(border)
  doc.fillColor(brandText).font('Helvetica-Bold')
  doc.text('Item', col.item, headerY)
  doc.text('Qty', col.qty, headerY, { width: 40, align: 'right' })
  doc.text('Unit', col.unit, headerY, { width: 60, align: 'right' })
  doc.text('Currency', col.cur, headerY, { width: 60 })
  doc.text('Amount', col.amt, headerY, { width: 70, align: 'right' })

  const currency = (orderDoc.phoneCountryCode === '+971') ? 'AED'
    : (orderDoc.phoneCountryCode === '+968') ? 'OMR'
    : (orderDoc.phoneCountryCode === '+973') ? 'BHD'
    : (orderDoc.phoneCountryCode === '+965') ? 'KWD'
    : (orderDoc.phoneCountryCode === '+974') ? 'QAR'
    : (orderDoc.phoneCountryCode === '+91') ? 'INR'
    : 'SAR'
  // Build items list: prefer opts.items, else orderDoc.items, else single item fallback
  let items = []
  try{
    if (Array.isArray(opts.items) && opts.items.length){
      items = opts.items.map(it => ({ name: it.product?.name || 'Item', unit: Number(it.product?.price||0), qty: Math.max(1, Number(it.quantity||1)), img: (it.product && (it.product.imagePath || (Array.isArray(it.product.images) && it.product.images[0]))) || null }))
    } else if (Array.isArray(orderDoc.items) && orderDoc.items.length){
      items = orderDoc.items.map(it => ({ name: it.productId?.name || 'Item', unit: Number((it.productId && it.productId.price) != null ? it.productId.price : 0), qty: Math.max(1, Number(it.quantity||1)), img: (it.productId && (it.productId.imagePath || (Array.isArray(it.productId.images) && it.productId.images[0]))) || null }))
    } else {
      const prod = opts.product || orderDoc.productResolved || orderDoc.productId || null
      items = [{ name: (prod && prod.name) || orderDoc.details || 'Order Item', unit: Number((prod && prod.price) != null ? prod.price : (orderDoc.productId?.price || 0)), qty: Math.max(1, Number(orderDoc.quantity||1)), img: (prod && (prod.imagePath || (Array.isArray(prod.images) && prod.images[0]))) || null }]
    }
  }catch{}

  // Draw rows
  let rowY = headerY + 22
  doc.font('Helvetica').fillColor('#111827')
  let subtotal = 0
  for (const it of items){
    const amount = (Number(it.unit||0) * Math.max(1, Number(it.qty||1)))
    subtotal += amount
    let itemTextX = col.item
    try{
      const pimg = it.img
      if (pimg){
        let imgPath = null
        if (/^https?:\/\//i.test(pimg)){
          // skip external URLs
        } else {
          const local = pimg.startsWith('/') ? path.join(process.cwd(), pimg) : path.join(process.cwd(), pimg)
          if (fs.existsSync(local)) imgPath = local
        }
        if (imgPath){
          doc.image(imgPath, col.item, rowY-6, { width: 40, height: 40, fit:[40,40] })
          itemTextX = col.item + 40 + 10
        }
      }
    }catch{}
    doc.text(String(it.name||'Item'), itemTextX, rowY, { width: col.qty - itemTextX - 12 })
    doc.text(String(it.qty), col.qty, rowY, { width: 40, align:'right' })
    doc.text(Number(it.unit||0).toFixed(2), col.unit, rowY, { width: 60, align:'right' })
    doc.text(currency, col.cur, rowY, { width: 60 })
    doc.text(amount.toFixed(2), col.amt, rowY, { width: 70, align:'right' })
    rowY += 22
  }

  const shippingFee = Number(orderDoc.shippingFee||0)
  const discount = Number(orderDoc.discount||0)
  const computedTotal = subtotal + shippingFee - discount
  const total = Number(orderDoc.total || computedTotal)

  // Summary box
  const sumY = rowY + 18
  // Move totals box to the left so numbers stay inside page width
  const sumX = 280
  doc.font('Helvetica').fillColor('#111827')
  doc.text('Subtotal', sumX, sumY-18);       doc.text(subtotal.toFixed(2), sumX+120, sumY-18, { width: 120, align:'right' })
  doc.text('Shipping', sumX, sumY);          doc.text(shippingFee.toFixed(2), sumX+120, sumY, { width: 120, align:'right' })
  doc.text('Discount', sumX, sumY+18);       doc.text(discount.toFixed(2), sumX+120, sumY+18, { width: 120, align:'right' })
  doc.moveTo(sumX, sumY+36).lineTo(sumX+240, sumY+36).stroke(border)
  doc.font('Helvetica-Bold').text('Total', sumX, sumY+48)
  doc.font('Helvetica-Bold').text(total.toFixed(2), sumX+120, sumY+48, { width: 120, align:'right' })

  // Footer
  doc.font('Helvetica').fontSize(10).fillColor(subtle)
  doc.text('Thank you for your order. For support, visit /user/support.', 36, doc.page.height - 72)

  doc.end()
  await new Promise((resolve, reject)=>{ stream.on('finish', resolve); stream.on('error', reject) })
  return outPath
}
