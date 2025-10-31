import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

/**
 * Generate a commission receipt PDF for driver payouts
 */
export async function generateCommissionReceiptPDF(data) {
  const {
    driverName = 'Driver',
    driverPhone = '',
    driverEmail = '',
    managerName = 'Manager',
    managerPhone = '',
    companyName = 'BuySial',
    payoutPeriod = '',
    fromDate,
    toDate,
    totalOrders = 0,
    commissionRate = 0,
    totalCommission = 0,
    currency = 'SAR',
    orders = [],
    paymentMethod = 'Hand',
    paymentDate,
    payoutId = ''
  } = data

  try {
    // Ensure receipts directory exists
    const receiptsDir = path.join(process.cwd(), 'receipts')
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true })
    }

    const filename = `commission_receipt_${payoutId}_${Date.now()}.pdf`
    const filepath = path.join(receiptsDir, filename)
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const stream = fs.createWriteStream(filepath)
      
      doc.pipe(stream)

      // Header with company info
      doc.fontSize(24).fillColor('#1e40af').text(companyName, { align: 'center' })
      doc.fontSize(10).fillColor('#666').text('Commission Payment Receipt', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(9).text(`Receipt ID: ${payoutId}`, { align: 'center' })
      doc.moveDown(2)

      // Draw horizontal line
      doc.strokeColor('#ddd').lineWidth(1)
        .moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Payment Details Section
      doc.fontSize(14).fillColor('#1e40af').text('Payment Details', { underline: true })
      doc.moveDown(0.5)
      
      const leftCol = 70
      const rightCol = 320
      let y = doc.y

      doc.fontSize(10).fillColor('#333')
      doc.text('Payment Date:', leftCol, y)
      doc.text(paymentDate ? new Date(paymentDate).toLocaleDateString() : new Date().toLocaleDateString(), rightCol, y)
      y += 20

      doc.text('Payment Method:', leftCol, y)
      doc.text(paymentMethod, rightCol, y)
      y += 20

      doc.text('Payment Period:', leftCol, y)
      doc.text(`${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`, rightCol, y)
      y += 30

      // Driver Information
      doc.fontSize(14).fillColor('#1e40af').text('Driver Information', leftCol, y, { underline: true })
      y += 25

      doc.fontSize(10).fillColor('#333')
      doc.text('Name:', leftCol, y)
      doc.text(driverName, rightCol, y)
      y += 20

      if (driverPhone) {
        doc.text('Phone:', leftCol, y)
        doc.text(driverPhone, rightCol, y)
        y += 20
      }

      if (driverEmail) {
        doc.text('Email:', leftCol, y)
        doc.text(driverEmail, rightCol, y)
        y += 20
      }

      y += 10

      // Manager Information
      doc.fontSize(14).fillColor('#1e40af').text('Approved By', leftCol, y, { underline: true })
      y += 25

      doc.fontSize(10).fillColor('#333')
      doc.text('Manager:', leftCol, y)
      doc.text(managerName, rightCol, y)
      y += 20

      if (managerPhone) {
        doc.text('Phone:', leftCol, y)
        doc.text(managerPhone, rightCol, y)
        y += 20
      }

      y += 10
      doc.moveDown(2)

      // Commission Summary Box
      const boxY = doc.y
      doc.rect(50, boxY, 495, 100).fillAndStroke('#f0f9ff', '#1e40af')
      
      doc.fontSize(11).fillColor('#1e40af').text('Commission Summary', 70, boxY + 15)
      doc.fontSize(10).fillColor('#333')
      doc.text(`Total Orders Delivered:`, 70, boxY + 40)
      doc.text(String(totalOrders), 400, boxY + 40, { width: 130, align: 'right' })
      
      doc.text(`Commission Rate:`, 70, boxY + 60)
      doc.text(`${currency} ${Number(commissionRate).toFixed(2)} per order`, 400, boxY + 60, { width: 130, align: 'right' })
      
      doc.fontSize(12).fillColor('#1e40af')
      doc.text(`Total Commission:`, 70, boxY + 80)
      doc.fontSize(14).fillColor('#059669')
      doc.text(`${currency} ${Number(totalCommission).toFixed(2)}`, 400, boxY + 80, { width: 130, align: 'right' })

      doc.moveDown(8)

      // Orders Table
      if (orders && orders.length > 0) {
        doc.addPage()
        doc.fontSize(14).fillColor('#1e40af').text('Order Details', { underline: true })
        doc.moveDown()

        // Table headers
        const tableTop = doc.y
        const col1 = 50
        const col2 = 120
        const col3 = 250
        const col4 = 380
        const col5 = 480

        doc.fontSize(9).fillColor('#666')
        doc.text('Order ID', col1, tableTop)
        doc.text('Customer', col2, tableTop)
        doc.text('Delivered Date', col3, tableTop)
        doc.text('Amount', col4, tableTop)
        doc.text('Commission', col5, tableTop)

        // Draw header line
        doc.strokeColor('#ddd').lineWidth(1)
          .moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke()

        let currentY = tableTop + 25
        const rowHeight = 20

        orders.forEach((order, index) => {
          // Check if we need a new page
          if (currentY > 750) {
            doc.addPage()
            currentY = 50
            
            // Redraw headers on new page
            doc.fontSize(9).fillColor('#666')
            doc.text('Order ID', col1, currentY)
            doc.text('Customer', col2, currentY)
            doc.text('Delivered Date', col3, currentY)
            doc.text('Amount', col4, currentY)
            doc.text('Commission', col5, currentY)
            doc.strokeColor('#ddd').lineWidth(1)
              .moveTo(50, currentY + 15).lineTo(545, currentY + 15).stroke()
            currentY += 25
          }

          // Alternate row background
          if (index % 2 === 0) {
            doc.rect(50, currentY - 5, 495, rowHeight).fill('#f9fafb')
          }

          doc.fontSize(8).fillColor('#333')
          doc.text(order.orderId || order._id?.toString().slice(-8) || '-', col1, currentY, { width: 60 })
          doc.text(order.customerName || order.customer?.name || '-', col2, currentY, { width: 120 })
          doc.text(order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : '-', col3, currentY, { width: 120 })
          doc.text(`${currency} ${Number(order.total || 0).toFixed(2)}`, col4, currentY, { width: 90 })
          doc.text(`${currency} ${Number(commissionRate).toFixed(2)}`, col5, currentY, { width: 55 })

          currentY += rowHeight
        })

        // Total row
        currentY += 10
        doc.strokeColor('#1e40af').lineWidth(2)
          .moveTo(50, currentY).lineTo(545, currentY).stroke()
        currentY += 10

        doc.fontSize(10).fillColor('#1e40af')
        doc.text('Total:', col1, currentY)
        doc.text(`${orders.length} orders`, col2, currentY)
        doc.fontSize(11).fillColor('#059669')
        doc.text(`${currency} ${Number(totalCommission).toFixed(2)}`, col5, currentY, { width: 55, align: 'left' })
      }

      // Footer
      doc.fontSize(8).fillColor('#999')
      const footerY = 770
      doc.text('This is a computer-generated receipt and does not require a signature.', 50, footerY, { align: 'center', width: 495 })
      doc.text(`Generated on ${new Date().toLocaleString()}`, 50, footerY + 12, { align: 'center', width: 495 })

      doc.end()

      stream.on('finish', () => {
        resolve(`/receipts/${filename}`)
      })

      stream.on('error', (err) => {
        reject(err)
      })
    })
  } catch (error) {
    console.error('Error generating commission receipt PDF:', error)
    throw error
  }
}
