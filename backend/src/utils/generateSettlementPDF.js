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
 * @param {Array} data.deliveredOrders - Array of delivered orders with details
 * @param {number} data.commissionPerOrder - Commission amount per order
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

      // === DOCUMENT INFO BOX (45px) ===
      doc.rect(margin, currentY, pageWidth - 2 * margin, 45).fillAndStroke('#fef9c3', '#eab308')
      doc.fontSize(8).font('Helvetica').fillColor('#713f12')
      doc.text('Document ID:', margin + 12, currentY + 12)
      doc.font('Helvetica-Bold').text(`SETTLEMENT-${timestamp}`, margin + 80, currentY + 12)
      doc.font('Helvetica').text('Generated:', margin + 12, currentY + 26)
      doc.font('Helvetica-Bold').text(new Date().toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}), margin + 80, currentY + 26)
      if (data.fromDate && data.toDate) {
        doc.font('Helvetica').text('Period:', pageWidth / 2 + 20, currentY + 12)
        doc.font('Helvetica-Bold').text(`${new Date(data.fromDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${new Date(data.toDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`, pageWidth / 2 + 65, currentY + 12)
      }
      currentY += 60

      // === TWO COLUMNS: DRIVER INFO + ORDER STATS (80px) ===
      const colWidth = (pageWidth - 3 * margin) / 2
      const col1X = margin
      const col2X = margin * 2 + colWidth

      // Column 1: Driver Information
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('DRIVER INFORMATION', col1X, currentY)
      doc.rect(col1X, currentY + 16, colWidth, 80).fillAndStroke('#f8fafc', '#cbd5e1')
      let y1 = currentY + 24
      y1 = drawInfoRow(doc, y1, 'Driver Name', data.driverName || 'N/A', col1X + 12, colWidth - 24)
      if (data.driverPhone) y1 = drawInfoRow(doc, y1, 'Phone', data.driverPhone, col1X + 12, colWidth - 24)
      drawInfoRow(doc, y1, 'Submitted To', data.managerName || 'N/A', col1X + 12, colWidth - 24)

      // Column 2: Order Statistics
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('ORDER STATISTICS', col2X, currentY)
      doc.rect(col2X, currentY + 16, colWidth, 80).fillAndStroke('#faf5ff', '#d8b4fe')
      let y2 = currentY + 24
      if (data.assignedOrders != null) y2 = drawInfoRow(doc, y2, 'Total Assigned', String(data.assignedOrders || 0), col2X + 12, colWidth - 24)
      y2 = drawInfoRow(doc, y2, 'Delivered', String(data.totalDeliveredOrders || 0), col2X + 12, colWidth - 24)
      if (data.cancelledOrders != null) drawInfoRow(doc, y2, 'Cancelled', String(data.cancelledOrders || 0), col2X + 12, colWidth - 24)
      currentY += 108

      // === TWO COLUMNS: FINANCIAL + COMMISSION (90px) ===
      // Column 1: Financial Summary
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('FINANCIAL SUMMARY', col1X, currentY)
      doc.rect(col1X, currentY + 16, colWidth, 90).fillAndStroke('#ecfdf5', '#86efac')
      y1 = currentY + 24
      if (data.collectedAmount != null) y1 = drawInfoRow(doc, y1, 'Total Collected', formatCurrency(data.collectedAmount, data.currency), col1X + 12, colWidth - 24)
      y1 = drawInfoRow(doc, y1, 'Delivered to Company', formatCurrency(data.deliveredToCompany, data.currency), col1X + 12, colWidth - 24)
      drawInfoRow(doc, y1, 'Pending Delivery', formatCurrency(data.pendingDeliveryToCompany, data.currency), col1X + 12, colWidth - 24)

      // Column 2: Commission Details
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('COMMISSION DETAILS', col2X, currentY)
        doc.rect(col2X, currentY + 16, colWidth, 90).fillAndStroke('#fef3c7', '#fde047')
        y2 = currentY + 24
        // Show commission calculation
        if (data.commissionPerOrder != null && data.totalDeliveredOrders != null) {
          doc.fontSize(7).font('Helvetica').fillColor('#92400e')
          doc.text(`${data.totalDeliveredOrders} \u00d7 ${formatCurrency(data.commissionPerOrder, data.currency)}`, col2X + 12, y2, { width: colWidth * 0.4 - 12 })
          y2 += 12
        }
        if (data.totalCommission != null) y2 = drawInfoRow(doc, y2, 'Total Earned', formatCurrency(data.totalCommission, data.currency), col2X + 12, colWidth - 24)
        if (data.paidCommission != null) y2 = drawInfoRow(doc, y2, 'Already Paid', formatCurrency(data.paidCommission, data.currency), col2X + 12, colWidth - 24)
        if (data.pendingCommission != null) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e')
          doc.text('Pending Commission', col2X + 12, y2, { width: colWidth * 0.4 - 12 })
          doc.fillColor('#78350f')
          doc.text(formatCurrency(data.pendingCommission, data.currency), col2X + colWidth * 0.4, y2, { width: colWidth * 0.6 - 12, align: 'right' })
        }
      }
      currentY += 118

      // === ORDERS DETAIL SECTION (if delivered orders provided) ===
      if (data.deliveredOrders && data.deliveredOrders.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('ORDERS DETAIL', margin, currentY)
        doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        doc.text(`Showing ${Math.min(data.deliveredOrders.length, 100)} of ${data.totalDeliveredOrders} delivered orders`, margin, currentY + 14)
        currentY += 28
        
        // Orders table
        const tableTop = currentY
        const tableWidth = pageWidth - 2 * margin
        const colWidths = { no: 30, invoice: 80, date: 75, customer: 120, amount: 70 }
        
        // Table header
        doc.rect(margin, currentY, tableWidth, 20).fillAndStroke('#f8fafc', '#cbd5e1')
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
        let xPos = margin + 8
        doc.text('#', xPos, currentY + 6, { width: colWidths.no })
        xPos += colWidths.no
        doc.text('Invoice', xPos, currentY + 6, { width: colWidths.invoice })
        xPos += colWidths.invoice
        doc.text('Delivered', xPos, currentY + 6, { width: colWidths.date })
        xPos += colWidths.date
        doc.text('Customer', xPos, currentY + 6, { width: colWidths.customer })
        xPos += colWidths.customer
        doc.text('Amount', xPos, currentY + 6, { width: colWidths.amount, align: 'right' })
        currentY += 20
        
        // Table rows (limit to first 15 to avoid overflow)
        const ordersToShow = data.deliveredOrders.slice(0, 15)
        doc.fontSize(7).font('Helvetica')
        ordersToShow.forEach((order, idx) => {
          if (currentY > doc.page.height - 200) return // Stop if near page end
          
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
          doc.rect(margin, currentY, tableWidth, 16).fillAndStroke(rowBg, '#e2e8f0')
          
          doc.fillColor('#334155')
          xPos = margin + 8
          doc.text(String(idx + 1), xPos, currentY + 4, { width: colWidths.no })
          xPos += colWidths.no
          doc.text(order.invoiceNumber || 'N/A', xPos, currentY + 4, { width: colWidths.invoice })
          xPos += colWidths.invoice
          const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : 'N/A'
          doc.text(deliveredDate, xPos, currentY + 4, { width: colWidths.date })
          xPos += colWidths.date
          doc.text(order.customerName || 'N/A', xPos, currentY + 4, { width: colWidths.customer })
          xPos += colWidths.customer
          doc.text(formatCurrency(order.grandTotal || 0, order.currency || data.currency), xPos, currentY + 4, { width: colWidths.amount, align: 'right' })
          currentY += 16
        })
        
        if (data.deliveredOrders.length > 15) {
          currentY += 4
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748b')
          doc.text(`+ ${data.deliveredOrders.length - 15} more orders...`, margin + 8, currentY)
          currentY += 12
        }
        
        currentY += 10
      }

      // === SETTLEMENT AMOUNT BOX (50px) ===
      const settlementGrad = doc.linearGradient(margin, currentY, margin, currentY + 50)
      settlementGrad.stop(0, '#059669')
      settlementGrad.stop(1, '#047857')
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 50, 5).fillAndStroke(settlementGrad, '#065f46')
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
      doc.text('CURRENT SETTLEMENT AMOUNT', margin + 16, currentY + 15)
      doc.fontSize(20).font('Helvetica-Bold')
      doc.text(formatCurrency(data.amount, data.currency), margin, currentY + 15, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 16 
      })
      currentY += 65

      // === PAYMENT DETAILS (40px) ===
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('PAYMENT DETAILS', margin, currentY)
      doc.rect(margin, currentY + 16, pageWidth - 2 * margin, 40).fillAndStroke('#ede9fe', '#a78bfa')
      y1 = currentY + 24
      doc.fontSize(8).font('Helvetica').fillColor('#4c1d95')
      doc.text('Method:', margin + 12, y1, { width: 60 })
      doc.font('Helvetica-Bold')
      doc.text(data.method === 'transfer' ? 'Bank Transfer' : 'Hand Delivery', margin + 80, y1, { width: 150 })
      if (data.note) {
        doc.font('Helvetica').text('Note:', pageWidth / 2 + 20, y1, { width: 40 })
        doc.font('Helvetica-Bold').text(data.note, pageWidth / 2 + 65, y1, { width: colWidth - 75 })
      }
      currentY += 70

      // === SIGNATURE BLOCK ===
      const pageHeight = doc.page.height
      const signatureY = pageHeight - 110
      doc.rect(margin, signatureY, pageWidth - 2 * margin, 60).fillAndStroke('#f8fafc', '#cbd5e1')
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('Qadeer Hussain, Owner of Buysial', margin, signatureY + 20, { align: 'center', width: pageWidth - 2 * margin })
      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
      doc.text(`Date: ${new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}`, margin, signatureY + 38, { align: 'center', width: pageWidth - 2 * margin })
      
      // === FOOTER ===
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      doc.text('CONFIDENTIAL DOCUMENT | BuySial Commerce', margin, pageHeight - 35, { align: 'center' })
      doc.fontSize(6).fillColor('#cbd5e1')
      doc.text(`Generated: ${new Date().toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})}`, margin, pageHeight - 22, { align: 'center' })

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

      // === DOCUMENT INFO BOX (50px) - Green for accepted ===
      doc.rect(margin, currentY, pageWidth - 2 * margin, 50).fillAndStroke('#d1fae5', '#10b981')
      doc.fontSize(8).font('Helvetica').fillColor('#065f46')
      doc.text('Document ID:', margin + 12, currentY + 10)
      doc.font('Helvetica-Bold').text(`SETTLEMENT-${timestamp}`, margin + 90, currentY + 10)
      doc.font('Helvetica').text('Generated:', margin + 12, currentY + 24)
      doc.font('Helvetica-Bold').text(new Date().toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'}), margin + 90, currentY + 24)
      doc.font('Helvetica').text('Accepted:', margin + 12, currentY + 38)
      doc.font('Helvetica-Bold').text(new Date(data.acceptedDate || Date.now()).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}), margin + 90, currentY + 38)
      if (data.fromDate && data.toDate) {
        doc.font('Helvetica').text('Period:', pageWidth / 2 + 20, currentY + 10)
        doc.font('Helvetica-Bold').text(`${new Date(data.fromDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${new Date(data.toDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`, pageWidth / 2 + 65, currentY + 10)
      }
      // ACCEPTED badge
      doc.roundedRect(pageWidth / 2 + 20, currentY + 30, 90, 16, 3).fillAndStroke('#059669', '#047857')
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white')
      doc.text('ACCEPTED', pageWidth / 2 + 33, currentY + 34)
      currentY += 65

      // === TWO COLUMNS: DRIVER INFO + ORDER STATS (80px) ===
      const colWidth = (pageWidth - 3 * margin) / 2
      const col1X = margin
      const col2X = margin * 2 + colWidth

      // Column 1: Driver Information
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('DRIVER INFORMATION', col1X, currentY)
      doc.rect(col1X, currentY + 16, colWidth, 80).fillAndStroke('#f8fafc', '#cbd5e1')
      let y1 = currentY + 24
      y1 = drawInfoRow(doc, y1, 'Driver Name', data.driverName || 'N/A', col1X + 12, colWidth - 24)
      if (data.driverPhone) y1 = drawInfoRow(doc, y1, 'Phone', data.driverPhone, col1X + 12, colWidth - 24)
      drawInfoRow(doc, y1, 'Submitted To', data.managerName || 'N/A', col1X + 12, colWidth - 24)

      // Column 2: Order Statistics
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('ORDER STATISTICS', col2X, currentY)
      doc.rect(col2X, currentY + 16, colWidth, 80).fillAndStroke('#faf5ff', '#d8b4fe')
      let y2 = currentY + 24
      if (data.assignedOrders != null) y2 = drawInfoRow(doc, y2, 'Total Assigned', String(data.assignedOrders || 0), col2X + 12, colWidth - 24)
      y2 = drawInfoRow(doc, y2, 'Delivered', String(data.totalDeliveredOrders || 0), col2X + 12, colWidth - 24)
      if (data.cancelledOrders != null) drawInfoRow(doc, y2, 'Cancelled', String(data.cancelledOrders || 0), col2X + 12, colWidth - 24)
      currentY += 108

      // === TWO COLUMNS: FINANCIAL + COMMISSION (90px) ===
      // Column 1: Financial Summary
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('FINANCIAL SUMMARY', col1X, currentY)
      doc.rect(col1X, currentY + 16, colWidth, 90).fillAndStroke('#ecfdf5', '#86efac')
      y1 = currentY + 24
      if (data.collectedAmount != null) y1 = drawInfoRow(doc, y1, 'Total Collected', formatCurrency(data.collectedAmount, data.currency), col1X + 12, colWidth - 24)
      y1 = drawInfoRow(doc, y1, 'Delivered to Company', formatCurrency(data.deliveredToCompany, data.currency), col1X + 12, colWidth - 24)
      drawInfoRow(doc, y1, 'Pending Delivery', formatCurrency(data.pendingDeliveryToCompany, data.currency), col1X + 12, colWidth - 24)

      // Column 2: Commission Details
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('COMMISSION DETAILS', col2X, currentY)
        doc.rect(col2X, currentY + 16, colWidth, 90).fillAndStroke('#fef3c7', '#fde047')
        y2 = currentY + 24
        // Show commission calculation
        if (data.commissionPerOrder != null && data.totalDeliveredOrders != null) {
          doc.fontSize(7).font('Helvetica').fillColor('#92400e')
          doc.text(`${data.totalDeliveredOrders} × ${formatCurrency(data.commissionPerOrder, data.currency)}`, col2X + 12, y2, { width: colWidth * 0.4 - 12 })
          y2 += 12
        }
        if (data.totalCommission != null) y2 = drawInfoRow(doc, y2, 'Total Earned', formatCurrency(data.totalCommission, data.currency), col2X + 12, colWidth - 24)
        if (data.paidCommission != null) y2 = drawInfoRow(doc, y2, 'Already Paid', formatCurrency(data.paidCommission, data.currency), col2X + 12, colWidth - 24)
        if (data.pendingCommission != null) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e')
          doc.text('Pending Commission', col2X + 12, y2, { width: colWidth * 0.4 - 12 })
          doc.fillColor('#78350f')
          doc.text(formatCurrency(data.pendingCommission, data.currency), col2X + colWidth * 0.4, y2, { width: colWidth * 0.6 - 12, align: 'right' })
        }
      }
      currentY += 118

      // === ORDERS DETAIL SECTION (if delivered orders provided) ===
      if (data.deliveredOrders && data.deliveredOrders.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('ORDERS DETAIL', margin, currentY)
        doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        doc.text(`Showing ${Math.min(data.deliveredOrders.length, 100)} of ${data.totalDeliveredOrders} delivered orders`, margin, currentY + 14)
        currentY += 28
        
        // Orders table
        const tableTop = currentY
        const tableWidth = pageWidth - 2 * margin
        const colWidths = { no: 30, invoice: 80, date: 75, customer: 120, amount: 70 }
        
        // Table header
        doc.rect(margin, currentY, tableWidth, 20).fillAndStroke('#f8fafc', '#cbd5e1')
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
        let xPos = margin + 8
        doc.text('#', xPos, currentY + 6, { width: colWidths.no })
        xPos += colWidths.no
        doc.text('Invoice', xPos, currentY + 6, { width: colWidths.invoice })
        xPos += colWidths.invoice
        doc.text('Delivered', xPos, currentY + 6, { width: colWidths.date })
        xPos += colWidths.date
        doc.text('Customer', xPos, currentY + 6, { width: colWidths.customer })
        xPos += colWidths.customer
        doc.text('Amount', xPos, currentY + 6, { width: colWidths.amount, align: 'right' })
        currentY += 20
        
        // Table rows (limit to first 15 to avoid overflow)
        const ordersToShow = data.deliveredOrders.slice(0, 15)
        doc.fontSize(7).font('Helvetica')
        ordersToShow.forEach((order, idx) => {
          if (currentY > doc.page.height - 200) return // Stop if near page end
          
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
          doc.rect(margin, currentY, tableWidth, 16).fillAndStroke(rowBg, '#e2e8f0')
          
          doc.fillColor('#334155')
          xPos = margin + 8
          doc.text(String(idx + 1), xPos, currentY + 4, { width: colWidths.no })
          xPos += colWidths.no
          doc.text(order.invoiceNumber || 'N/A', xPos, currentY + 4, { width: colWidths.invoice })
          xPos += colWidths.invoice
          const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : 'N/A'
          doc.text(deliveredDate, xPos, currentY + 4, { width: colWidths.date })
          xPos += colWidths.date
          doc.text(order.customerName || 'N/A', xPos, currentY + 4, { width: colWidths.customer })
          xPos += colWidths.customer
          doc.text(formatCurrency(order.grandTotal || 0, order.currency || data.currency), xPos, currentY + 4, { width: colWidths.amount, align: 'right' })
          currentY += 16
        })
        
        if (data.deliveredOrders.length > 15) {
          currentY += 4
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748b')
          doc.text(`+ ${data.deliveredOrders.length - 15} more orders...`, margin + 8, currentY)
          currentY += 12
        }
        
        currentY += 10
      }

      // === SETTLEMENT AMOUNT BOX (50px) - GREEN FOR ACCEPTED ===
      const settlementGrad = doc.linearGradient(margin, currentY, margin, currentY + 50)
      settlementGrad.stop(0, '#059669')
      settlementGrad.stop(1, '#047857')
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 50, 5).fillAndStroke(settlementGrad, '#065f46')
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
      doc.text('ACCEPTED SETTLEMENT AMOUNT', margin + 16, currentY + 15)
      doc.fontSize(20).font('Helvetica-Bold')
      doc.text(formatCurrency(data.amount, data.currency), margin, currentY + 15, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 16 
      })
      currentY += 65

      // === PAYMENT DETAILS (45px) ===
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('PAYMENT DETAILS', margin, currentY)
      doc.rect(margin, currentY + 16, pageWidth - 2 * margin, 45).fillAndStroke('#ede9fe', '#a78bfa')
      y1 = currentY + 22
      doc.fontSize(8).font('Helvetica').fillColor('#4c1d95')
      doc.text('Method:', margin + 12, y1, { width: 60 })
      doc.font('Helvetica-Bold')
      doc.text(data.method === 'transfer' ? 'Bank Transfer' : 'Hand Delivery', margin + 80, y1, { width: 150 })
      if (data.note) {
        doc.font('Helvetica').text('Note:', pageWidth / 2 + 20, y1, { width: 40 })
        doc.font('Helvetica-Bold').text(data.note, pageWidth / 2 + 65, y1, { width: colWidth - 75 })
      }
      if (data.acceptedBy) {
        doc.font('Helvetica').text('Accepted By:', margin + 12, y1 + 14, { width: 70 })
        doc.font('Helvetica-Bold').text(data.acceptedBy, margin + 90, y1 + 14, { width: 180 })
      }
      currentY += 75

      // === SIGNATURE BLOCK ===
      const pageHeight = doc.page.height
      const signatureY = pageHeight - 110
      doc.rect(margin, signatureY, pageWidth - 2 * margin, 60).fillAndStroke('#d1fae5', '#10b981')
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#047857')
      doc.text('Qadeer Hussain, Owner of Buysial', margin, signatureY + 20, { align: 'center', width: pageWidth - 2 * margin })
      doc.fontSize(9).font('Helvetica').fillColor('#065f46')
      doc.text(`Date: ${new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}`, margin, signatureY + 38, { align: 'center', width: pageWidth - 2 * margin })
      
      // === FOOTER ===
      doc.fontSize(7).font('Helvetica').fillColor('#10b981')
      doc.text('ACCEPTED & VERIFIED DOCUMENT | BuySial Commerce', margin, pageHeight - 35, { align: 'center' })
      doc.fontSize(6).fillColor('#86efac')
      doc.text(`Accepted: ${new Date(data.acceptedDate || Date.now()).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})}`, margin, pageHeight - 22, { align: 'center' })

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
