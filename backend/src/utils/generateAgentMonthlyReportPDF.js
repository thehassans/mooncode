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
 * Generate an elite monthly report PDF for agents
 * @param {Object} data - Report data
 * @param {string} data.agentName - Agent's full name
 * @param {string} data.agentEmail - Agent's email
 * @param {string} data.agentPhone - Agent's phone
 * @param {string} data.month - Month in YYYY-MM format
 * @param {number} data.ordersSubmitted - Total submitted orders
 * @param {number} data.ordersDelivered - Total delivered orders
 * @param {number} data.ordersCancelled - Total cancelled orders
 * @param {number} data.ordersReturned - Total returned orders
 * @param {number} data.totalCommission - Total commission earned
 * @param {string} data.currency - Currency code
 * @param {Array} data.deliveredOrders - Array of delivered order details
 * @returns {Promise<string>} PDF file path
 */
export async function generateAgentMonthlyReportPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const timestamp = Date.now()
      const filename = `agent-monthly-report-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true,
        info: {
          Title: 'Agent Monthly Report',
          Author: 'BuySial Commerce',
          Subject: 'Agent Performance Report'
        }
      })
      const stream = fs.createWriteStream(filepath)
      doc.pipe(stream)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 40
      const contentWidth = pageWidth - (2 * margin)
      let y = margin

      // Elite color palette
      const colors = {
        primary: '#1e3a8a',      // Royal blue
        secondary: '#0f172a',    // Deep black
        accent: '#d4af37',       // Premium gold
        success: '#059669',      // Rich green
        warning: '#f59e0b',      // Amber
        danger: '#dc2626',       // Red
        muted: '#64748b',        // Slate
        lightBg: '#f8fafc',      // Soft white
        border: '#cbd5e1'        // Light border
      }

      // === PREMIUM HEADER WITH GRADIENT ===
      // Top gold accent strip
      doc.rect(0, 0, pageWidth, 8)
         .fillAndStroke(colors.accent, colors.accent)
      
      y += 15

      // Centered logo
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          const logoWidth = 90
          const logoX = (pageWidth - logoWidth) / 2
          doc.image(logoPath, logoX, y, { width: logoWidth, height: 'auto', fit: [logoWidth, 55] })
        } catch(err) {
          console.error('Logo error:', err)
        }
      }
      
      y += 70

      // === ELITE TITLE ===
      doc.fontSize(34)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Agent Monthly Report', margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 45
      
      // Premium gold underline
      const underlineWidth = 240
      doc.rect((pageWidth - underlineWidth) / 2, y, underlineWidth, 3)
         .fill(colors.accent)
      y += 20
      
      // Month and date info
      const monthName = new Date(data.month + '-01').toLocaleDateString('en-US', {month: 'long', year: 'numeric'})
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(colors.muted)
         .text(`Report Period: ${monthName}`, margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 16
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text(`Generated: ${new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'})}`, margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 35

      // === PREMIUM AGENT INFO CARD ===
      const agentBoxHeight = data.agentPhone ? 110 : 90
      
      doc.roundedRect(margin, y, contentWidth, agentBoxHeight, 14)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke(colors.lightBg, colors.border)
      
      // Gold left accent bar
      doc.rect(margin + 1, y + 1, 5, agentBoxHeight - 2)
         .fill(colors.accent)
      
      let infoY = y + 22
      const infoX = margin + 25
      
      // Section title
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text('AGENT INFORMATION', infoX, infoY)
      infoY += 28

      // Agent Name
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Name:', infoX, infoY)
      doc.font('Helvetica-Bold')
         .fillColor(colors.secondary)
         .text(data.agentName || 'N/A', infoX + 80, infoY)
      infoY += 20

      // Email
      if (data.agentEmail) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text('Email:', infoX, infoY)
        doc.font('Helvetica-Bold')
           .fillColor(colors.secondary)
           .text(data.agentEmail, infoX + 80, infoY)
        infoY += 20
      }

      // Phone
      if (data.agentPhone) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text('Phone:', infoX, infoY)
        doc.font('Helvetica-Bold')
           .fillColor(colors.secondary)
           .text(data.agentPhone, infoX + 80, infoY)
      }
      
      y += agentBoxHeight + 30

      // === PREMIUM PERFORMANCE METRICS GRID ===
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('PERFORMANCE OVERVIEW', margin, y)
      
      doc.rect(margin, y + 20, 100, 2)
         .fill(colors.accent)
      y += 35

      // 2x2 Grid of metrics
      const metricSize = (contentWidth - 20) / 2
      const metricHeight = 110
      
      // Row 1
      let metricX = margin
      let metricY = y

      // Submitted Orders
      doc.roundedRect(metricX, metricY, metricSize, metricHeight, 10)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke('#ffffff', colors.border)
      doc.roundedRect(metricX, metricY, metricSize, 6, 10)
         .fill('#3b82f6')
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(colors.muted)
         .text('ORDERS SUBMITTED', metricX + 20, metricY + 25)
      doc.fontSize(44)
         .font('Helvetica-Bold')
         .fillColor('#3b82f6')
         .text(String(data.ordersSubmitted || 0), metricX + 20, metricY + 48)

      // Delivered Orders
      metricX += metricSize + 20
      doc.roundedRect(metricX, metricY, metricSize, metricHeight, 10)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke('#ffffff', colors.border)
      doc.roundedRect(metricX, metricY, metricSize, 6, 10)
         .fill(colors.success)
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(colors.muted)
         .text('ORDERS DELIVERED', metricX + 20, metricY + 25)
      doc.fontSize(44)
         .font('Helvetica-Bold')
         .fillColor(colors.success)
         .text(String(data.ordersDelivered || 0), metricX + 20, metricY + 48)

      // Row 2
      metricX = margin
      metricY += metricHeight + 15

      // Cancelled Orders
      doc.roundedRect(metricX, metricY, metricSize, metricHeight, 10)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke('#ffffff', colors.border)
      doc.roundedRect(metricX, metricY, metricSize, 6, 10)
         .fill(colors.warning)
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(colors.muted)
         .text('ORDERS CANCELLED', metricX + 20, metricY + 25)
      doc.fontSize(44)
         .font('Helvetica-Bold')
         .fillColor(colors.warning)
         .text(String(data.ordersCancelled || 0), metricX + 20, metricY + 48)

      // Returned Orders
      metricX += metricSize + 20
      doc.roundedRect(metricX, metricY, metricSize, metricHeight, 10)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke('#ffffff', colors.border)
      doc.roundedRect(metricX, metricY, metricSize, 6, 10)
         .fill(colors.danger)
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(colors.muted)
         .text('ORDERS RETURNED', metricX + 20, metricY + 25)
      doc.fontSize(44)
         .font('Helvetica-Bold')
         .fillColor(colors.danger)
         .text(String(data.ordersReturned || 0), metricX + 20, metricY + 48)

      y = metricY + metricHeight + 30

      // === COMMISSION SUMMARY ===
      doc.roundedRect(margin, y, contentWidth, 85, 12)
         .lineWidth(2)
         .fillAndStroke(colors.success, colors.success)
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('white')
         .text('TOTAL COMMISSION EARNED', margin + 30, y + 20)
      
      doc.fontSize(38)
         .font('Helvetica-Bold')
         .fillColor('white')
         .text(formatCurrency(data.totalCommission || 0, data.currency || 'PKR'), margin + 30, y + 42)

      y += 100

      // === DELIVERED ORDERS DETAILS ===
      if (data.deliveredOrders && data.deliveredOrders.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(colors.primary)
           .text('DELIVERED ORDERS DETAILS', margin, y)
        
        doc.rect(margin, y + 20, 130, 2)
           .fill(colors.accent)
        y += 35

        // Table header
        const col1X = margin
        const col2X = margin + 100
        const col3X = margin + 240
        const col4X = margin + 370

        doc.roundedRect(margin, y, contentWidth, 38, 8)
           .fill(colors.primary)

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('white')
           .text('ORDER #', col1X + 15, y + 13)
           .text('CUSTOMER', col2X + 15, y + 13)
           .text('DATE', col3X + 15, y + 13)
           .text('COMMISSION', col4X + 15, y + 13)

        y += 38

        // Table rows
        const rowHeight = 40

        data.deliveredOrders.forEach((order, index) => {
          // Check if we need a new page
          if (y + rowHeight + 100 > pageHeight - margin) {
            doc.addPage()
            doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
            y = margin + 20
          }

          // Alternating row background
          if (index % 2 === 0) {
            doc.rect(margin, y, contentWidth, rowHeight).fill('#ffffff')
          } else {
            doc.rect(margin, y, contentWidth, rowHeight).fill(colors.lightBg)
          }

          // Bottom border
          doc.strokeColor(colors.border)
             .strokeOpacity(0.3)
             .lineWidth(1)
             .moveTo(margin, y + rowHeight)
             .lineTo(margin + contentWidth, y + rowHeight)
             .stroke()
             .strokeOpacity(1)

          // Order data
          doc.fontSize(9)
             .font('Helvetica-Bold')
             .fillColor(colors.secondary)
             .text(order.invoiceNumber || 'N/A', col1X + 15, y + 13, {
               width: 80,
               ellipsis: true
             })

          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(order.customerName || 'N/A', col2X + 15, y + 13, {
               width: 120,
               ellipsis: true
             })

          const orderDate = order.deliveredAt ? 
            new Date(order.deliveredAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }) : 'N/A'
          
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(orderDate, col3X + 15, y + 13)

          doc.fontSize(10)
             .font('Helvetica-Bold')
             .fillColor(colors.success)
             .text(formatCurrency(order.commission || 0, data.currency || 'PKR'), col4X + 15, y + 13)

          y += rowHeight
        })

        // Show total count
        y += 10
        doc.fontSize(9)
           .font('Helvetica-Oblique')
           .fillColor(colors.muted)
           .text(`Showing ${data.deliveredOrders.length}/${data.deliveredOrders.length} total delivered orders`, margin, y, {
             width: contentWidth,
             align: 'center'
           })
        y += 20
      }

      // === PREMIUM FOOTER ===
      const footerY = pageHeight - 120

      if (y > footerY - 40) {
        doc.addPage()
        doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
        y = margin + 20
      } else {
        y = footerY
      }

      // Signature box
      doc.roundedRect(margin, y, contentWidth, 80, 12)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke(colors.lightBg, colors.border)
      
      doc.roundedRect(margin, y, contentWidth, 6, 12)
         .fill(colors.accent)
      
      const sigLineY = y + 35
      const sigLineWidth = 200
      const sigLineX = margin + (contentWidth / 2) - (sigLineWidth / 2)
      
      doc.moveTo(sigLineX, sigLineY)
         .lineTo(sigLineX + sigLineWidth, sigLineY)
         .strokeColor(colors.muted)
         .lineWidth(1.5)
         .stroke()
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Qadeer Hussain', margin, sigLineY + 12, {
           width: contentWidth,
           align: 'center'
         })
      
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('This is a system-generated report', margin, sigLineY + 35, {
           width: contentWidth,
           align: 'center'
         })

      // Page numbers - add to existing pages only
      const range = doc.bufferedPageRange()
      const totalPages = range.count
      
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i)
        
        // Add bottom gold bar
        doc.rect(0, pageHeight - 8, pageWidth, 8)
           .fill(colors.accent)
        
        // Add page number text
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(colors.muted)
        
        // Use absolute positioning to avoid creating new content flow
        const textY = pageHeight - 25
        doc.text(
          `— Page ${i + 1} of ${totalPages} —`,
          0,
          textY,
          {
            width: pageWidth,
            align: 'center',
            lineBreak: false
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
