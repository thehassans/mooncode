# Shopify Dropshipping Integration Guide

## Overview
The **Buysial Dropshipping** app enables seamless integration between your BuySial e-commerce platform and Shopify stores. This integration allows you to:

- **Sync products** from BuySial to Shopify automatically
- **Receive orders** from Shopify as they're placed
- **Manage fulfillment** and update tracking information
- **Track inventory** across both platforms
- **Process orders** through your existing BuySial workflow

## Features

### ✨ Product Syncing
- ✅ One-click sync of products to Shopify
- ✅ Automatic product creation/update on Shopify
- ✅ Product image sync
- ✅ Price and inventory sync
- ✅ Category and tag mapping
- ✅ SKU management

### 📦 Order Management
- ✅ Automatic order import from Shopify
- ✅ Order marked as "shopify" source
- ✅ Customer information synced
- ✅ Multi-item order support
- ✅ Shipping address mapping
- ✅ Order status synchronization

### 🔄 Webhooks
- ✅ Order created webhook
- ✅ Order fulfilled webhook
- ✅ Order cancelled webhook
- ✅ Automatic fulfillment tracking

---

## Installation & Setup

### Step 1: Install Dependencies

First, ensure you have the required dependencies installed:

```bash
cd backend
npm install axios
```

### Step 2: Configure Shopify Private App

1. **Go to your Shopify Admin**
   - Navigate to: `Settings` → `Apps and sales channels` → `Develop apps`

2. **Create a new app**
   - Click "Create an app"
   - Name it "Buysial Dropshipping"

3. **Configure Admin API scopes**
   - Click "Configure Admin API scopes"
   - Enable these scopes:
     - `read_products`
     - `write_products`
     - `read_orders`
     - `write_orders`
     - `write_fulfillments`
     - `read_inventory`
     - `write_inventory`

4. **Install the app**
   - Click "Install app"
   - Copy the **Admin API access token** (starts with `shpat_`)

5. **Note your store URL**
   - Your store URL format: `your-store.myshopify.com`

### Step 3: Configure BuySial Integration

1. **Navigate to Shopify Integration page**
   - In BuySial dashboard: `User` → `Shopify Integration`
   - URL: `https://web.buysial.com/user/shopify`

2. **Enter Shopify credentials**
   - **Shopify Store URL**: `your-store.myshopify.com`
   - **Admin API Access Token**: Your `shpat_...` token
   - **API Version**: `2024-01` (or latest)
   - **Webhook Secret**: (optional, for webhook verification)

3. **Save settings**
   - Click "Save Shopify Settings"

### Step 4: Set Up Webhooks

1. **In your Shopify Admin**
   - Go to: `Settings` → `Notifications` → `Webhooks`

2. **Create these webhooks**:

   **Order Creation Webhook:**
   - Event: `Order creation`
   - URL: `https://web.buysial.com/api/shopify/webhooks/orders/create`
   - Format: `JSON`

   **Order Fulfillment Webhook:**
   - Event: `Order fulfillment`
   - URL: `https://web.buysial.com/api/shopify/webhooks/orders/fulfilled`
   - Format: `JSON`

   **Order Cancellation Webhook:**
   - Event: `Order cancellation`
   - URL: `https://web.buysial.com/api/shopify/webhooks/orders/cancelled`
   - Format: `JSON`

3. **Save webhook secret** (if using)
   - Copy the webhook secret key from Shopify
   - Add it to BuySial Shopify settings

---

## Usage Guide

### Syncing Products to Shopify

#### Method 1: Mark Products for Sync (During Creation/Edit)

1. **Create or Edit a Product**
   - Go to: `Products` → `In-house Products`
   - Create new product or click on existing product to edit

2. **Enable Shopify Sync**
   - Check the checkbox: ☑ **"Sync to Shopify"**
   - Save the product

3. **Sync to Shopify**
   - Go to: `User` → `Shopify Integration`
   - Click "Sync All Products"
   - Products marked for Shopify will be synced automatically

#### Method 2: Bulk Sync

1. **Mark multiple products**
   - Edit each product you want on Shopify
   - Check ☑ "Sync to Shopify" on each

2. **Bulk sync**
   - Go to Shopify Integration page
   - Click "Sync All Products"
   - All marked products will be synced at once

### Product Sync Details

