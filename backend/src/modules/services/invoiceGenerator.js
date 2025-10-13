import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Generate professional BuySial invoice PDF matching the exact brand design
 * @param {Object} order - Order object with all details
 * @returns {Buffer} PDF buffer
 */
export async function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 })
      const chunks = []
      
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // BuySial Brand Colors (from screenshot)
      const orangeColor = '#FF9D52'
      const navyColor = '#1A3A5C'
      const whiteColor = '#FFFFFF'
      const blackColor = '#000000'
      const grayColor = '#666666'
      
      // Currency mapping based on country (use codes as per requirement)
      const currencyMap = {
        'KSA': 'SAR',
        'Saudi Arabia': 'SAR',
        'Oman': 'OMR',
        'UAE': 'AED',
        'Bahrain': 'BHD',
        'India': 'INR',
        'Kuwait': 'KWD',
        'Qatar': 'QAR'
      }
      const currencySymbol = currencyMap[order.orderCountry] || 'AED'

      // === HEADER - Orange Bar ===
      doc.rect(0, 0, 595, 50)
         .fill(orangeColor)
      
      // Logo
      const logoPath = path.join(__dirname, '../../../public/BuySial2.png')
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 20, 8, { width: 90, height: 35 })
        } catch(e) {}
      }
      
      // Support info on right
      doc.fontSize(9)
         .fillColor(whiteColor)
         .font('Helvetica')
         .text('SUPPORT@BUYSIAL.COM', 430, 12, { width: 150, align: 'right' })
         .text('+97158549154', 430, 28, { width: 150, align: 'right' })
      
      // === Navy Blue Decorative Shape ===
      doc.polygon(
        [148, 50],
        [285, 50],
        [285, 140],
        [148, 140]
      )
      .fill(navyColor)
      
      // === INVOICE Title (Large) ===
      doc.fontSize(48)
         .fillColor(navyColor)
         .font('Helvetica-Bold')
         .text('INVOICE', 60, 160)
      
      // Invoice details
      const invoiceNumber = order.invoiceNumber || `INV-${String(order._id).slice(-8).toUpperCase()}`
      const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      const dueDate = new Date(new Date(order.createdAt).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      
      doc.fontSize(11)
         .fillColor(blackColor)
         .font('Helvetica-Bold')
         .text('INV NO', 75, 230)
         .font('Helvetica')
         .text(': ' + invoiceNumber, 165, 230)
      
      doc.font('Helvetica-Bold')
         .text('INV DATE', 75, 250)
         .font('Helvetica')
         .text(': ' + invoiceDate, 165, 250)
      
      doc.font('Helvetica-Bold')
         .text('DUE DATE', 75, 270)
         .font('Helvetica')
         .text(': (1 TO 2 DAYS AFTER)', 165, 270)
      
      // === Invoice to: (Right side) ===
      doc.fontSize(13)
         .fillColor(blackColor)
         .font('Helvetica')
         .text('Invoice to:', 370, 150)
      
      doc.fontSize(14)
         .fillColor(orangeColor)
         .font('Helvetica-Bold')
         .text(`{${order.customerName || 'Customer name'}}`, 370, 175)
      
      // Customer phone with icon
      doc.fontSize(10)
         .fillColor(blackColor)
         .font('Helvetica')
         .text('📞  ' + (order.customerPhone || '{CUSTOMER PHONE NUMBER}'), 370, 215)
      
      // WhatsApp number
      doc.text('💬  ' + (order.customerWhatsApp || order.customerPhone || '{CUSTOMER WHATSAPP NUMBER}'), 370, 245)
      
      // Address with icon
      doc.text('📍  ' + (order.customerAddress || '{CUSTOMER ADDRESS}'), 370, 275, { width: 180 })

      // === ITEMS TABLE ===
      const tableTop = 320
      const itemX = 115
      const priceX = 330
      const qtyX = 440
      const totalX = 515
      
      // Table Header - Navy Blue
      doc.rect(75, tableTop, 480, 30)
         .fill(navyColor)
      
      doc.fontSize(12)
         .fillColor(orangeColor)
         .font('Helvetica-Bold')
         .text('ITEM', itemX, tableTop + 10, { width: 200 })
         .text('PRICE', priceX, tableTop + 10, { width: 80, align: 'center' })
         .text('QTY', qtyX, tableTop + 10, { width: 60, align: 'center' })
         .text('TOTAL', totalX, tableTop + 10, { width: 60, align: 'right' })
      
      // Helper to resolve a local image path if available (skip remote URLs)
      const resolveLocalImage = (pimg) => {
        try {
          if (!pimg) return null
          const isRemote = /^https?:\/\//i.test(String(pimg))
          if (isRemote) return null
          const candidates = [
            path.isAbsolute(pimg) ? pimg : path.join(process.cwd(), pimg),
            path.join(process.cwd(), 'public', pimg),
            path.join(process.cwd(), 'backend', 'public', pimg),
            path.join(process.cwd(), 'frontend', 'public', pimg)
          ]
          for (const c of candidates) { if (fs.existsSync(c)) return c }
        } catch {}
        return null
      }

      // Table items
      let yPosition = tableTop + 50
      const items = order.items && order.items.length > 0 
        ? order.items 
        : [{ productId: order.productId, quantity: order.quantity || 1 }]
      
      let subtotal = 0

      items.forEach((item, index) => {
        const product = item.productId
        const qty = item.quantity || 1
        const unitPrice = Number(product?.price || 0)
        const lineTotal = unitPrice * qty
        subtotal += lineTotal

        // Try draw product thumbnail (24x24) to the left of item name
        try {
          const pimg = product?.imagePath || (Array.isArray(product?.images) && product.images[0]) || product?.image
          const localImg = resolveLocalImage(pimg)
          if (localImg) {
            doc.image(localImg, itemX - 30, yPosition - 4, { width: 24, height: 24, fit: [24,24] })
          }
        } catch {}

        doc.fontSize(11)
           .fillColor(blackColor)
           .font('Helvetica-Bold')
           .text((product?.name || 'Product').toUpperCase(), itemX, yPosition, { width: 220 })
           .text(currencySymbol + ' ' + unitPrice.toFixed(0), priceX, yPosition, { width: 80, align: 'center' })
           .text(qty.toString(), qtyX, yPosition, { width: 60, align: 'center' })
           .text(currencySymbol + ' ' + lineTotal.toFixed(0), totalX, yPosition, { width: 60, align: 'right' })

        // Orange separator line
        yPosition += 40
        doc.moveTo(75, yPosition - 10)
           .lineTo(555, yPosition - 10)
           .strokeColor(orangeColor)
           .lineWidth(1.5)
           .stroke()
      })

      // === TOTALS SECTION ===
      const totalsY = Math.max(yPosition + 20, 520)
      const totalsX = 340
      
      doc.fontSize(12)
         .fillColor(blackColor)
         .font('Helvetica-Bold')
      
      // TOTAL
      doc.text('TOTAL', totalsX, totalsY, { width: 120, align: 'left' })
         .text(subtotal.toFixed(0), 500, totalsY, { width: 55, align: 'right' })
      
      // Discount
      const discount = Number(order.discount || 0)
      doc.text('Discount', totalsX, totalsY + 30, { width: 120, align: 'left' })
         .text(currencySymbol + ' ' + discount.toFixed(0), 500, totalsY + 30, { width: 55, align: 'right' })
      
      // Shipping
      const shipping = Number(order.shippingFee || 0)
      doc.text('Shipping', totalsX, totalsY + 60, { width: 120, align: 'left' })
         .text(shipping.toFixed(0), 500, totalsY + 60, { width: 55, align: 'right' })
      
      // === SUB TOTAL - Navy Blue Bar ===
      const finalTotal = Math.max(0, subtotal + shipping - discount)
      const subTotalY = totalsY + 100
      
      doc.roundedRect(325, subTotalY, 230, 40, 5)
         .fill(navyColor)
      
      doc.fontSize(14)
         .fillColor(orangeColor)
         .font('Helvetica-Bold')
         .text('SUB TOTAL', 340, subTotalY + 12, { width: 120 })
         .text(currencySymbol + ' ' + finalTotal.toFixed(0), 450, subTotalY + 12, { width: 90, align: 'right' })

      // === THANK YOU SECTION - Navy Blue Box ===
      const thanksY = 700
      
      doc.roundedRect(75, thanksY, 480, 50, 3)
         .fill(navyColor)
      
      doc.fontSize(11)
         .fillColor(whiteColor)
         .font('Helvetica')
         .text('THANK YOU FOR YOUR SHOPPING FROM', 0, thanksY + 15, { width: 595, align: 'center' })
         .font('Helvetica-Bold')
         .text('BUYSIAL', 0, thanksY + 30, { width: 595, align: 'center' })
      
      // === FOOTER - Orange Bar ===
      doc.rect(0, 792, 595, 50)
         .fill(orangeColor)

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
