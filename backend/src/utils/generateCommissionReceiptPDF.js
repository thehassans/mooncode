const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

/**
 * Generate a premium commission payment receipt PDF for a driver
 * @param {Object} data - Payment data
 * @param {Object} data.driver - Driver info (name, phone, email)
 * @param {Number} data.amount - Commission amount paid
 * @param {String} data.currency - Currency (e.g., 'SAR')
 * @param {Date} data.paymentDate - Payment date
 * @param {Array} data.orders - Array of delivered orders
 * @param {Number} data.totalOrders - Total delivered orders count
 * @param {String} data.paymentId - Unique payment ID
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateCommissionReceiptPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })
      doc.on('error', reject)

      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      const margin = 50

      // Premium gradient background accent
      doc.save()
      doc.linearGradient(0, 0, pageWidth, 100)
        .stop(0, '#22c55e', 0.1)
        .stop(1, '#10b981', 0.1)
      doc.rect(0, 0, pageWidth, 150).fill()
      doc.restore()

      // Logo (top left)
      try {
        const logoPath = path.join(__dirname, '../../public/BuySial2.png')
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, margin, margin - 10, { width: 100 })
        }
      } catch (err) {
        console.error('Logo not found:', err)
      }

      // Title (premium style)
      doc.save()
      doc.font('Helvetica-Bold')
        .fontSize(32)
        .fillColor('#22c55e')
        .text('Commission Receipt', margin, margin + 60, { align: 'left' })
      doc.restore()

      // Payment ID & Date
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Payment ID: ${data.paymentId}`, margin, margin + 100, { align: 'left' })
        .text(`Date: ${new Date(data.paymentDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}`, margin, margin + 115, { align: 'left' })

      let yPos = margin + 150

      // Driver Info Card
      doc.save()
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 90, 8)
        .lineWidth(1)
        .strokeColor('#e5e7eb')
        .stroke()
      doc.restore()

      yPos += 15
      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#374151')
        .text('DRIVER INFORMATION', margin + 15, yPos)

      yPos += 20
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Name:', margin + 15, yPos)
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text(data.driver.name, margin + 80, yPos)

      yPos += 18
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Phone:', margin + 15, yPos)
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(data.driver.phone, margin + 80, yPos)

      yPos += 18
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Email:', margin + 15, yPos)
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(data.driver.email || 'N/A', margin + 80, yPos)

      yPos += 35

      // Commission Summary Card
      doc.save()
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 110, 8)
        .lineWidth(1)
        .strokeColor('#22c55e')
        .fillAndStroke('#f0fdf4', '#22c55e')
      doc.restore()

      yPos += 15
      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#166534')
        .text('COMMISSION SUMMARY', margin + 15, yPos)

      yPos += 25
      const summaryLeft = margin + 15
      const summaryRight = pageWidth - margin - 15

      // Total Orders
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#166534')
        .text('Total Orders Delivered:', summaryLeft, yPos)
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#166534')
        .text(String(data.totalOrders), summaryRight - 50, yPos, { align: 'right' })

      yPos += 20
      // Commission Amount
      doc.font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#166534')
        .text('Commission Paid:', summaryLeft, yPos)
      doc.font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#22c55e')
        .text(`${data.currency} ${Number(data.amount).toFixed(2)}`, summaryRight - 120, yPos - 2, { 
          align: 'right',
          width: 120
        })

      yPos += 40

      // Orders Section
      if (data.orders && data.orders.length > 0) {
        doc.font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#374151')
          .text('ORDER DETAILS', margin, yPos)

        yPos += 20

        // Table Header
        doc.save()
        doc.rect(margin, yPos, pageWidth - 2 * margin, 25)
          .fillAndStroke('#f9fafb', '#e5e7eb')
        doc.restore()

        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#6b7280')
          .text('Order ID', margin + 10, yPos + 8, { width: 80 })
          .text('Customer', margin + 100, yPos + 8, { width: 100 })
          .text('Status', margin + 210, yPos + 8, { width: 70 })
          .text('Amount', margin + 290, yPos + 8, { width: 80 })
          .text('Commission', margin + 380, yPos + 8, { width: 80, align: 'right' })

        yPos += 25

        // Table Rows (limit to prevent overflow)
        const maxOrders = Math.min(data.orders.length, 15)
        for (let i = 0; i < maxOrders; i++) {
          const order = data.orders[i]
          
          // Add new page if needed
          if (yPos > pageHeight - 100) {
            doc.addPage()
            yPos = margin
          }

          const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
          doc.save()
          doc.rect(margin, yPos, pageWidth - 2 * margin, 22)
            .fillAndStroke(rowBg, '#f3f4f6')
          doc.restore()

          doc.font('Helvetica')
            .fontSize(8)
            .fillColor('#374151')
            .text(order.orderId || 'N/A', margin + 10, yPos + 7, { width: 80 })
            .text(order.customerName || 'N/A', margin + 100, yPos + 7, { width: 100 })
            .text(order.status || 'delivered', margin + 210, yPos + 7, { width: 70 })
            .text(`${order.currency || data.currency} ${Number(order.total || 0).toFixed(2)}`, margin + 290, yPos + 7, { width: 80 })
          
          doc.font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#22c55e')
            .text(`${data.currency} ${Number(order.commission || 0).toFixed(2)}`, margin + 380, yPos + 7, { 
              width: 80, 
              align: 'right' 
            })

          yPos += 22
        }

        if (data.orders.length > maxOrders) {
          yPos += 10
          doc.font('Helvetica-Oblique')
            .fontSize(9)
            .fillColor('#6b7280')
            .text(`... and ${data.orders.length - maxOrders} more orders`, margin, yPos, { align: 'center' })
        }
      }

      // Footer
      const footerY = pageHeight - margin - 30
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#9ca3af')
        .text('This is an automatically generated receipt. No signature required.', margin, footerY, {
          align: 'center',
          width: pageWidth - 2 * margin
        })
      
      doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#22c55e')
        .text('BuySial Delivery Management System', margin, footerY + 12, {
          align: 'center',
          width: pageWidth - 2 * margin
        })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = { generateCommissionReceiptPDF }