When a product is synced to Shopify:
- **Title**: Product name from BuySial
- **Price**: Product price (or sale price if on sale)
- **Description**: Product description
- **Vendor**: Product brand (or "BuySial")
- **Product Type**: Product category
- **Tags**: Product tags
- **SKU**: Product SKU (or BuySial product ID)
- **Images**: Product images from BuySial
- **Inventory**: Synced stock quantity

### Receiving Orders from Shopify

When a customer places an order on your Shopify store:

1. **Automatic Order Creation**
   - Order is automatically created in BuySial
   - Marked as `orderSource: "shopify"`
   - Customer information is synced
   - Shipping address is mapped

2. **View Shopify Orders**
   - Go to: `Orders` → `Orders List`
   - Filter by source: `Shopify`
   - Shopify orders show with special badge

3. **Process the Order**
   - Assign to driver (if local delivery)
   - Update status as you normally would
   - Mark as shipped/delivered

4. **Automatic Fulfillment**
   - When marked as "shipped" in BuySial
   - Automatically updates Shopify with tracking info
   - Customer gets notification from Shopify

### Order Information Synced

From Shopify to BuySial:
- Customer name
- Customer phone
- Shipping address (full)
- Order items and quantities
- Order total
- Shopify order number
- Order date

### Fulfillment Flow

```
┌─────────────────────┐
│   Shopify Order     │
│   Created           │
└──────────┬──────────┘
           │
           │ Webhook
           ▼
┌─────────────────────┐
│  BuySial Order      │
│  Auto-Created       │
│  Source: Shopify    │
└──────────┬──────────┘
           │
           │ Process Order
           ▼
┌─────────────────────┐
│  Assign Driver      │
│  Pick Up → Deliver  │
└──────────┬──────────┘
           │
           │ Mark Shipped
           ▼
┌─────────────────────┐
│  Shopify Fulfillment│
│  Auto-Updated       │
│  Customer Notified  │
└─────────────────────┘
```

---

## API Endpoints

### Shopify Settings
- **GET** `/api/shopify/settings` - Get current Shopify configuration
- **POST** `/api/shopify/settings` - Save Shopify configuration

### Product Sync
- **POST** `/api/shopify/products/:id/sync` - Sync single product to Shopify
- **POST** `/api/shopify/products/sync-all` - Sync all marked products
- **DELETE** `/api/shopify/products/:id` - Remove product from Shopify
- **POST** `/api/shopify/products/:id/inventory` - Update product inventory

### Webhooks (Public - No Auth Required)
- **POST** `/api/shopify/webhooks/orders/create` - New order webhook
- **POST** `/api/shopify/webhooks/orders/fulfilled` - Order fulfilled webhook
- **POST** `/api/shopify/webhooks/orders/cancelled` - Order cancelled webhook

---

## Database Schema Changes

### Product Model
```javascript
{
  displayOnShopify: Boolean,           // Whether to sync to Shopify
  shopifyProductId: String,            // Shopify product ID
  shopifyVariantId: String,            // Shopify variant ID
  shopifyInventoryItemId: String,      // Shopify inventory item ID
  lastShopifySync: Date                // Last sync timestamp
}
```

### Order Model
```javascript
{
  orderSource: String,                 // 'manual', 'shopify', 'website', 'mobile'
  shopifyOrderId: String,              // Shopify order ID
  shopifyOrderNumber: String,          // Shopify order number (#1001)
  shopifyOrderName: String,            // Shopify order name (#MS1001)
  shopifyFulfillmentId: String         // Fulfillment ID after shipping
}
```

---

## Troubleshooting

### Products not syncing?

**Check:**
1. ✅ Shopify settings are correct (store URL, access token)
2. ✅ Product has "Sync to Shopify" checked
3. ✅ Product has at least name, price, and stock
4. ✅ Shopify API scopes include `write_products`
5. ✅ Check sync results for error messages

### Orders not appearing in BuySial?

