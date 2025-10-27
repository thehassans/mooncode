import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper to get logo path
function getLogoPath(){
  const candidates = [
    path.resolve(process.cwd(), 'backend/assets/BuySial2.png'),
    path.resolve(process.cwd(), 'assets/BuySial2.png'),
    path.resolve(process.cwd(), 'BuySial2.png'),
    path.resolve(process.cwd(), '../frontend/public/BuySial2.png'),
    path.resolve(process.cwd(), 'frontend/public/BuySial2.png'),
  ]
  for (const p of candidates){ 
    try{ 
      if (fs.existsSync(p)) return p 
    }catch{} 
  }
  return null
}

// Helper to format currency
const formatCurrency = (amount, curr) => {
  return `${curr} ${Number(amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
}

// Helper to draw info row in 2-column layout
const drawInfoRow = (doc, y, label, value, x, width, labelColor = '#64748b', valueColor = '#0f172a') => {
  doc.fontSize(8).font('Helvetica').fillColor(labelColor)
  doc.text(label, x, y, { width: width * 0.4, align: 'left' })
  doc.fontSize(8).font('Helvetica-Bold').fillColor(valueColor)
  doc.text(value, x + width * 0.4, y, { width: width * 0.6, align: 'right' })
  return y + 12
}

/**
 * Generate a premium professional PDF for driver settlement summary
 * @param {Object} data - Settlement data
 * @param {string} data.driverName - Driver's full name
 * @param {string} data.driverPhone - Driver's phone
 * @param {string} data.managerName - Manager's name
 * @param {number} data.totalDeliveredOrders - Total delivered orders count
 * @param {number} data.assignedOrders - Assigned orders count
 * @param {number} data.cancelledOrders - Cancelled orders count
 * @param {number} data.collectedAmount - Total collected from customers
 * @param {number} data.deliveredToCompany - Amount already delivered to company
 * @param {number} data.pendingDeliveryToCompany - Amount pending delivery
 * @param {number} data.amount - Current settlement amount
 * @param {number} data.totalCommission - Total commission earned
 * @param {number} data.paidCommission - Commission already paid
 * @param {number} data.pendingCommission - Commission pending payment
 * @param {string} data.currency - Currency code (AED, SAR, etc.)
 * @param {string} data.method - Payment method (hand/transfer)
 * @param {string} data.receiptPath - Receipt image path (for transfer method)
 * @param {string} data.fromDate - Date range from
 * @param {string} data.toDate - Date range to
 * @param {string} data.note - Settlement note
 * @returns {Promise<string>} PDF file path
 */
export async function generateSettlementPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const timestamp = Date.now()
      const filename = `settlement-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      const doc = new PDFDocument({ size: 'A4', margin: 30 })
      const stream = fs.createWriteStream(filepath)
      doc.pipe(stream)

      const pageWidth = doc.page.width
      const margin = 30
      let currentY = margin

      // === COMPACT HEADER (50px) ===
      const gradient = doc.linearGradient(0, 0, 0, 50)
      gradient.stop(0, '#1e3a8a')
      gradient.stop(1, '#1e40af')
      doc.rect(0, 0, pageWidth, 50).fill(gradient)
      
      // Logo
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, margin, 8, { width: 34, height: 34, fit: [34, 34] })
        } catch {}
      }
      
      // Header text
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin + 45, 16, { align: 'left' })
      currentY = 60

      // === DOCUMENT INFO BOX (30px) ===
      doc.rect(margin, currentY, pageWidth - 2 * margin, 30).fillAndStroke('#fef9c3', '#eab308')
      doc.fontSize(7).font('Helvetica').fillColor('#713f12')
      doc.text('Doc ID:', margin + 8, currentY + 8)
      doc.font('Helvetica-Bold').text(`SETTLEMENT-${timestamp}`, margin + 45, currentY + 8)
      doc.font('Helvetica').text('Generated:', margin + 8, currentY + 18)
      doc.font('Helvetica-Bold').text(new Date().toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}), margin + 52, currentY + 18)
      if (data.fromDate && data.toDate) {
        doc.font('Helvetica').text('Period:', pageWidth / 2 + 10, currentY + 8)
        doc.font('Helvetica-Bold').text(`${new Date(data.fromDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${new Date(data.toDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`, pageWidth / 2 + 40, currentY + 8)
      }
      currentY += 40

      // === TWO COLUMNS: DRIVER INFO + ORDER STATS (60px) ===
      const colWidth = (pageWidth - 3 * margin) / 2
      const col1X = margin
      const col2X = margin * 2 + colWidth

      // Column 1: Driver Information
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('DRIVER INFORMATION', col1X, currentY)
      doc.rect(col1X, currentY + 13, colWidth, 60).fillAndStroke('#f8fafc', '#cbd5e1')
      let y1 = currentY + 18
      y1 = drawInfoRow(doc, y1, 'Driver Name', data.driverName || 'N/A', col1X + 8, colWidth - 16)
      if (data.driverPhone) y1 = drawInfoRow(doc, y1, 'Phone', data.driverPhone, col1X + 8, colWidth - 16)
      drawInfoRow(doc, y1, 'Submitted To', data.managerName || 'N/A', col1X + 8, colWidth - 16)

      // Column 2: Order Statistics
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('ORDER STATISTICS', col2X, currentY)
      doc.rect(col2X, currentY + 13, colWidth, 60).fillAndStroke('#faf5ff', '#d8b4fe')
      let y2 = currentY + 18
      if (data.assignedOrders != null) y2 = drawInfoRow(doc, y2, 'Total Assigned', String(data.assignedOrders || 0), col2X + 8, colWidth - 16)
      y2 = drawInfoRow(doc, y2, 'Delivered', String(data.totalDeliveredOrders || 0), col2X + 8, colWidth - 16)
      if (data.cancelledOrders != null) drawInfoRow(doc, y2, 'Cancelled', String(data.cancelledOrders || 0), col2X + 8, colWidth - 16)
      currentY += 83

      // === TWO COLUMNS: FINANCIAL + COMMISSION (70px) ===
      // Column 1: Financial Summary
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('FINANCIAL SUMMARY', col1X, currentY)
      doc.rect(col1X, currentY + 13, colWidth, 70).fillAndStroke('#ecfdf5', '#86efac')
      y1 = currentY + 18
      if (data.collectedAmount != null) y1 = drawInfoRow(doc, y1, 'Total Collected', formatCurrency(data.collectedAmount, data.currency), col1X + 8, colWidth - 16)
      y1 = drawInfoRow(doc, y1, 'Delivered to Company', formatCurrency(data.deliveredToCompany, data.currency), col1X + 8, colWidth - 16)
      drawInfoRow(doc, y1, 'Pending Delivery', formatCurrency(data.pendingDeliveryToCompany, data.currency), col1X + 8, colWidth - 16)

      // Column 2: Commission Details
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('COMMISSION DETAILS', col2X, currentY)
        doc.rect(col2X, currentY + 13, colWidth, 70).fillAndStroke('#fef3c7', '#fde047')
        y2 = currentY + 18
        if (data.totalCommission != null) y2 = drawInfoRow(doc, y2, 'Total Earned', formatCurrency(data.totalCommission, data.currency), col2X + 8, colWidth - 16)
        if (data.paidCommission != null) y2 = drawInfoRow(doc, y2, 'Already Paid', formatCurrency(data.paidCommission, data.currency), col2X + 8, colWidth - 16)
        if (data.pendingCommission != null) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e')
          doc.text('Pending Commission', col2X + 8, y2, { width: colWidth * 0.4 - 8 })
          doc.fillColor('#78350f')
          doc.text(formatCurrency(data.pendingCommission, data.currency), col2X + colWidth * 0.4, y2, { width: colWidth * 0.6 - 8, align: 'right' })
        }
      }
      currentY += 93

      // === SETTLEMENT AMOUNT BOX (35px) ===
      const settlementGrad = doc.linearGradient(margin, currentY, margin, currentY + 35)
      settlementGrad.stop(0, '#059669')
      settlementGrad.stop(1, '#047857')
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 35, 4).fillAndStroke(settlementGrad, '#065f46')
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
      doc.text('CURRENT SETTLEMENT AMOUNT', margin + 12, currentY + 10)
      doc.fontSize(16).font('Helvetica-Bold')
      doc.text(formatCurrency(data.amount, data.currency), margin, currentY + 10, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 12 
      })
      currentY += 45

      // === PAYMENT DETAILS (25px) ===
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('PAYMENT DETAILS', margin, currentY)
      doc.rect(margin, currentY + 13, pageWidth - 2 * margin, 25).fillAndStroke('#ede9fe', '#a78bfa')
      y1 = currentY + 18
      doc.fontSize(8).font('Helvetica').fillColor('#4c1d95')
      doc.text('Method:', margin + 8, y1, { width: 60 })
      doc.font('Helvetica-Bold')
      doc.text(data.method === 'transfer' ? 'Bank Transfer' : 'Hand Delivery', margin + 70, y1, { width: 150 })
      if (data.note) {
        doc.font('Helvetica').text('Note:', pageWidth / 2 + 10, y1, { width: 40 })
        doc.font('Helvetica-Bold').text(data.note, pageWidth / 2 + 52, y1, { width: colWidth - 60 })
      }
      currentY += 48

      // === FOOTER (20px) ===
      doc.fontSize(7).font('Helvetica').fillColor('#64748b')
      doc.text('CONFIDENTIAL DOCUMENT | System-generated, no signature required', margin, currentY, { align: 'center' })
      doc.fontSize(6).fillColor('#94a3b8')
      doc.text(`Generated: ${new Date().toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})} | BuySial Commerce`, margin, currentY + 10, { align: 'center' })

      doc.end()

      stream.on('finish', () => resolve(`/uploads/${filename}`))
      stream.on('error', (err) => reject(err))

    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Generate accepted settlement PDF with ACCEPTED stamp
 * @param {Object} data - Same data as generateSettlementPDF plus acceptedBy and acceptedDate
 * @returns {Promise<string>} PDF file path
 */
