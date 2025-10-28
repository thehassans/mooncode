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

/**
 * Generate a minimal, premium Commission Payout Statement PDF
 * @param {Object} data - Payout data
 * @param {string} data.driverName - Driver's full name
 * @param {string} data.driverPhone - Driver's phone number
 * @param {number} data.totalDeliveredOrders - Total delivered orders count
 * @param {number} data.totalCommissionPaid - Total commission amount for this payout
 * @param {string} data.currency - Currency code (AED, SAR, etc.)
 * @param {Array} data.orders - Array of orders with: {orderId, deliveryDate, commission}
 * @returns {Promise<string>} PDF file path
 */
export async function generateCommissionPayoutPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const timestamp = Date.now()
      const filename = `commission-payout-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 60,
        bufferPages: true
      })
      const stream = fs.createWriteStream(filepath)
      doc.pipe(stream)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 60
      const contentWidth = pageWidth - (2 * margin)
      let y = margin

      // === LOGO (Top Left) ===
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, margin, y, { width: 50, height: 50, fit: [50, 50] })
        } catch(err) {
          console.error('Logo error:', err)
        }
      }
      y += 80

      // === TITLE ===
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .fillColor('#1e293b')
         .text('Commission Payout Statement', margin, y, {
           width: contentWidth,
           align: 'left'
         })
      y += 50

      // Subtle divider line
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(margin, y)
         .lineTo(pageWidth - margin, y)
         .stroke()
      y += 40

      // === DRIVER DETAILS ===
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#64748b')
         .text('DRIVER DETAILS', margin, y)
      y += 25

      // Driver Name
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#475569')
         .text('Name:', margin, y, { width: 100 })
      doc.font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text(data.driverName || 'N/A', margin + 100, y, { width: contentWidth - 100 })
      y += 25

      // Driver Phone
      if (data.driverPhone) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#475569')
           .text('Phone:', margin, y, { width: 100 })
        doc.font('Helvetica-Bold')
           .fillColor('#0f172a')
           .text(data.driverPhone, margin + 100, y, { width: contentWidth - 100 })
        y += 30
      } else {
        y += 5
      }

      // Divider
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(margin, y)
         .lineTo(pageWidth - margin, y)
         .stroke()
      y += 40

      // === PAYOUT SUMMARY (Prominent Box) ===
      const summaryBoxHeight = 120
      doc.roundedRect(margin, y, contentWidth, summaryBoxHeight, 8)
         .fillAndStroke('#f8fafc', '#cbd5e1')

      y += 25

      // Total Delivered Orders
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Total Delivered Orders', margin + 30, y)
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text(String(data.totalDeliveredOrders || 0), margin + 30, y + 20)

      // Total Commission Paid (Right side)
      const rightX = margin + (contentWidth / 2) + 20
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Total Commission Paid', rightX, y)
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#10b981')
         .text(formatCurrency(data.totalCommissionPaid || 0, data.currency || 'SAR'), rightX, y + 20)

      y += summaryBoxHeight + 40

      // === ORDER DETAILS TABLE ===
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#64748b')
         .text('ORDER DETAILS', margin, y)
      y += 30

      // Table Header
      const tableTop = y
      const col1X = margin
      const col2X = margin + 150
      const col3X = margin + 340

      doc.rect(margin, y, contentWidth, 35)
         .fill('#f1f5f9')

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#475569')
         .text('Order ID', col1X + 15, y + 12)
         .text('Delivery Date', col2X + 15, y + 12)
         .text('Commission Earned', col3X + 15, y + 12)

      y += 35

      // Table Rows
      const orders = data.orders || []
      const rowHeight = 40
      
      orders.forEach((order, index) => {
        // Check if we need a new page
        if (y + rowHeight + 100 > pageHeight - margin) {
          doc.addPage()
          y = margin
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.rect(margin, y, contentWidth, rowHeight)
             .fill('#ffffff')
        } else {
          doc.rect(margin, y, contentWidth, rowHeight)
             .fill('#f8fafc')
        }

        // Row border
        doc.strokeColor('#e2e8f0')
           .lineWidth(0.5)
           .rect(margin, y, contentWidth, rowHeight)
           .stroke()

        // Order ID
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#0f172a')
           .text(order.orderId || 'N/A', col1X + 15, y + 14, {
             width: 135,
             ellipsis: true
           })

        // Delivery Date
        const deliveryDate = order.deliveryDate ? 
          new Date(order.deliveryDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'N/A'
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#475569')
           .text(deliveryDate, col2X + 15, y + 14)

        // Commission Earned
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#10b981')
           .text(formatCurrency(order.commission || 0, data.currency || 'SAR'), col3X + 15, y + 14)

        y += rowHeight
      })

      // === FOOTER / SIGNATURE ===
      const footerY = pageHeight - 120

      // Ensure we're on the same page or add new page if needed
      if (y > footerY - 50) {
        doc.addPage()
        y = margin
      } else {
        y = footerY
      }

      // Divider line
      doc.strokeColor('#cbd5e1')
         .lineWidth(1)
         .moveTo(margin, y)
         .lineTo(pageWidth - margin, y)
         .stroke()
      y += 30

      // Signature section
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Generated on ' + new Date().toLocaleDateString('en-US', {
           month: 'long',
           day: 'numeric',
           year: 'numeric'
         }), margin, y, {
           width: contentWidth,
           align: 'center'
         })
      
      y += 20

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#475569')
         .text('BuySial Commerce', margin, y, {
           width: contentWidth,
           align: 'center'
         })

      // Page numbers
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#94a3b8')
           .text(
             `Page ${i + 1} of ${range.count}`,
             margin,
             pageHeight - 30,
             {
               width: contentWidth,
               align: 'center'
             }
           )
      }

      doc.end()

      stream.on('finish', () => resolve(`/uploads/${filename}`))
      stream.on('error', (err) => reject(err))

    } catch (err) {
      reject(err)
    }
  })
}
