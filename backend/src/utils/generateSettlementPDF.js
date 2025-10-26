import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Generate a PDF for driver settlement summary
 * @param {Object} data - Settlement data
 * @param {string} data.driverName - Driver's full name
 * @param {string} data.managerName - Manager's name
 * @param {number} data.totalDeliveredOrders - Total delivered orders count
 * @param {number} data.deliveredToCompany - Amount already delivered to company
 * @param {number} data.pendingDeliveryToCompany - Amount pending delivery
 * @param {number} data.amount - Current settlement amount
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

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Settlement Summary', { align: 'center' })
      doc.moveDown()

      // Driver Info
      doc.fontSize(14).font('Helvetica-Bold').text('Driver Information', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica')
      doc.text(`Driver: ${data.driverName || 'N/A'}`)
      doc.text(`Submitted to: ${data.managerName || 'N/A'}`)
      doc.text(`Date: ${new Date().toLocaleDateString()}`)
      doc.moveDown()

      // Settlement Details
      doc.fontSize(14).font('Helvetica-Bold').text('Settlement Details', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica')
      
      if (data.fromDate && data.toDate) {
        doc.text(`Period: ${new Date(data.fromDate).toLocaleDateString()} - ${new Date(data.toDate).toLocaleDateString()}`)
      }
      
      doc.text(`Total Delivered Orders: ${data.totalDeliveredOrders || 0}`)
      doc.text(`Delivered to Company: ${data.currency} ${(data.deliveredToCompany || 0).toFixed(2)}`)
      doc.text(`Pending Delivery to Company: ${data.currency} ${(data.pendingDeliveryToCompany || 0).toFixed(2)}`)
      doc.moveDown()

      // Current Settlement
      doc.fontSize(14).font('Helvetica-Bold').text('Current Settlement', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica')
      doc.text(`Amount: ${data.currency} ${(data.amount || 0).toFixed(2)}`, { font: 'Helvetica-Bold' })
      doc.text(`Payment Method: ${data.method === 'transfer' ? 'Bank Transfer' : 'Hand Delivery'}`)
      
      if (data.note) {
        doc.text(`Note: ${data.note}`)
      }
      doc.moveDown()

      // If transfer method and has receipt, add proof section
      if (data.method === 'transfer' && data.receiptPath) {
        doc.fontSize(14).font('Helvetica-Bold').text('Payment Proof', { underline: true })
        doc.moveDown(0.5)
        
        try {
          const receiptFullPath = path.join(process.cwd(), data.receiptPath)
          if (fs.existsSync(receiptFullPath)) {
            // Add image to PDF
            doc.image(receiptFullPath, {
              fit: [400, 400],
              align: 'center'
            })
          } else {
            doc.fontSize(11).font('Helvetica').text('Proof image attached separately')
          }
        } catch (imgErr) {
          console.error('Error adding image to PDF:', imgErr)
          doc.fontSize(11).font('Helvetica').text('Proof image attached separately')
        }
        doc.moveDown()
      }

      // Footer
      doc.moveDown(2)
      doc.fontSize(9).font('Helvetica').fillColor('gray')
      doc.text('This is a system-generated document.', { align: 'center' })
      doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' })

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
