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
 * @param {number} data.driverCommissionRate - Commission per order
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
 * @param {Array} data.orders - Array of order details with items and status
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

      // === ORDER DETAILS SECTION ===
      if (data.orders && data.orders.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('ORDER DETAILS', margin, currentY, { underline: true })
        currentY += 25
        
        // Track rendered orders and enforce 2-page limit
        let renderedOrders = 0
        const maxOrders = Math.min(7, data.orders.length)
        const pageHeight = doc.page.height
        const reservedSpace = 350 // Space for settlement, payment, signature (increased)
        
        for (let idx = 0; idx < maxOrders; idx++) {
          const order = data.orders[idx]
          
          // Estimate space needed for this order
          const itemsCount = (order.items || []).length
          const orderHeight = 30 + 38 + 16 + (itemsCount * 14) + 20 + 28 + 8 // header + table + items + subtotal + spacing
          
          // Check if we need to add a page break
          if (currentY + orderHeight + reservedSpace > pageHeight) {
            const currentPage = doc.bufferedPageRange().count
            if (currentPage >= 2) {
              // Already on page 2, stop rendering more orders
              break
            }
            // Add page break and reset Y position
            doc.addPage()
            currentY = margin
          }
          
          // Order Header Box
          doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 30, 4)
            .fillAndStroke('#f0f9ff', '#0284c7')
          
          // Order ID and Customer
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0c4a6e')
          doc.text(`Order #${order.invoiceNumber}`, margin + 12, currentY + 8)
          doc.fontSize(8).font('Helvetica').fillColor('#475569')
          doc.text(`Customer: ${order.customerName}`, margin + 12, currentY + 20)
          
          // Order Status Badge
          const statusText = String(order.status || 'delivered').toUpperCase()
          const statusColor = order.status === 'delivered' ? '#10b981' : '#0284c7'
          doc.roundedRect(pageWidth - margin - 100, currentY + 7, 80, 16, 3)
            .fillAndStroke(statusColor, statusColor)
          doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
          doc.text(statusText, pageWidth - margin - 95, currentY + 11, { width: 70, align: 'center' })
          
          currentY += 38
          
          // Items Table Header
          doc.rect(margin, currentY, pageWidth - 2 * margin, 16).fill('#e2e8f0')
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b')
          doc.text('PRODUCT NAME', margin + 8, currentY + 5, { width: 220 })
          doc.text('QTY', margin + 235, currentY + 5, { width: 40, align: 'right' })
          doc.text('PRICE', margin + 285, currentY + 5, { width: 80, align: 'right' })
          doc.text('TOTAL', margin + 375, currentY + 5, { width: 80, align: 'right' })
          currentY += 16
          
          // Items Rows
          const items = order.items || []
          let orderSubtotal = 0
          items.forEach(item => {
            const itemTotal = Number(item.price) * Number(item.quantity)
            orderSubtotal += itemTotal
            
            doc.rect(margin, currentY, pageWidth - 2 * margin, 14).stroke('#e2e8f0')
            doc.fontSize(7).font('Helvetica').fillColor('#475569')
            doc.text(item.name, margin + 8, currentY + 4, { width: 220, ellipsis: true })
            doc.text(String(item.quantity), margin + 235, currentY + 4, { width: 40, align: 'right' })
            doc.text(formatCurrency(item.price, data.currency), margin + 285, currentY + 4, { width: 80, align: 'right' })
            doc.text(formatCurrency(itemTotal, data.currency), margin + 375, currentY + 4, { width: 80, align: 'right' })
            currentY += 14
          })
          
          // Order Total and Commission Row - compact layout WITHOUT continued (prevents blank pages)
          doc.rect(margin, currentY, pageWidth - 2 * margin, 20).fillAndStroke('#fef9c3', '#eab308')
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#713f12')
          
          const boxWidth = pageWidth - 2 * margin
          const leftText = 'Order Subtotal: ' + formatCurrency(order.subTotal || orderSubtotal, data.currency)
          const rightText = 'Commission: ' + formatCurrency(Number(order.commission) || 0, data.currency)
          
          // Left side: Order Subtotal
          doc.fillColor('#713f12').text(leftText, margin + 8, currentY + 6, { width: boxWidth / 2 - 16 })
          
          // Right side: Commission
          const rightX = margin + boxWidth / 2 + 20
          doc.fillColor('#713f12').text('Commission: ', rightX, currentY + 6, { width: 70, continued: false })
          doc.fillColor('#047857').text(formatCurrency(Number(order.commission) || 0, data.currency), rightX + 72, currentY + 6)
          currentY += 28
          
          // Add spacing between orders
          renderedOrders++
          if (idx < maxOrders - 1) {
            currentY += 8
          }
        }
        
        if (data.orders.length > renderedOrders) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b')
          doc.text(`Showing first ${renderedOrders} of ${data.orders.length} total orders`, margin, currentY, { align: 'center' })
          currentY += 20
        } else {
          currentY += 12
        }
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
      const signatureY = Math.max(currentY + 20, pageHeight - 110)
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

      // === ORDER DETAILS SECTION ===
      if (data.orders && data.orders.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('ORDER DETAILS', margin, currentY, { underline: true })
        currentY += 25
        
        // Track rendered orders and enforce 2-page limit
        let renderedOrders = 0
        const maxOrders = Math.min(7, data.orders.length)
        const pageHeight = doc.page.height
        const reservedSpace = 350 // Space for settlement, payment, signature (increased)
        
        for (let idx = 0; idx < maxOrders; idx++) {
          const order = data.orders[idx]
          
          // Estimate space needed for this order
          const itemsCount = (order.items || []).length
          const orderHeight = 30 + 38 + 16 + (itemsCount * 14) + 20 + 28 + 8 // header + table + items + subtotal + spacing
          
          // Check if we need to add a page break
          if (currentY + orderHeight + reservedSpace > pageHeight) {
            const currentPage = doc.bufferedPageRange().count
            if (currentPage >= 2) {
              // Already on page 2, stop rendering more orders
              break
            }
            // Add page break and reset Y position
            doc.addPage()
            currentY = margin
          }
          
          // Order Header Box
          doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 30, 4)
            .fillAndStroke('#f0f9ff', '#0284c7')
          
          // Order ID and Customer
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0c4a6e')
          doc.text(`Order #${order.invoiceNumber}`, margin + 12, currentY + 8)
          doc.fontSize(8).font('Helvetica').fillColor('#475569')
          doc.text(`Customer: ${order.customerName}`, margin + 12, currentY + 20)
          
          // Order Status Badge
          const statusText = String(order.status || 'delivered').toUpperCase()
          const statusColor = order.status === 'delivered' ? '#10b981' : '#0284c7'
          doc.roundedRect(pageWidth - margin - 100, currentY + 7, 80, 16, 3)
            .fillAndStroke(statusColor, statusColor)
          doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
          doc.text(statusText, pageWidth - margin - 95, currentY + 11, { width: 70, align: 'center' })
          
          currentY += 38
          
          // Items Table Header
          doc.rect(margin, currentY, pageWidth - 2 * margin, 16).fill('#e2e8f0')
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b')
          doc.text('PRODUCT NAME', margin + 8, currentY + 5, { width: 220 })
          doc.text('QTY', margin + 235, currentY + 5, { width: 40, align: 'right' })
          doc.text('PRICE', margin + 285, currentY + 5, { width: 80, align: 'right' })
          doc.text('TOTAL', margin + 375, currentY + 5, { width: 80, align: 'right' })
          currentY += 16
          
          // Items Rows
          const items = order.items || []
          let orderSubtotal = 0
          items.forEach(item => {
            const itemTotal = Number(item.price) * Number(item.quantity)
            orderSubtotal += itemTotal
            
            doc.rect(margin, currentY, pageWidth - 2 * margin, 14).stroke('#e2e8f0')
            doc.fontSize(7).font('Helvetica').fillColor('#475569')
            doc.text(item.name, margin + 8, currentY + 4, { width: 220, ellipsis: true })
            doc.text(String(item.quantity), margin + 235, currentY + 4, { width: 40, align: 'right' })
            doc.text(formatCurrency(item.price, data.currency), margin + 285, currentY + 4, { width: 80, align: 'right' })
            doc.text(formatCurrency(itemTotal, data.currency), margin + 375, currentY + 4, { width: 80, align: 'right' })
            currentY += 14
          })
          
          // Order Total and Commission Row - compact layout WITHOUT continued (prevents blank pages)
          doc.rect(margin, currentY, pageWidth - 2 * margin, 20).fillAndStroke('#fef9c3', '#eab308')
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#713f12')
          
          const boxWidth = pageWidth - 2 * margin
          const leftText = 'Order Subtotal: ' + formatCurrency(order.subTotal || orderSubtotal, data.currency)
          const rightText = 'Commission: ' + formatCurrency(Number(order.commission) || 0, data.currency)
          
          // Left side: Order Subtotal
          doc.fillColor('#713f12').text(leftText, margin + 8, currentY + 6, { width: boxWidth / 2 - 16 })
          
          // Right side: Commission
          const rightX = margin + boxWidth / 2 + 20
          doc.fillColor('#713f12').text('Commission: ', rightX, currentY + 6, { width: 70, continued: false })
          doc.fillColor('#047857').text(formatCurrency(Number(order.commission) || 0, data.currency), rightX + 72, currentY + 6)
          currentY += 28
          
          // Add spacing between orders
          renderedOrders++
          if (idx < maxOrders - 1) {
            currentY += 8
          }
        }
        
        if (data.orders.length > renderedOrders) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b')
          doc.text(`Showing first ${renderedOrders} of ${data.orders.length} total orders`, margin, currentY, { align: 'center' })
          currentY += 20
        } else {
          currentY += 12
        }
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

      // === COMMISSION CALCULATION EXPLANATION ===
      if (data.driverCommissionRate && data.totalDeliveredOrders) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('COMMISSION CALCULATION', margin, currentY)
        doc.rect(margin, currentY + 14, pageWidth - 2 * margin, 35).fillAndStroke('#f0fdf4', '#86efac')
        doc.fontSize(8).font('Helvetica').fillColor('#166534')
        doc.text(
          `Commission per order: ${formatCurrency(data.driverCommissionRate, data.currency)} \u00d7 ${data.totalDeliveredOrders} orders = ${formatCurrency(data.totalCommission, data.currency)}`,
          margin + 12,
          currentY + 22,
          { width: pageWidth - 2 * margin - 24 }
        )
        doc.text(
          `This commission is calculated based on the driver's commission rate set at driver creation.`,
          margin + 12,
          currentY + 34,
          { width: pageWidth - 2 * margin - 24, oblique: true }
        )
        currentY += 60
      }

      // === SIGNATURE BLOCK ===
      const pageHeight = doc.page.height
      const signatureY = Math.max(currentY + 20, pageHeight - 110)
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