**Check:**
1. ✅ Webhooks are properly configured in Shopify
2. ✅ Webhook URLs are correct (https://web.buysial.com/api/shopify/...)
3. ✅ Shopify webhooks show "Succeeded" status
4. ✅ Check backend logs for webhook errors
5. ✅ Verify webhook secret (if using)

### Fulfillment not updating in Shopify?

**Check:**
1. ✅ Order has `shopifyOrderId` populated
2. ✅ Order status is updated to "shipped"
3. ✅ Shopify API scopes include `write_fulfillments`
4. ✅ Tracking number is provided (optional but recommended)

### Common Error Messages

| Error | Solution |
|-------|----------|
| "Shopify configuration missing" | Configure Shopify settings first |
| "Invalid webhook signature" | Check webhook secret in settings |
| "Product not found" | Ensure product exists in BuySial |
| "Unauthorized" | Check API access token and scopes |
| "Rate limit exceeded" | Wait and retry (Shopify has rate limits) |

---

## Best Practices

### For Dropshipping

1. **Product Management**
   - Only sync products you actively want to sell on Shopify
   - Keep product descriptions detailed and accurate
   - Use high-quality product images
   - Set appropriate prices including your margin

2. **Order Processing**
   - Process Shopify orders promptly (within 24-48 hours)
   - Update tracking information as soon as available
   - Communicate with customers about shipping times
   - Handle returns/cancellations professionally

3. **Inventory Management**
   - Sync inventory regularly to avoid overselling
   - Set inventory policies correctly
   - Consider buffer stock for popular items
   - Update out-of-stock items promptly

4. **Pricing Strategy**
   - Factor in Shopify transaction fees (2.9% + 30¢)
   - Include shipping costs in product price or charge separately
   - Competitive pricing while maintaining profit margins
   - Consider currency conversion if selling internationally

### Security

1. **API Credentials**
   - Never share your Shopify access token
   - Store credentials securely in database (not code)
   - Rotate access tokens periodically
   - Use webhook secrets for verification

2. **Webhook Verification**
   - Always verify webhook signatures
   - Validate webhook payload structure
   - Log webhook events for audit trail
   - Handle malicious requests gracefully

---

## Advanced Features

### Custom Product Mapping

You can customize how products are mapped to Shopify by modifying:
- `backend/src/modules/services/shopifyService.js`
- Function: `convertProductToShopifyFormat()`

### Multiple Locations

If you have multiple warehouse locations in Shopify:
- Update `updateShopifyInventory()` function
- Specify location ID for each warehouse
- Map BuySial countries to Shopify locations

### Bulk Operations

For syncing large catalogs:
1. Use "Sync All Products" button
2. Monitor sync results
3. Fix any errors individually
4. Re-sync failed products

---

## Testing Checklist

### Before Going Live

- [ ] Shopify credentials configured correctly
- [ ] Test product sync (create/update/delete)
- [ ] Test order webhook (place test order on Shopify)
- [ ] Verify order appears in BuySial with correct details
- [ ] Process test order through fulfillment
- [ ] Verify Shopify order shows as fulfilled
- [ ] Test cancellation flow
- [ ] Check inventory sync accuracy
- [ ] Verify pricing displays correctly on Shopify
- [ ] Test with multiple products in one order

---

## Support & Resources

### Shopify Resources
- [Shopify Admin API Documentation](https://shopify.dev/api/admin)
- [Shopify Webhooks Guide](https://shopify.dev/api/admin/rest/reference/events/webhook)
- [Shopify App Development](https://shopify.dev/apps)

### BuySial Support
- For issues: Contact BuySial support
- For feature requests: Submit via support portal
- For custom integrations: Contact development team

---

## Changelog

### Version 1.0 (Current)
- ✅ Initial Shopify integration
- ✅ Product sync (create/update)
- ✅ Order webhooks (create/fulfill/cancel)
- ✅ Automatic fulfillment tracking
- ✅ Inventory management
- ✅ Multi-item order support

### Future Enhancements
- 🔄 Real-time inventory sync
- 🔄 Automatic pricing rules
- 🔄 Product variant support
- 🔄 Advanced order filtering
- 🔄 Shopify collections sync
- 🔄 Customer data sync

---

## License & Terms

This integration is part of the BuySial platform. Use of the Shopify integration is subject to both BuySial Terms of Service and Shopify's API Terms of Use.

**Important**: Ensure compliance with:
- Shopify's API usage guidelines
- Rate limiting policies
- Data protection regulations (GDPR, etc.)
- Customer privacy requirements

---

**Need Help?** Contact support at support@buysial.com or check our knowledge base for more guides.
