import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to load the Buysial logo
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
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      // Generate filename
      const timestamp = Date.now()
      const filename = `settlement-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const stream = fs.createWriteStream(filepath)

      doc.pipe(stream)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 50
      let currentY = margin

      // Helper function to draw a box with shadow effect
      const drawBox = (x, y, width, height, fillColor = '#f3f4f6', strokeColor = '#e5e7eb') => {
        // Shadow
        doc.rect(x + 2, y + 2, width, height).fill('#00000015')
        // Main box
        doc.rect(x, y, width, height).fillAndStroke(fillColor, strokeColor)
      }
      
      // Helper to format currency
      const formatCurrency = (amount, curr) => {
        return `${curr} ${Number(amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
      }

      // Helper function for professional table row with alternating colors
      let rowIndex = 0
      const drawTableRow = (y, label, value, isHeader = false) => {
        const x = margin
        const width = pageWidth - 2 * margin
        if (isHeader) {
          // Gradient header
          doc.rect(x, y, width, 28).fillAndStroke('#4338ca', '#3730a3')
          doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
          doc.text(label, x + 12, y + 9, { width: width / 2 - 20 })
          doc.text(value, x + width / 2, y + 9, { width: width / 2 - 12, align: 'right' })
          rowIndex = 0
          return y + 28
        } else {
          // Alternating row colors
          const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
          doc.rect(x, y, width, 24).fillAndStroke(bgColor, '#e5e7eb')
          doc.fillColor('#374151').fontSize(10).font('Helvetica')
          doc.text(label, x + 12, y + 7, { width: width / 2 - 20 })
          doc.fillColor('#111827').font('Helvetica-Bold')
          doc.text(value, x + width / 2, y + 7, { width: width / 2 - 12, align: 'right' })
          rowIndex++
          return y + 24
        }
      }

      // Elite Professional Header with Gradient Effect
      const gradient = doc.linearGradient(0, 0, 0, 90)
      gradient.stop(0, '#1e3a8a')
      gradient.stop(1, '#1e40af')
      doc.rect(0, 0, pageWidth, 90).fill(gradient)
      
      // Add logo in top left corner with border
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, 20, 20, { width: 55, height: 55, fit: [55, 55] })
          doc.roundedRect(18, 18, 59, 59, 3).stroke('#ffffff40')
        } catch (err) {
          console.error('Failed to add logo to PDF:', err)
        }
      }
      
      // Header text with shadow effect
      doc.fillColor('#ffffff30').fontSize(30).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin, 26, { align: 'center' })
      doc.fillColor('white').fontSize(30).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin, 25, { align: 'center' })
      doc.fontSize(11).font('Helvetica')
      doc.fillColor('#e0e7ff')
      doc.text('Complete Financial Summary & Commission Details', margin, 58, { align: 'center' })
      currentY = 105

      // Professional Document Info Box with Icon
      doc.fillColor('black')
      const infoBoxHeight = data.fromDate && data.toDate ? 78 : 60
      drawBox(margin, currentY, pageWidth - 2 * margin, infoBoxHeight, '#fefce8', '#fbbf24')
      
      doc.fontSize(9).font('Helvetica').fillColor('#92400e')
      doc.text('📄 Document ID:', margin + 15, currentY + 14)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#78350f')
      doc.text(`SETTLEMENT-${Date.now()}`, margin + 125, currentY + 14)
      
      doc.fontSize(9).font('Helvetica').fillColor('#92400e')
      doc.text('📅 Generated:', margin + 15, currentY + 32)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#78350f')
      doc.text(new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      }), margin + 125, currentY + 32)
      
      if (data.fromDate && data.toDate) {
        doc.fontSize(9).font('Helvetica').fillColor('#92400e')
        doc.text('📊 Period:', margin + 15, currentY + 50)
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#78350f')
        doc.text(
          `${new Date(data.fromDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} - ${new Date(data.toDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`,
          margin + 125, currentY + 50
        )
      }
      currentY += infoBoxHeight + 15

      // Driver Information Section with Icon
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('👤 DRIVER INFORMATION', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#3b82f6').stroke()
      currentY += 22
      
      currentY = drawTableRow(currentY, 'Information', 'Details', true)
      currentY = drawTableRow(currentY, '👤 Driver Name', data.driverName || 'N/A')
      if (data.driverPhone) {
        currentY = drawTableRow(currentY, '📱 Phone Number', data.driverPhone)
      }
      currentY = drawTableRow(currentY, '👨‍💼 Submitted To', data.managerName || 'N/A')
      currentY += 18

      // Order Statistics Section with Icon
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('📦 ORDER STATISTICS', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#8b5cf6').stroke()
      currentY += 22
      
      currentY = drawTableRow(currentY, 'Metric', 'Count', true)
      if (data.assignedOrders != null) {
        currentY = drawTableRow(currentY, '📋 Total Assigned Orders', String(data.assignedOrders || 0))
      }
      currentY = drawTableRow(currentY, '✅ Delivered Orders', String(data.totalDeliveredOrders || 0))
      if (data.cancelledOrders != null) {
        currentY = drawTableRow(currentY, '❌ Cancelled Orders', String(data.cancelledOrders || 0))
      }
      currentY += 18

      // Financial Summary Section with Icon
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('💰 FINANCIAL SUMMARY', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#10b981').stroke()
      currentY += 22
      
      currentY = drawTableRow(currentY, 'Description', 'Amount', true)
      if (data.collectedAmount != null) {
        currentY = drawTableRow(currentY, '💵 Total Collected from Customers', formatCurrency(data.collectedAmount, data.currency))
      }
      currentY = drawTableRow(currentY, '✅ Already Delivered to Company', formatCurrency(data.deliveredToCompany, data.currency))
      currentY = drawTableRow(currentY, '⏳ Pending Delivery to Company', formatCurrency(data.pendingDeliveryToCompany, data.currency))
      currentY += 18

      // Commission Details Section with Icon and Highlight
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('💎 COMMISSION DETAILS', margin, currentY)
        doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#f59e0b').stroke()
        currentY += 22
        
        currentY = drawTableRow(currentY, 'Commission Type', 'Amount', true)
        if (data.totalCommission != null) {
          currentY = drawTableRow(currentY, '💰 Total Commission Earned', formatCurrency(data.totalCommission, data.currency))
        }
        if (data.paidCommission != null) {
          currentY = drawTableRow(currentY, '✅ Commission Already Paid', formatCurrency(data.paidCommission, data.currency))
        }
        if (data.pendingCommission != null) {
          // Highlight pending commission
          const x = margin
          const width = pageWidth - 2 * margin
          const y = currentY
          doc.rect(x, y, width, 24).fillAndStroke('#fef3c7', '#fbbf24')
          doc.fillColor('#78350f').fontSize(10).font('Helvetica-Bold')
          doc.text('⏳ Pending Commission', x + 12, y + 7, { width: width / 2 - 20 })
          doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11)
          doc.text(formatCurrency(data.pendingCommission, data.currency), x + width / 2, y + 7, { width: width / 2 - 12, align: 'right' })
          currentY += 24
        }
        currentY += 18
      }

      // Current Settlement (Premium Highlighted Box)
      const settlementGradient = doc.linearGradient(margin, currentY, margin, currentY + 42)
      settlementGradient.stop(0, '#059669')
      settlementGradient.stop(1, '#047857')
      
      // Shadow
      doc.rect(margin + 3, currentY + 3, pageWidth - 2 * margin, 42).fill('#00000020')
      
      // Main box
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 42, 6).fillAndStroke(settlementGradient, '#065f46')
      
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
      doc.text('💵 CURRENT SETTLEMENT AMOUNT', margin + 18, currentY + 12)
      doc.fontSize(20).font('Helvetica-Bold')
      doc.text(formatCurrency(data.amount, data.currency), margin, currentY + 12, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 18 
      })
      currentY += 56

      // Payment Details
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('💳 PAYMENT DETAILS', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#6366f1').stroke()
      currentY += 22
      
      rowIndex = 0
      currentY = drawTableRow(currentY, '💳 Payment Method', data.method === 'transfer' ? '🏦 Bank Transfer' : '🤝 Hand Delivery')
      if (data.note) {
        currentY = drawTableRow(currentY, '📝 Note', data.note)
      }
      currentY += 18

      // Payment Proof (if transfer)
      if (data.method === 'transfer' && data.receiptPath) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('📸 PAYMENT PROOF', margin, currentY)
        doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#ec4899').stroke()
        currentY += 22
        
        try {
          const receiptFullPath = path.join(process.cwd(), data.receiptPath)
          if (fs.existsSync(receiptFullPath)) {
            // Add border around image
            const imgX = margin + 20
            const imgY = currentY + 5
            doc.roundedRect(imgX - 5, imgY - 5, 410, 310, 6).stroke('#d1d5db')
            doc.image(receiptFullPath, imgX, imgY, {
              fit: [400, 300],
              align: 'center'
            })
            currentY += 325
          } else {
            doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
            doc.text('📎 Payment proof image attached separately', margin, currentY, { align: 'center' })
            currentY += 30
          }
        } catch (imgErr) {
          console.error('Error adding image to PDF:', imgErr)
          doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
          doc.text('📎 Payment proof image attached separately', margin, currentY, { align: 'center' })
          currentY += 30
        }
      }

      // Professional Footer with Gradient
      const footerY = pageHeight - 65
      const footerGradient = doc.linearGradient(0, footerY, 0, pageHeight)
      footerGradient.stop(0, '#f9fafb')
      footerGradient.stop(1, '#e5e7eb')
      doc.rect(0, footerY, pageWidth, 65).fill(footerGradient)
      
      // Divider line
      doc.moveTo(0, footerY).lineTo(pageWidth, footerY).lineWidth(1).strokeColor('#d1d5db').stroke()
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#4b5563')
      doc.text('🔒 CONFIDENTIAL DOCUMENT', margin, footerY + 12, { align: 'center' })
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
      doc.text('This is a system-generated document. No signature required.', margin, footerY + 26, { align: 'center' })
      doc.fontSize(7).fillColor('#9ca3af')
      doc.text('For any queries, please contact your manager or admin.', margin, footerY + 38, { align: 'center' })
      doc.fontSize(7).fillColor('#9ca3af')
      doc.text(`📅 Generated: ${new Date().toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})} • BuySial Commerce`, margin, footerY + 50, { align: 'center' })

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