export async function generateAcceptedSettlementPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const timestamp = Date.now()
      const filename = `settlement-accepted-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      const doc = new PDFDocument({ size: 'A4', margin: 30 })
      const stream = fs.createWriteStream(filepath)

      doc.pipe(stream)

      const pageWidth = doc.page.width
      const margin = 30
      let currentY = margin

      // === COMPACT HEADER (50px) ===
      const gradient = doc.linearGradient(0, 0, 0, 50)
      gradient.stop(0, '#1e3a8a')
      gradient.stop(1, '#1e40af')
      doc.rect(0, 0, pageWidth, 50).fill(gradient)
      
      // Logo
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, margin, 8, { width: 34, height: 34, fit: [34, 34] })
        } catch {}
      }
      
      // Header text
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin + 45, 16, { align: 'left' })
      currentY = 60

      // === DOCUMENT INFO BOX (40px) - Green for accepted ===
      doc.rect(margin, currentY, pageWidth - 2 * margin, 40).fillAndStroke('#d1fae5', '#10b981')
      doc.fontSize(7).font('Helvetica').fillColor('#065f46')
      doc.text('Doc ID:', margin + 8, currentY + 8)
      doc.font('Helvetica-Bold').text(`SETTLEMENT-${timestamp}`, margin + 45, currentY + 8)
      doc.font('Helvetica').text('Generated:', margin + 8, currentY + 18)
      doc.font('Helvetica-Bold').text(new Date().toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}), margin + 52, currentY + 18)
      doc.font('Helvetica').text('Accepted:', margin + 8, currentY + 28)
      doc.font('Helvetica-Bold').text(new Date(data.acceptedDate || Date.now()).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}), margin + 52, currentY + 28)
      if (data.fromDate && data.toDate) {
        doc.font('Helvetica').text('Period:', pageWidth / 2 + 10, currentY + 8)
        doc.font('Helvetica-Bold').text(`${new Date(data.fromDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${new Date(data.toDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`, pageWidth / 2 + 40, currentY + 8)
      }
      // ACCEPTED badge
      doc.roundedRect(pageWidth / 2 + 10, currentY + 24, 80, 14, 3).fillAndStroke('#059669', '#047857')
      doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
      doc.text('ACCEPTED', pageWidth / 2 + 20, currentY + 27)
      currentY += 50


      // === TWO COLUMNS: DRIVER INFO + ORDER STATS (60px) ===
      const colWidth = (pageWidth - 3 * margin) / 2
      const col1X = margin
      const col2X = margin * 2 + colWidth

      // Column 1: Driver Information
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('DRIVER INFORMATION', col1X, currentY)
      doc.rect(col1X, currentY + 13, colWidth, 60).fillAndStroke('#f8fafc', '#cbd5e1')
      let y1 = currentY + 18
      y1 = drawInfoRow(doc, y1, 'Driver Name', data.driverName || 'N/A', col1X + 8, colWidth - 16)
      if (data.driverPhone) y1 = drawInfoRow(doc, y1, 'Phone', data.driverPhone, col1X + 8, colWidth - 16)
      drawInfoRow(doc, y1, 'Submitted To', data.managerName || 'N/A', col1X + 8, colWidth - 16)

      // Column 2: Order Statistics
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('ORDER STATISTICS', col2X, currentY)
      doc.rect(col2X, currentY + 13, colWidth, 60).fillAndStroke('#faf5ff', '#d8b4fe')
      let y2 = currentY + 18
      if (data.assignedOrders != null) y2 = drawInfoRow(doc, y2, 'Total Assigned', String(data.assignedOrders || 0), col2X + 8, colWidth - 16)
      y2 = drawInfoRow(doc, y2, 'Delivered', String(data.totalDeliveredOrders || 0), col2X + 8, colWidth - 16)
      if (data.cancelledOrders != null) drawInfoRow(doc, y2, 'Cancelled', String(data.cancelledOrders || 0), col2X + 8, colWidth - 16)
      currentY += 83

      // === TWO COLUMNS: FINANCIAL + COMMISSION (70px) ===
      // Column 1: Financial Summary
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('FINANCIAL SUMMARY', col1X, currentY)
      doc.rect(col1X, currentY + 13, colWidth, 70).fillAndStroke('#ecfdf5', '#86efac')
      y1 = currentY + 18
      if (data.collectedAmount != null) y1 = drawInfoRow(doc, y1, 'Total Collected', formatCurrency(data.collectedAmount, data.currency), col1X + 8, colWidth - 16)
      y1 = drawInfoRow(doc, y1, 'Delivered to Company', formatCurrency(data.deliveredToCompany, data.currency), col1X + 8, colWidth - 16)
      drawInfoRow(doc, y1, 'Pending Delivery', formatCurrency(data.pendingDeliveryToCompany, data.currency), col1X + 8, colWidth - 16)

      // Column 2: Commission Details
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('COMMISSION DETAILS', col2X, currentY)
        doc.rect(col2X, currentY + 13, colWidth, 70).fillAndStroke('#fef3c7', '#fde047')
        y2 = currentY + 18
        if (data.totalCommission != null) y2 = drawInfoRow(doc, y2, 'Total Earned', formatCurrency(data.totalCommission, data.currency), col2X + 8, colWidth - 16)
        if (data.paidCommission != null) y2 = drawInfoRow(doc, y2, 'Already Paid', formatCurrency(data.paidCommission, data.currency), col2X + 8, colWidth - 16)
        if (data.pendingCommission != null) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e')
          doc.text('Pending Commission', col2X + 8, y2, { width: colWidth * 0.4 - 8 })
          doc.fillColor('#78350f')
          doc.text(formatCurrency(data.pendingCommission, data.currency), col2X + colWidth * 0.4, y2, { width: colWidth * 0.6 - 8, align: 'right' })
        }
      }
      currentY += 93

      // === SETTLEMENT AMOUNT BOX (35px) - GREEN FOR ACCEPTED ===
      const settlementGrad = doc.linearGradient(margin, currentY, margin, currentY + 35)
      settlementGrad.stop(0, '#059669')
      settlementGrad.stop(1, '#047857')
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 35, 4).fillAndStroke(settlementGrad, '#065f46')
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
      doc.text('ACCEPTED SETTLEMENT AMOUNT', margin + 12, currentY + 10)
      doc.fontSize(16).font('Helvetica-Bold')
      doc.text(formatCurrency(data.amount, data.currency), margin, currentY + 10, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 12 
      })
      currentY += 45

      // === PAYMENT DETAILS (35px) ===
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('PAYMENT DETAILS', margin, currentY)
      doc.rect(margin, currentY + 13, pageWidth - 2 * margin, 35).fillAndStroke('#ede9fe', '#a78bfa')
      y1 = currentY + 18
      doc.fontSize(8).font('Helvetica').fillColor('#4c1d95')
      doc.text('Method:', margin + 8, y1, { width: 60 })
      doc.font('Helvetica-Bold')
      doc.text(data.method === 'transfer' ? 'Bank Transfer' : 'Hand Delivery', margin + 70, y1, { width: 150 })
      if (data.note) {
        doc.font('Helvetica').text('Note:', pageWidth / 2 + 10, y1, { width: 40 })
        doc.font('Helvetica-Bold').text(data.note, pageWidth / 2 + 52, y1, { width: colWidth - 60 })
      }
      if (data.acceptedBy) {
        doc.font('Helvetica').text('Accepted By:', margin + 8, y1 + 12, { width: 70 })
        doc.font('Helvetica-Bold').text(data.acceptedBy, margin + 78, y1 + 12, { width: 180 })
      }
      currentY += 58

      // === FOOTER (20px) ===
      doc.fontSize(7).font('Helvetica').fillColor('#059669')
      doc.text('ACCEPTED & VERIFIED DOCUMENT | This settlement has been accepted and verified by the company', margin, currentY, { align: 'center' })
      doc.fontSize(6).fillColor('#10b981')
      doc.text(`Accepted: ${new Date(data.acceptedDate || Date.now()).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})} | BuySial Commerce`, margin, currentY + 10, { align: 'center' })

      // Finalize PDF
      doc.end()

      stream.on('finish', () => {
        resolve(`/uploads/${filename}`)
      })

      stream.on('error', (err) => {
        reject(err)
      })

    } catch (err) {
      reject(err)
    }
  })
}
