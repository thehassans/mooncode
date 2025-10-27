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

      // Helper function to draw a box
      const drawBox = (x, y, width, height, color = '#f3f4f6') => {
        doc.rect(x, y, width, height).fillAndStroke(color, '#e5e7eb')
      }

      // Helper function for table row
      const drawTableRow = (y, label, value, isHeader = false) => {
        const x = margin
        const width = pageWidth - 2 * margin
        if (isHeader) {
          doc.rect(x, y, width, 25).fillAndStroke('#4f46e5', '#4338ca')
          doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
          doc.text(label, x + 10, y + 8, { width: width / 2 - 20 })
          doc.text(value, x + width / 2, y + 8, { width: width / 2 - 10, align: 'right' })
        } else {
          doc.rect(x, y, width, 22).stroke('#e5e7eb')
          doc.fillColor('black').fontSize(10).font('Helvetica')
          doc.text(label, x + 10, y + 6, { width: width / 2 - 20 })
          doc.fillColor('#1f2937').font('Helvetica-Bold')
          doc.text(value, x + width / 2, y + 6, { width: width / 2 - 10, align: 'right' })
        }
        return y + (isHeader ? 25 : 22)
      }

      // Company Header with Blue Background
      doc.rect(0, 0, pageWidth, 80).fill('#1e40af')
      
      // Add logo in top left corner
      const logoPath = getLogoPath()
      if (logoPath) {
        try {
          doc.image(logoPath, 15, 15, { width: 50, height: 50, fit: [50, 50] })
        } catch (err) {
          console.error('Failed to add logo to PDF:', err)
        }
      }
      
      doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
      doc.text('DRIVER SETTLEMENT REPORT', margin, 25, { align: 'center' })
      doc.fontSize(11).font('Helvetica')
      doc.text('Complete Financial Summary & Commission Details', margin, 55, { align: 'center' })
      currentY = 100

      // Document Info Box
      doc.fillColor('black')
      drawBox(margin, currentY, pageWidth - 2 * margin, 70, '#fef3c7')
      doc.fontSize(10).font('Helvetica')
      doc.fillColor('#92400e').text('Document ID:', margin + 15, currentY + 12)
      doc.fillColor('#78350f').font('Helvetica-Bold').text(`SETTLEMENT-${Date.now()}`, margin + 120, currentY + 12)
      doc.fillColor('#92400e').font('Helvetica').text('Generated Date:', margin + 15, currentY + 30)
      doc.fillColor('#78350f').font('Helvetica-Bold').text(new Date().toLocaleString(), margin + 120, currentY + 30)
      if (data.fromDate && data.toDate) {
        doc.fillColor('#92400e').font('Helvetica').text('Period:', margin + 15, currentY + 48)
        doc.fillColor('#78350f').font('Helvetica-Bold').text(
          `${new Date(data.fromDate).toLocaleDateString()} - ${new Date(data.toDate).toLocaleDateString()}`,
          margin + 120, currentY + 48
        )
      }
      currentY += 90

      // Driver Information Section
      doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('DRIVER INFORMATION', margin, currentY)
      currentY += 20
      currentY = drawTableRow(currentY, 'Information', 'Details', true)
      currentY = drawTableRow(currentY, 'Driver Name', data.driverName || 'N/A')
      if (data.driverPhone) {
        currentY = drawTableRow(currentY, 'Phone Number', data.driverPhone)
      }
      currentY = drawTableRow(currentY, 'Submitted To', data.managerName || 'N/A')
      currentY += 20

      // Order Statistics Section
      doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('ORDER STATISTICS', margin, currentY)
      currentY += 20
      currentY = drawTableRow(currentY, 'Metric', 'Count', true)
      if (data.assignedOrders != null) {
        currentY = drawTableRow(currentY, 'Assigned Orders', String(data.assignedOrders || 0))
      }
      currentY = drawTableRow(currentY, 'Delivered Orders', String(data.totalDeliveredOrders || 0))
      if (data.cancelledOrders != null) {
        currentY = drawTableRow(currentY, 'Cancelled Orders', String(data.cancelledOrders || 0))
      }
      currentY += 20

      // Financial Summary Section
      doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('FINANCIAL SUMMARY', margin, currentY)
      currentY += 20
      currentY = drawTableRow(currentY, 'Description', 'Amount', true)
      if (data.collectedAmount != null) {
        currentY = drawTableRow(currentY, 'Total Collected from Customers', `${data.currency} ${(data.collectedAmount || 0).toFixed(2)}`)
      }
      currentY = drawTableRow(currentY, 'Already Delivered to Company', `${data.currency} ${(data.deliveredToCompany || 0).toFixed(2)}`)
      currentY = drawTableRow(currentY, 'Pending Delivery to Company', `${data.currency} ${(data.pendingDeliveryToCompany || 0).toFixed(2)}`)
      currentY += 20

      // Commission Details Section
      if (data.totalCommission != null || data.paidCommission != null || data.pendingCommission != null) {
        doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('COMMISSION DETAILS', margin, currentY)
        currentY += 20
        currentY = drawTableRow(currentY, 'Commission Type', 'Amount', true)
        if (data.totalCommission != null) {
          currentY = drawTableRow(currentY, 'Total Commission Earned', `${data.currency} ${(data.totalCommission || 0).toFixed(2)}`)
        }
        if (data.paidCommission != null) {
          currentY = drawTableRow(currentY, 'Commission Already Paid', `${data.currency} ${(data.paidCommission || 0).toFixed(2)}`)
        }
        if (data.pendingCommission != null) {
          currentY = drawTableRow(currentY, 'Pending Commission', `${data.currency} ${(data.pendingCommission || 0).toFixed(2)}`)
        }
        currentY += 20
      }

      // Current Settlement (Highlighted)
      doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
      doc.rect(margin, currentY, pageWidth - 2 * margin, 35).fillAndStroke('#059669', '#047857')
      doc.text('CURRENT SETTLEMENT AMOUNT', margin + 15, currentY + 10)
      doc.fontSize(16).text(`${data.currency} ${(data.amount || 0).toFixed(2)}`, margin, currentY + 10, { 
        align: 'right', 
        width: pageWidth - 2 * margin - 15 
      })
      currentY += 50

      // Payment Details
      doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('PAYMENT DETAILS', margin, currentY)
      currentY += 20
      currentY = drawTableRow(currentY, 'Payment Method', data.method === 'transfer' ? 'Bank Transfer' : 'Hand Delivery')
      if (data.note) {
        currentY = drawTableRow(currentY, 'Note', data.note)
      }
      currentY += 20

      // Payment Proof (if transfer)
      if (data.method === 'transfer' && data.receiptPath) {
        doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('PAYMENT PROOF', margin, currentY)
        currentY += 20
        
        try {
          const receiptFullPath = path.join(process.cwd(), data.receiptPath)
          if (fs.existsSync(receiptFullPath)) {
            doc.image(receiptFullPath, {
              fit: [400, 300],
              align: 'center',
              valign: 'center'
            })
            currentY += 320
          } else {
            doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
            doc.text('Payment proof image attached separately', margin, currentY, { align: 'center' })
            currentY += 30
          }
        } catch (imgErr) {
          console.error('Error adding image to PDF:', imgErr)
          doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
          doc.text('Payment proof image attached separately', margin, currentY, { align: 'center' })
          currentY += 30
        }
      }

      // Footer
      const footerY = pageHeight - 60
      doc.rect(0, footerY, pageWidth, 60).fill('#f3f4f6')
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
      doc.text('This is a system-generated document. No signature required.', margin, footerY + 15, { align: 'center' })
      doc.fontSize(7).text('For any queries, please contact your manager or admin.', margin, footerY + 30, { align: 'center' })
      doc.text(`Document generated on ${new Date().toLocaleString()}`, margin, footerY + 42, { align: 'center' })

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