/**
 * Generate accepted settlement PDF with ACCEPTED stamp
 * @param {Object} data - Same data as generateSettlementPDF plus acceptedBy and acceptedDate
 * @returns {Promise<string>} PDF file path
 */
export async function generateAcceptedSettlementPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      // Generate filename
      const timestamp = Date.now()
      const filename = `settlement-accepted-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const stream = fs.createWriteStream(filepath)

      doc.pipe(stream)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 50
      let currentY = margin

      // Helper function to draw a box with shadow effect
      const drawBox = (x, y, width, height, fillColor = '#f3f4f6', strokeColor = '#e5e7eb') => {
        // Shadow
        doc.rect(x + 2, y + 2, width, height).fill('#00000015')
        // Main box
        doc.rect(x, y, width, height).fillAndStroke(fillColor, strokeColor)
      }
      
      // Helper to format currency
      const formatCurrency = (amount, curr) => {
        return `${curr} ${Number(amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
      }

      // Helper function for professional table row with alternating colors
      let rowIndex = 0
      const drawTableRow = (y, label, value, isHeader = false) => {
        const x = margin
        const width = pageWidth - 2 * margin
        if (isHeader) {
          // Gradient header
          doc.rect(x, y, width, 28).fillAndStroke('#4338ca', '#3730a3')
          doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
          doc.text(label, x + 12, y + 9, { width: width / 2 - 20 })
          doc.text(value, x + width / 2, y + 9, { width: width / 2 - 12, align: 'right' })
          rowIndex = 0
          return y + 28
        } else {
          // Alternating row colors
          const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
          doc.rect(x, y, width, 24).fillAndStroke(bgColor, '#e5e7eb')
          doc.fillColor('#374151').fontSize(10).font('Helvetica')
          doc.text(label, x + 12, y + 7, { width: width / 2 - 20 })
          doc.fillColor('#111827').font('Helvetica-Bold')
          doc.text(value, x + width / 2, y + 7, { width: width / 2 - 12, align: 'right' })
          rowIndex++
          return y + 24
        }
      }

      // Elite Professional Header with Gradient Effect
      const gradient = doc.linearGradient(0, 0, 0, 90)
      gradient.stop(0, '#1e3a8a')
      gradient.stop(1, '#1e40af')
      doc.rect(0, 0, pageWidth, 90).fill(gradient)
      
      // Add logo in top left corner with border
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, 20, 20, { width: 55, height: 55, fit: [55, 55] })
          doc.roundedRect(18, 18, 59, 59, 3).stroke('#ffffff40')
        } catch (err) {
          console.error('Failed to add logo to PDF:', err)
        }
      }
      
      // Header text with shadow effect
      doc.fillColor('#ffffff30').fontSize(30).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin, 26, { align: 'center' })
      doc.fillColor('white').fontSize(30).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin, 25, { align: 'center' })
      doc.fontSize(11).font('Helvetica')
      doc.fillColor('#e0e7ff')
      doc.text('Complete Financial Summary & Commission Details', margin, 58, { align: 'center' })
      currentY = 105

      // === ACCEPTED SEAL WATERMARK ===
      // Add transparent circular "ACCEPTED" seal as watermark overlay
      doc.save()
      
      // Center position for seal
      const sealCenterX = pageWidth / 2 + 120
      const sealCenterY = 250
      const sealRadius = 65
      
      // Outer decorative circle (badge style)
      for (let i = 0; i < 24; i++) {
        const angle = (i * 15) * Math.PI / 180
        const x1 = sealCenterX + Math.cos(angle) * (sealRadius + 8)
        const y1 = sealCenterY + Math.sin(angle) * (sealRadius + 8)
        const x2 = sealCenterX + Math.cos(angle) * (sealRadius + 12)
        const y2 = sealCenterY + Math.sin(angle) * (sealRadius + 12)
        doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(3).strokeColor('#059669').fillOpacity(0.15).stroke()
      }
      
      // Outer circle
      doc.circle(sealCenterX, sealCenterY, sealRadius + 5)
         .lineWidth(4)
         .strokeColor('#059669')
         .fillOpacity(0.05)
         .fillAndStroke('#059669', '#047857')
      
      // Middle circle
      doc.circle(sealCenterX, sealCenterY, sealRadius - 5)
         .lineWidth(2)
         .strokeColor('#10b981')
         .fillOpacity(0)
         .stroke()
      
      // Inner circle (background for checkmark)
      doc.circle(sealCenterX, sealCenterY, sealRadius - 18)
         .lineWidth(0)
         .fillColor('#059669')
         .fillOpacity(0.15)
         .fill()
      
      // Draw checkmark
      doc.lineWidth(8)
         .strokeColor('#059669')
         .fillOpacity(0.2)
      doc.moveTo(sealCenterX - 20, sealCenterY)
         .lineTo(sealCenterX - 8, sealCenterY + 15)
         .lineTo(sealCenterX + 20, sealCenterY - 20)
         .stroke()
      
      // "ACCEPTED" text on top arc
      doc.fillOpacity(0.18)
      doc.fillColor('#059669')
      doc.fontSize(14).font('Helvetica-Bold')
      
      // Top text "ACCEPTED"
      const topText = 'ACCEPTED'
      for (let i = 0; i < topText.length; i++) {
        const angle = -75 + (i * 18) // Spread letters along arc
        const rad = angle * Math.PI / 180
        const x = sealCenterX + Math.sin(rad) * (sealRadius - 15)
        const y = sealCenterY - Math.cos(rad) * (sealRadius - 15)
        
        doc.save()
        doc.translate(x, y)
        doc.rotate(angle, { origin: [0, 0] })
        doc.text(topText[i], -4, -6, { width: 10, align: 'center' })
        doc.restore()
      }
      
      // Bottom text "ACCEPTED"
      const bottomText = 'ACCEPTED'
      for (let i = 0; i < bottomText.length; i++) {
        const angle = 105 + (i * 18) // Spread letters along arc
        const rad = angle * Math.PI / 180
        const x = sealCenterX + Math.sin(rad) * (sealRadius - 15)
        const y = sealCenterY - Math.cos(rad) * (sealRadius - 15)
        
        doc.save()
        doc.translate(x, y)
        doc.rotate(angle, { origin: [0, 0] })
        doc.text(bottomText[i], -4, -6, { width: 10, align: 'center' })
        doc.restore()
      }
      
      doc.restore()
      doc.fillOpacity(1)
      // === END SEAL ===

      // Professional Document Info Box with Icon
      doc.fillColor('black')
      const infoBoxHeight = data.fromDate && data.toDate ? 95 : 78
      drawBox(margin, currentY, pageWidth - 2 * margin, infoBoxHeight, '#d1fae5', '#10b981')
      
      doc.fontSize(9).font('Helvetica').fillColor('#065f46')
      doc.text('📄 Document ID:', margin + 15, currentY + 14)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#047857')
      doc.text(`SETTLEMENT-${Date.now()}`, margin + 125, currentY + 14)
      
      doc.fontSize(9).font('Helvetica').fillColor('#065f46')
      doc.text('📅 Generated:', margin + 15, currentY + 32)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#047857')
      doc.text(new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      }), margin + 125, currentY + 32)
      
      doc.fontSize(9).font('Helvetica').fillColor('#065f46')
      doc.text('✅ Accepted:', margin + 15, currentY + 50)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#047857')
      doc.text(new Date(data.acceptedDate || Date.now()).toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      }), margin + 125, currentY + 50)
      
      if (data.fromDate && data.toDate) {
        doc.fontSize(9).font('Helvetica').fillColor('#065f46')
        doc.text('📊 Period:', margin + 15, currentY + 68)
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#047857')
        doc.text(
          `${new Date(data.fromDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} - ${new Date(data.toDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`,
          margin + 125, currentY + 68
        )
      }
      
      // Status badge
      doc.roundedRect(margin + 15, currentY + infoBoxHeight - 22, 100, 18, 4)
         .fillAndStroke('#059669', '#047857')
      doc.fontSize(10).font('Helvetica-Bold').fillColor('white')
      doc.text('✓ ACCEPTED', margin + 32, currentY + infoBoxHeight - 18)
      
      currentY += infoBoxHeight + 15

      // Driver Information Section with Icon
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('👤 DRIVER INFORMATION', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#3b82f6').stroke()
      currentY += 22
      
      currentY = drawTableRow(currentY, 'Information', 'Details', true)
      currentY = drawTableRow(currentY, '👤 Driver Name', data.driverName || 'N/A')
      if (data.driverPhone) {
        currentY = drawTableRow(currentY, '📱 Phone Number', data.driverPhone)
      }
      currentY = drawTableRow(currentY, '👨‍💼 Submitted To', data.managerName || 'N/A')
      currentY += 18

      // Order Statistics Section with Icon
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('📦 ORDER STATISTICS', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#8b5cf6').stroke()
      currentY += 22
      
      currentY = drawTableRow(currentY, 'Metric', 'Count', true)
      if (data.assignedOrders != null) {
        currentY = drawTableRow(currentY, '📋 Total Assigned Orders', String(data.assignedOrders || 0))
      }
      currentY = drawTableRow(currentY, '✅ Delivered Orders', String(data.totalDeliveredOrders || 0))
      if (data.cancelledOrders != null) {
        currentY = drawTableRow(currentY, '❌ Cancelled Orders', String(data.cancelledOrders || 0))
      }
      currentY += 18

      // Financial Summary Section with Icon
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('💰 FINANCIAL SUMMARY', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#10b981').stroke()
      currentY += 22
      
      currentY = drawTableRow(currentY, 'Description', 'Amount', true)
      if (data.collectedAmount != null) {
        currentY = drawTableRow(currentY, '💵 Total Collected from Customers', formatCurrency(data.collectedAmount, data.currency))
      }
      currentY = drawTableRow(currentY, '✅ Already Delivered to Company', formatCurrency(data.deliveredToCompany, data.currency))
      currentY = drawTableRow(currentY, '⏳ Pending Delivery to Company', formatCurrency(data.pendingDeliveryToCompany, data.currency))
      currentY += 18

      // Commission Details Section with Icon and Highlight
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('💎 COMMISSION DETAILS', margin, currentY)
        doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#f59e0b').stroke()
        currentY += 22
        
        currentY = drawTableRow(currentY, 'Commission Type', 'Amount', true)
        if (data.totalCommission != null) {
          currentY = drawTableRow(currentY, '💰 Total Commission Earned', formatCurrency(data.totalCommission, data.currency))
        }
        if (data.paidCommission != null) {
          currentY = drawTableRow(currentY, '✅ Commission Already Paid', formatCurrency(data.paidCommission, data.currency))
        }
        if (data.pendingCommission != null) {
          // Highlight pending commission
          const x = margin
          const width = pageWidth - 2 * margin
          const y = currentY
          doc.rect(x, y, width, 24).fillAndStroke('#fef3c7', '#fbbf24')
          doc.fillColor('#78350f').fontSize(10).font('Helvetica-Bold')
          doc.text('⏳ Pending Commission', x + 12, y + 7, { width: width / 2 - 20 })
          doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11)
          doc.text(formatCurrency(data.pendingCommission, data.currency), x + width / 2, y + 7, { width: width / 2 - 12, align: 'right' })
          currentY += 24
        }
        currentY += 18
      }

      // Current Settlement (Premium Highlighted Box) - Changed to green for accepted
      const settlementGradient = doc.linearGradient(margin, currentY, margin, currentY + 42)
      settlementGradient.stop(0, '#059669')
      settlementGradient.stop(1, '#047857')
      
      // Shadow
      doc.rect(margin + 3, currentY + 3, pageWidth - 2 * margin, 42).fill('#00000020')
      
      // Main box
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 42, 6).fillAndStroke(settlementGradient, '#065f46')
      
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
      doc.text('💵 ACCEPTED SETTLEMENT AMOUNT', margin + 18, currentY + 12)
      doc.fontSize(20).font('Helvetica-Bold')
      doc.text(formatCurrency(data.amount, data.currency), margin, currentY + 12, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 18 
      })
      currentY += 56

      // Payment Details
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text('💳 PAYMENT DETAILS', margin, currentY)
      doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#6366f1').stroke()
      currentY += 22
      
      rowIndex = 0
      currentY = drawTableRow(currentY, '💳 Payment Method', data.method === 'transfer' ? '🏦 Bank Transfer' : '🤝 Hand Delivery')
      if (data.note) {
        currentY = drawTableRow(currentY, '📝 Note', data.note)
      }
      if (data.acceptedBy) {
        currentY = drawTableRow(currentY, '✅ Accepted By', data.acceptedBy)
      }
      currentY += 18

      // Payment Proof (if transfer)
      if (data.method === 'transfer' && data.receiptPath) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('📸 PAYMENT PROOF', margin, currentY)
        doc.moveTo(margin, currentY + 16).lineTo(pageWidth - margin, currentY + 16).lineWidth(2).strokeColor('#ec4899').stroke()
        currentY += 22
        
        try {
          const receiptFullPath = path.join(process.cwd(), data.receiptPath)
          if (fs.existsSync(receiptFullPath)) {
            // Add border around image
            const imgX = margin + 20
            const imgY = currentY + 5
            doc.roundedRect(imgX - 5, imgY - 5, 410, 310, 6).stroke('#d1d5db')
            doc.image(receiptFullPath, imgX, imgY, {
              fit: [400, 300],
              align: 'center'
            })
            currentY += 325
          } else {
            doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
            doc.text('📎 Payment proof image attached separately', margin, currentY, { align: 'center' })
            currentY += 30
          }
        } catch (imgErr) {
          console.error('Error adding image to PDF:', imgErr)
          doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
          doc.text('📎 Payment proof image attached separately', margin, currentY, { align: 'center' })
          currentY += 30
        }
      }

      // Professional Footer with Gradient
      const footerY = pageHeight - 65
      const footerGradient = doc.linearGradient(0, footerY, 0, pageHeight)
      footerGradient.stop(0, '#d1fae5')
      footerGradient.stop(1, '#a7f3d0')
      doc.rect(0, footerY, pageWidth, 65).fill(footerGradient)
      
      // Divider line
      doc.moveTo(0, footerY).lineTo(pageWidth, footerY).lineWidth(1).strokeColor('#10b981').stroke()
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#047857')
      doc.text('✓ ACCEPTED & VERIFIED DOCUMENT', margin, footerY + 12, { align: 'center' })
      doc.fontSize(8).font('Helvetica').fillColor('#065f46')
      doc.text('This settlement has been accepted and verified by the company.', margin, footerY + 26, { align: 'center' })
      doc.fontSize(7).fillColor('#059669')
      doc.text('For any queries, please contact your manager or admin.', margin, footerY + 38, { align: 'center' })
      doc.fontSize(7).fillColor('#059669')
      doc.text(`📅 Accepted: ${new Date(data.acceptedDate || Date.now()).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})} • BuySial Commerce`, margin, footerY + 50, { align: 'center' })

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
