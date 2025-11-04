import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getLogoPath() {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'BuySial2.png'),
    path.join(process.cwd(), 'frontend', 'public', 'BuySial2.png'),
    path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'BuySial2.png'),
  ]
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }
  return null
}

function formatCurrency(val, code = 'PKR') {
  const num = Number(val || 0)
  if (!Number.isFinite(num)) return `${code} 0.00`
  return `${code} ${num.toFixed(2)}`
}

export async function generateAgentCommissionReceiptPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const timestamp = Date.now()
      const filename = `agent-commission-receipt-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: 'Commission Payment Receipt',
          Author: 'BuySial Commerce',
          Subject: 'Agent Commission Receipt'
        }
      })
      const stream = fs.createWriteStream(filepath)
      doc.pipe(stream)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 50
      const contentWidth = pageWidth - (2 * margin)
      let y = margin

      // Premium color palette - matching driver commission
      const colors = {
        primary: '#1a1f36',      // Deep navy
        secondary: '#0f172a',    // Rich black
        accent: '#3b82f6',       // Professional blue
        success: '#059669',      // Rich green
        muted: '#64748b',        // Slate gray
        lightBg: '#f8fafc',      // Soft white
        border: '#cbd5e1'        // Light border
      }

      // === ELITE HEADER ===
      // Top blue accent bar
      doc.rect(0, 0, pageWidth, 6)
         .fillAndStroke(colors.accent, colors.accent)
      
      // Centered logo with premium spacing
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          const logoWidth = 100
          const logoX = (pageWidth - logoWidth) / 2
          doc.image(logoPath, logoX, y, { width: logoWidth, height: 'auto', fit: [logoWidth, 60] })
        } catch (err) {
          console.error('Logo error:', err)
        }
      }
      
      y += 80

      // === ELITE TITLE ===
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Commission Payment Receipt', margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 45
      
      // Elite blue underline
      doc.rect(margin + (contentWidth / 2) - 100, y, 200, 3)
         .fill(colors.accent)
      y += 3

      // Receipt ID and Date
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text(`Receipt ID: ${timestamp}  |  Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y + 15, {
           width: contentWidth,
           align: 'center'
         })
      y += 50

      // === AGENT INFORMATION SECTION ===
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text('AGENT INFORMATION', margin, y)
      y += 20

      // Agent details in two columns
      const leftCol = margin
      const rightCol = margin + (contentWidth / 2)

      // Left column - Name and Contact
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Agent Name', leftCol, y)
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(colors.secondary)
         .text(data.agentName || 'N/A', leftCol, y + 15)

      if (data.agentPhone) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text('Contact', leftCol, y + 35)
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor(colors.secondary)
           .text(data.agentPhone, leftCol, y + 50)
      }

      // Right column - Performance metrics
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Total Orders Submitted', rightCol, y)
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text(String(data.totalSubmitted || 0), rightCol, y + 15)

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Orders Delivered', rightCol, y + 45)
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor(colors.success)
         .text(String(data.totalDelivered || 0), rightCol, y + 60)

      y += 95

      // Divider
      doc.strokeColor(colors.border)
         .lineWidth(1)
         .moveTo(margin, y)
         .lineTo(pageWidth - margin, y)
         .stroke()
      y += 30

      // === PAYMENT SUMMARY ===
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text('PAYMENT SUMMARY', margin, y)
      y += 25

      // Summary box with amounts
      const boxHeight = 100
      doc.roundedRect(margin, y, contentWidth, boxHeight, 10)
         .fillAndStroke(colors.lightBg, colors.border)

      const boxPadding = 20
      let boxY = y + boxPadding

      // Amount in AED
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Amount (AED)', margin + boxPadding, boxY)
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text(formatCurrency(data.amountAED || 0, 'AED'), margin + boxPadding, boxY + 15)

      // Amount in PKR (right side)
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Amount (PKR)', rightCol + boxPadding, boxY)
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor(colors.success)
         .text(formatCurrency(data.amountPKR || 0, 'PKR'), rightCol + boxPadding, boxY + 15)

      y += boxHeight + 10

      // Add commission rate information if provided
      if (data.commissionRate && data.totalOrderValueAED) {
        const pkrRate = 76;
        const totalInPKR = data.totalOrderValueAED * pkrRate;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(colors.accent)
           .text(`Commission: (AED ${formatCurrency(data.totalOrderValueAED, '').trim()} × PKR ${pkrRate}) × ${data.commissionRate}% = PKR ${formatCurrency(data.amountPKR, '').trim()}`, margin, y, {
             width: contentWidth,
             align: 'center'
           })
        y += 25
      } else {
        y += 20
      }

      // === ORDER DETAILS TABLE (if provided) ===
      if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(colors.accent)
           .text('DELIVERED ORDERS BREAKDOWN', margin, y)
        y += 25

        // Table header
        const tableTop = y
        const col1X = margin
        const col2X = margin + 200
        const col3X = margin + 350

        doc.roundedRect(margin, y, contentWidth, 35, 5)
           .fill(colors.primary)

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .text('ORDER NUMBER', col1X + 15, y + 12)
           .text('DATE', col2X + 15, y + 12)
           .text('AMOUNT', col3X + 15, y + 12)

        y += 35

        // Table rows (show all orders)
        const displayOrders = data.orders
        const rowHeight = 35

        displayOrders.forEach((order, index) => {
          // Check if we need a new page
          if (y + rowHeight + 120 > pageHeight - margin) {
            doc.addPage()
            
            // Add blue accent bar on new page
            doc.rect(0, 0, pageWidth, 6)
               .fill(colors.accent)
            
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

          // Order Number
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .fillColor(colors.secondary)
             .text(order.orderId || 'N/A', col1X + 15, y + 12, {
               width: 180,
               ellipsis: true
             })

          // Date
          const orderDate = order.date
            ? new Date(order.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            : 'N/A'

          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(orderDate, col2X + 15, y + 12)

          // Amount
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor(colors.success)
             .text(formatCurrency(order.amount || 0, order.currency || 'AED'), col3X + 15, y + 12)

          y += rowHeight
        })
      }

      // === ELITE FOOTER ===
      const footerY = pageHeight - 120

      if (y < footerY - 30) {
        y = footerY
      } else {
        doc.addPage()
        
        // Add blue accent bar on new page
        doc.rect(0, 0, pageWidth, 6)
           .fill(colors.accent)
        
        y = margin + 20
      }

      // Elite thank you section
      doc.roundedRect(margin, y, contentWidth, 90, 12)
         .lineWidth(2)
         .strokeOpacity(0.1)
         .fillAndStroke(colors.lightBg, colors.border)
      
      // Blue accent at top
      doc.roundedRect(margin, y, contentWidth, 5, 12)
         .fill(colors.accent)
      
      y += 20

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Thank You for Your Hard Work!', margin, y, {
           width: contentWidth,
           align: 'center'
         })

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('This commission has been successfully processed and paid.', margin, y + 25, {
           width: contentWidth,
           align: 'center'
         })
      
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('BuySial Commerce', margin, y + 50, {
           width: contentWidth,
           align: 'center'
         })

      // Premium page numbers with blue accent bars
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        
        // Bottom blue accent bar
        doc.rect(0, pageHeight - 6, pageWidth, 6)
           .fill(colors.accent)
        
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
      stream.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}
