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
 * Generate an elite monthly report PDF for drivers
 * @param {Object} data - Report data
 * @param {string} data.driverName - Driver's full name
 * @param {string} data.driverPhone - Driver's phone
 * @param {string} data.month - Month in YYYY-MM format
 * @param {number} data.ordersAssigned - Total assigned orders
 * @param {number} data.ordersDelivered - Total delivered orders
 * @param {number} data.ordersCancelled - Total cancelled orders
 * @param {number} data.ordersReturned - Total returned orders
 * @param {number} data.cancelledSubmittedAmount - Amount from cancelled orders submitted to company
 * @param {number} data.cancelledAcceptedAmount - Amount from cancelled orders accepted by company
 * @param {number} data.returnedSubmittedAmount - Amount from returned orders submitted to company
 * @param {number} data.returnedAcceptedAmount - Amount from returned orders accepted by company
 * @param {number} data.totalCommission - Total commission earned
 * @param {string} data.currency - Currency code
 * @param {Array} data.deliveredOrders - Array of delivered order details
 * @returns {Promise<string>} PDF file path
 */
export async function generateDriverMonthlyReportPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const timestamp = Date.now()
      const filename = `driver-monthly-report-${timestamp}.pdf`
      const filepath = path.join(uploadsDir, filename)

      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true,
        info: {
          Title: 'Driver Monthly Report',
          Author: 'BuySial Commerce',
          Subject: 'Driver Performance Report'
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
         .text('Driver Monthly Report', margin, y, {
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

      // === PREMIUM DRIVER INFO CARD ===
      const driverBoxHeight = data.driverPhone ? 90 : 70
      
      doc.roundedRect(margin, y, contentWidth, driverBoxHeight, 14)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke(colors.lightBg, colors.border)
      
      // Gold left accent bar
      doc.rect(margin + 1, y + 1, 5, driverBoxHeight - 2)
         .fill(colors.accent)
      
      let infoY = y + 22
      const infoX = margin + 25
      
      // Section title
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(colors.accent)
         .text('DRIVER INFORMATION', infoX, infoY)
      infoY += 28

      // Driver Name
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.muted)
         .text('Name:', infoX, infoY)
      doc.font('Helvetica-Bold')
         .fillColor(colors.secondary)
         .text(data.driverName || 'N/A', infoX + 80, infoY)
      
      // Phone (same line if space, or next line)
      if (data.driverPhone) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text('Phone:', infoX + 280, infoY)
        doc.font('Helvetica-Bold')
           .fillColor(colors.secondary)
           .text(data.driverPhone, infoX + 330, infoY)
      }
      
      y += driverBoxHeight + 30

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

      // Assigned Orders
      doc.roundedRect(metricX, metricY, metricSize, metricHeight, 10)
         .lineWidth(2)
         .strokeOpacity(0.15)
         .fillAndStroke('#ffffff', colors.border)
      doc.roundedRect(metricX, metricY, metricSize, 6, 10)
         .fill('#6366f1')
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(colors.muted)
         .text('ORDERS ASSIGNED', metricX + 20, metricY + 25)
      doc.fontSize(44)
         .font('Helvetica-Bold')
         .fillColor('#6366f1')
         .text(String(data.ordersAssigned || 0), metricX + 20, metricY + 48)

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

      // === REMITTANCE ACCOUNTABILITY SECTION (NEW) ===
      if (data.ordersCancelled > 0 || data.ordersReturned > 0) {
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(colors.primary)
           .text('REMITTANCE ACCOUNTABILITY', margin, y)
        
        doc.rect(margin, y + 20, 140, 2)
           .fill(colors.accent)
        y += 35

        const remitBoxHeight = 170
        
        // Cancelled Orders Remittance
        if (data.ordersCancelled > 0) {
          doc.roundedRect(margin, y, contentWidth, remitBoxHeight, 12)
             .lineWidth(2)
             .strokeOpacity(0.15)
             .fillAndStroke('#fffbeb', '#fbbf24')
          
          let remitY = y + 20
          
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor(colors.warning)
             .text('CANCELLED ORDERS - STATUS', margin + 25, remitY)
          remitY += 28

          // Orders Cancelled
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text('Orders Cancelled:', margin + 25, remitY)
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.secondary)
             .text(String(data.ordersCancelled || 0), margin + 220, remitY)
          remitY += 22

          // Orders Submitted to Company
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text('Orders Submitted to Company:', margin + 25, remitY)
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.secondary)
             .text(String(data.cancelledSubmittedCount || 0), margin + 220, remitY)
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(`(${formatCurrency(data.cancelledSubmittedAmount || 0, data.currency || 'SAR')})`, margin + 250, remitY)
          remitY += 22

          // Orders Accepted/Verified
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text('Orders Accepted/Verified by User/Manager:', margin + 25, remitY)
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.success)
             .text(String(data.cancelledAcceptedCount || 0), margin + 305, remitY)
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(`(${formatCurrency(data.cancelledAcceptedAmount || 0, data.currency || 'SAR')})`, margin + 335, remitY)

          y += remitBoxHeight + 15

          // Add order details table if there are cancelled orders
          if (data.cancelledOrderDetails && data.cancelledOrderDetails.length > 0) {
            // Check if we need a new page for the table
            if (y + 150 > pageHeight - margin) {
              doc.addPage()
              doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
              y = margin + 20
            }

            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor(colors.warning)
               .text('Cancelled Order Details:', margin, y)
            y += 20

            // Table header
            const tCol1 = margin
            const tCol2 = margin + 90
            const tCol3 = margin + 280
            const tCol4 = margin + 410

            doc.rect(margin, y, contentWidth, 30)
               .fill('#fef3c7')
            
            doc.fontSize(8)
               .font('Helvetica-Bold')
               .fillColor(colors.secondary)
               .text('ORDER #', tCol1 + 10, y + 10)
               .text('PRODUCT', tCol2 + 10, y + 10)
               .text('SUBMITTED', tCol3 + 10, y + 10)
               .text('VERIFIED', tCol4 + 10, y + 10)
            
            y += 30

            // Table rows
            data.cancelledOrderDetails.forEach((order, idx) => {
              if (y + 30 > pageHeight - margin - 150) {
                doc.addPage()
                doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
                y = margin + 20
              }

              const rowBg = idx % 2 === 0 ? '#ffffff' : '#fffbeb'
              doc.rect(margin, y, contentWidth, 30).fill(rowBg)

              doc.fontSize(8)
                 .font('Helvetica')
                 .fillColor(colors.secondary)
                 .text(order.invoiceNumber, tCol1 + 10, y + 10, { width: 75, ellipsis: true })
                 .text(order.productName || 'N/A', tCol2 + 10, y + 10, { width: 180, ellipsis: true })
              
              doc.fontSize(8)
                 .font('Helvetica-Bold')
                 .fillColor(order.submitted ? colors.success : colors.muted)
                 .text(order.submitted ? '✓ Yes' : '✗ No', tCol3 + 10, y + 10)
              
              doc.fontSize(8)
                 .font('Helvetica-Bold')
                 .fillColor(order.verified ? colors.success : colors.muted)
                 .text(order.verified ? '✓ Yes' : '✗ No', tCol4 + 10, y + 10)

              y += 30
            })

            y += 10
          }
        }

        // Returned Orders Remittance
        if (data.ordersReturned > 0) {
          doc.roundedRect(margin, y, contentWidth, remitBoxHeight, 12)
             .lineWidth(2)
             .strokeOpacity(0.15)
             .fillAndStroke('#fef2f2', '#f87171')
          
          let remitY = y + 20
          
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor(colors.danger)
             .text('RETURNED ORDERS - STATUS', margin + 25, remitY)
          remitY += 28

          // Orders Returned
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text('Orders Returned:', margin + 25, remitY)
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.secondary)
             .text(String(data.ordersReturned || 0), margin + 220, remitY)
          remitY += 22

          // Orders Submitted to Company
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text('Orders Submitted to Company:', margin + 25, remitY)
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.secondary)
             .text(String(data.returnedSubmittedCount || 0), margin + 220, remitY)
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(`(${formatCurrency(data.returnedSubmittedAmount || 0, data.currency || 'SAR')})`, margin + 250, remitY)
          remitY += 22

          // Orders Accepted/Verified
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text('Orders Accepted/Verified by User/Manager:', margin + 25, remitY)
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(colors.success)
             .text(String(data.returnedAcceptedCount || 0), margin + 305, remitY)
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(colors.muted)
             .text(`(${formatCurrency(data.returnedAcceptedAmount || 0, data.currency || 'SAR')})`, margin + 335, remitY)

          y += remitBoxHeight + 15

          // Add order details table if there are returned orders
          if (data.returnedOrderDetails && data.returnedOrderDetails.length > 0) {
            // Check if we need a new page for the table
            if (y + 150 > pageHeight - margin) {
              doc.addPage()
              doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
              y = margin + 20
            }

            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor(colors.danger)
               .text('Returned Order Details:', margin, y)
            y += 20

            // Table header
            const tCol1 = margin
            const tCol2 = margin + 90
            const tCol3 = margin + 280
            const tCol4 = margin + 410

            doc.rect(margin, y, contentWidth, 30)
               .fill('#fee2e2')
            
            doc.fontSize(8)
               .font('Helvetica-Bold')
               .fillColor(colors.secondary)
               .text('ORDER #', tCol1 + 10, y + 10)
               .text('PRODUCT', tCol2 + 10, y + 10)
               .text('SUBMITTED', tCol3 + 10, y + 10)
               .text('VERIFIED', tCol4 + 10, y + 10)
            
            y += 30

            // Table rows
            data.returnedOrderDetails.forEach((order, idx) => {
              if (y + 30 > pageHeight - margin - 150) {
                doc.addPage()
                doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
                y = margin + 20
              }

              const rowBg = idx % 2 === 0 ? '#ffffff' : '#fef2f2'
              doc.rect(margin, y, contentWidth, 30).fill(rowBg)

              doc.fontSize(8)
                 .font('Helvetica')
                 .fillColor(colors.secondary)
                 .text(order.invoiceNumber, tCol1 + 10, y + 10, { width: 75, ellipsis: true })
                 .text(order.productName || 'N/A', tCol2 + 10, y + 10, { width: 180, ellipsis: true })
              
              doc.fontSize(8)
                 .font('Helvetica-Bold')
                 .fillColor(order.submitted ? colors.success : colors.muted)
                 .text(order.submitted ? '✓ Yes' : '✗ No', tCol3 + 10, y + 10)
              
              doc.fontSize(8)
                 .font('Helvetica-Bold')
                 .fillColor(order.verified ? colors.success : colors.muted)
                 .text(order.verified ? '✓ Yes' : '✗ No', tCol4 + 10, y + 10)

              y += 30
            })

            y += 10
          }
        }
      }

      // === COMMISSION SUMMARY ===
      // Check if we need a new page
      if (y + 100 > pageHeight - margin - 120) {
        doc.addPage()
        doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
        y = margin + 20
      }

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
         .text(formatCurrency(data.totalCommission || 0, data.currency || 'SAR'), margin + 30, y + 42)

      y += 100

      // === DELIVERED ORDERS DETAILS ===
      if (data.deliveredOrders && data.deliveredOrders.length > 0) {
        // Check if we need a new page
        if (y + 120 > pageHeight - margin - 120) {
          doc.addPage()
          doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
          y = margin + 20
        }

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
          // Check if we need a new page (with better logic)
          if (y + rowHeight > pageHeight - margin - 150) {
            doc.addPage()
            doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
            y = margin + 20
          }

          // Alternating row background
          if (index % 2 === 0) {
            doc.rect(margin, y, contentWidth, rowHeight).fill('#ffffff')
          } else {
            doc.rect(margin, y, contentWidth, rowHeight).fill('#f0fdf4')
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
             .text(formatCurrency(order.commission || 0, data.currency || 'SAR'), col4X + 15, y + 13)

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
      // Only add new page if absolutely necessary
      const footerHeight = 100
      const spaceNeeded = footerHeight + margin
      
      if (y + spaceNeeded > pageHeight - margin) {
        doc.addPage()
        doc.rect(0, 0, pageWidth, 8).fill(colors.accent)
        y = pageHeight - 120
      } else {
        // Use available space
        y = Math.max(y + 20, pageHeight - 120)
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

      // Page numbers
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        
        doc.rect(0, pageHeight - 8, pageWidth, 8)
           .fill(colors.accent)
        
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(colors.muted)
           .text(
             `— Page ${i + 1} of ${range.count} —`,
             margin,
             pageHeight - 25,
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
