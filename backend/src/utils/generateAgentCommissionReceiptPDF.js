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

      // Premium color palette
      const colors = {
        primary: '#1a1f36',
        secondary: '#0f172a',
        accent: '#3b82f6',
        success: '#059669',
        muted: '#64748b',
        lightBg: '#f8fafc',
        border: '#cbd5e1'
      }

      // === HEADER WITH LOGO ===
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, margin, y, { width: 120, height: 'auto', fit: [120, 50] })
        } catch (err) {
          console.error('Logo error:', err)
        }
      }
      y += 70

      // === DOCUMENT TITLE ===
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Commission Payment Receipt', margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 40

      // Receipt ID and Date
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text(`Receipt ID: ${timestamp}  •  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y, {
           width: contentWidth,
           align: 'center'
         })
      y += 40

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

      y += boxHeight + 30

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
           .text('ORDER ID', col1X + 15, y + 12)
           .text('DATE', col2X + 15, y + 12)
           .text('AMOUNT', col3X + 15, y + 12)

        y += 35

        // Table rows (limit to first 10 for space)
        const displayOrders = data.orders.slice(0, 10)
        const rowHeight = 35

        displayOrders.forEach((order, index) => {
          // Check if we need a new page
          if (y + rowHeight + 100 > pageHeight - margin) {
            doc.addPage()
            y = margin + 50
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

          // Order ID
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

        if (data.orders.length > 10) {
          y += 10
          doc.fontSize(9)
             .font('Helvetica-Oblique')
             .fillColor(colors.muted)
             .text(`... and ${data.orders.length - 10} more orders`, margin, y, {
               width: contentWidth,
               align: 'center'
             })
          y += 20
        }
      }

      // === FOOTER ===
      const footerY = pageHeight - 100

      if (y < footerY - 30) {
        y = footerY
      } else {
        doc.addPage()
        y = margin + 50
      }

      // Thank you message
      doc.roundedRect(margin, y, contentWidth, 70, 10)
         .fillAndStroke(colors.lightBg, colors.border)

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text('Thank You for Your Hard Work!', margin, y + 15, {
           width: contentWidth,
           align: 'center'
         })

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('This commission has been successfully processed and paid.', margin, y + 35, {
           width: contentWidth,
           align: 'center'
         })

      y += 80

      // Company footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('BuySial Commerce  •  Premium Logistics Solutions', margin, y, {
           width: contentWidth,
           align: 'center'
         })

      // Page numbers
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(colors.muted)
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
      stream.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}
