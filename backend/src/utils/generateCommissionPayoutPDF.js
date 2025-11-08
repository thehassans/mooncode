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
        margin: 50,
        bufferPages: true,
        info: {
          Title: 'Commission Payout Statement',
          Author: 'BuySial Commerce',
          Subject: 'Driver Commission Statement'
        }
      })
      const stream = fs.createWriteStream(filepath)
      doc.pipe(stream)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 50
      const contentWidth = pageWidth - (2 * margin)
      let y = margin
      
      // Premium color palette
      const colors = {
        primary: '#1a1f36',      // Deep navy
        secondary: '#0f172a',    // Rich black
        accent: '#d4af37',       // Elegant gold
        success: '#059669',      // Rich green
        muted: '#64748b',        // Slate gray
        lightBg: '#f8fafc',      // Soft white
        border: '#cbd5e1'        // Light border
      }

      // === ELITE HEADER ===
      // Top gold accent bar
      doc.rect(0, 0, pageWidth, 6)
         .fillAndStroke(colors.accent, colors.accent)
      
      // Centered logo with premium spacing
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          const logoWidth = 100
          const logoX = (pageWidth - logoWidth) / 2
          doc.image(logoPath, logoX, y, { width: logoWidth, height: 'auto', fit: [logoWidth, 60] })
        } catch(err) {
          console.error('Logo error:', err)
        }
      }
      
      y += 80

      // === ELEGANT TITLE WITH UNDERLINE ===
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Commission Statement', margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 45
      
      // Premium gold underline
      doc.rect(margin + (contentWidth / 2) - 100, y, 200, 3)
         .fill(colors.accent)
      y += 3
      
      // Document ID and date in elegant box
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text(`Statement ID: ${timestamp}  |  Generated: ${new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}`, margin, y + 15, {
           width: contentWidth,
           align: 'center'
         })
      y += 50

      // === PREMIUM DRIVER DETAILS CARD ===
      const detailsBoxHeight = data.driverPhone ? 100 : 80
      
      // Elegant border box with shadow effect
      doc.roundedRect(margin, y, contentWidth, detailsBoxHeight, 12)
         .lineWidth(2)
         .strokeOpacity(0.1)
         .fillAndStroke(colors.lightBg, colors.border)
      
      // Gold accent bar on left
      doc.rect(margin + 1, y + 1, 4, detailsBoxHeight - 2)
         .fill(colors.accent)
      
      const detailsPadding = 30
      let detailsY = y + 25
      
      // Section title
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text('DRIVER INFORMATION', margin + detailsPadding, detailsY)
      detailsY += 25

      // Driver Name with icon-like bullet
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('• ', margin + detailsPadding, detailsY)
      doc.text('Driver Name:', margin + detailsPadding + 10, detailsY, { continued: true })
      doc.font('Helvetica-Bold')
         .fillColor(colors.secondary)
         .text('  ' + (data.driverName || 'N/A'))
      detailsY += 20

      // Driver Phone
      if (data.driverPhone) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text('• ', margin + detailsPadding, detailsY)
        doc.text('Contact:', margin + detailsPadding + 10, detailsY, { continued: true })
        doc.font('Helvetica-Bold')
           .fillColor(colors.secondary)
           .text('  ' + data.driverPhone)
      }
      
      y += detailsBoxHeight + 35

      // === PREMIUM SUMMARY CARD WITH GOLD ACCENTS ===
      const summaryBoxHeight = 140
      
      // Main summary box with gradient-like effect (layered rectangles)
      doc.roundedRect(margin, y, contentWidth, summaryBoxHeight, 15)
         .lineWidth(2)
         .strokeOpacity(0.1)
         .fillAndStroke('#ffffff', colors.border)
      
      // Gold top border accent
      doc.roundedRect(margin, y, contentWidth, 6, 15)
         .fill(colors.accent)
      
      y += 30

      // Left section - Total Orders
      const leftX = margin + 40
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('TOTAL DELIVERED ORDERS', leftX, y)
      y += 20
      doc.fontSize(40)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text(String(data.totalDeliveredOrders || 0), leftX, y)
      
      // Right section - Total Commission with premium styling
      const rightX = margin + (contentWidth / 2) + 40
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('TOTAL COMMISSION EARNED', rightX, y - 20)
      
      // Large commission amount with gold color
      const commissionText = formatCurrency(data.totalCommissionPaid || 0, data.currency || 'SAR')
      doc.fontSize(40)
         .font('Helvetica-Bold')
         .fillColor(colors.success)
         .text(commissionText, rightX, y)
      
      // Gold checkmark icon (premium verified indicator)
      doc.fontSize(16)
         .fillColor(colors.accent)
         .text('✓ ', rightX + doc.widthOfString(commissionText, { fontSize: 40 }) - 20, y + 10)

      y += 65

      // === PREMIUM ORDER DETAILS TABLE ===
      // Section header with gold accent
      doc.fontSize(13)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('ORDER BREAKDOWN', margin, y)
      
      // Gold underline for section
      doc.rect(margin, y + 18, 80, 2)
         .fill(colors.accent)
      y += 35

      // Table Header with premium styling
      const tableTop = y
      const col1X = margin
      const col2X = margin + 150
      const col3X = margin + 340

      // Header background with gradient effect
      doc.roundedRect(margin, y, contentWidth, 40, 8)
         .fill(colors.primary)

      // Header text in white
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#ffffff')
         .text('ORDER NUMBER', col1X + 20, y + 14)
         .text('DELIVERY DATE', col2X + 20, y + 14)
         .text('COMMISSION', col3X + 20, y + 14)

      y += 40

      // Premium Table Rows
      const orders = data.orders || []
      const rowHeight = 45
      
      orders.forEach((order, index) => {
        // Check if we need a new page
        if (y + rowHeight + 150 > pageHeight - margin) {
          doc.addPage()
          
          // Add gold accent bar on new page
          doc.rect(0, 0, pageWidth, 8)
             .fill(colors.accent)
          
          y = margin + 20
        }

        // Elegant alternating row background
        if (index % 2 === 0) {
          doc.rect(margin, y, contentWidth, rowHeight)
             .fill('#ffffff')
        } else {
          doc.rect(margin, y, contentWidth, rowHeight)
             .fill(colors.lightBg)
        }

        // Subtle row border (bottom only for cleaner look)
        doc.strokeColor(colors.border)
           .strokeOpacity(0.3)
           .lineWidth(1)
           .moveTo(margin, y + rowHeight)
           .lineTo(margin + contentWidth, y + rowHeight)
           .stroke()
           .strokeOpacity(1)

        // Order ID with monospace-like styling
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(colors.secondary)
           .text(order.orderId || 'N/A', col1X + 20, y + 15, {
             width: 130,
             ellipsis: true
           })

        // Delivery Date with elegant formatting
        const deliveryDate = order.deliveryDate ? 
          new Date(order.deliveryDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'N/A'
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text(deliveryDate, col2X + 20, y + 15)

        // Commission with premium green and bold styling
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(colors.success)
           .text(formatCurrency(order.commission || 0, data.currency || 'SAR'), col3X + 20, y + 15)

        y += rowHeight
      })

      // === PREMIUM FOOTER WITH SIGNATURE ===
      const footerY = pageHeight - 140

      // Ensure we're on the same page or add new page if needed
      if (y > footerY - 50) {
        doc.addPage()
        
        // Add gold accent bar on new page
        doc.rect(0, 0, pageWidth, 6)
           .fill(colors.accent)
        
        y = margin + 20
      } else {
        y = footerY
      }

      // Elite signature box with border
      doc.roundedRect(margin, y, contentWidth, 90, 12)
         .lineWidth(2)
         .strokeOpacity(0.1)
         .fillAndStroke(colors.lightBg, colors.border)
      
      // Gold accent at top of signature box
      doc.roundedRect(margin, y, contentWidth, 5, 12)
         .fill(colors.accent)
      
      y += 20
      
      // Signature line
      const sigLineY = y + 25
      const sigLineWidth = 200
      const sigLineX = margin + (contentWidth / 2) - (sigLineWidth / 2)
      
      doc.moveTo(sigLineX, sigLineY)
         .lineTo(sigLineX + sigLineWidth, sigLineY)
         .strokeColor(colors.muted)
         .lineWidth(1.5)
         .stroke()
      
      // Authorized signature text
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Authorized Signature', margin, sigLineY + 10, {
           width: contentWidth,
           align: 'center'
         })
      
      // Company name
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('BuySial Commerce', margin, sigLineY + 35, {
           width: contentWidth,
           align: 'center'
         })

      // Premium page numbers with gold accent bars
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        
        // Bottom gold accent bar
        doc.rect(0, pageHeight - 6, pageWidth, 6)
           .fill(colors.accent)
        
        // Page number with elegant styling
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text(
             `— Page ${i + 1} of ${range.count} —`,
             margin,
             pageHeight - 22,
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
