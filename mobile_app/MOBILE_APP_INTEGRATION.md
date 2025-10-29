# Mobile App Product Integration

## ✅ How to Show Products on Mobile App

### From Your User Panel (Inhouse Products):

1. **Navigate to Products**: Go to your user panel → Inhouse Products
2. **Edit or Create a Product**: Click on a product to edit it, or create a new one
3. **Enable Mobile Display**: Check the checkbox labeled **"Show on Mobile Application"** or **"isForMobile"**
4. **Save the Product**: Click Save/Update
5. **Done!** The product will now appear in your mobile application

### What This Does:

- Sets the `isForMobile` field to `true` in the database
- Makes the product visible in the mobile app
- Keeps it separate from website visibility (`displayOnWebsite`)
- Allows you to control mobile and website products independently

---

## 🔧 Technical Details

### Backend Changes:

1. **Product Model** (`Product.js`):
   - Added field: `isForMobile: { type: Boolean, default: false }`

2. **Product Creation Route** (`POST /api/products`):
   - Accepts `isForMobile` parameter
   - Sets the field during product creation

3. **Product Update Route** (`PATCH /api/products/:id`):
   - Accepts `isForMobile` parameter
   - Updates the field when editing products

4. **New Mobile Endpoint** (`GET /api/products/mobile`):
   - Returns only products where `isForMobile: true`
   - No authentication required
   - Supports filtering, search, pagination
   - Optimized for mobile app consumption

### Mobile App Changes:

1. **API Configuration** (`api_config.dart`):
   ```dart
   static const String mobileProducts = '$apiPrefix/products/mobile';
   ```

2. **Product Service** (`product_service.dart`):
   - Uses `/api/products/mobile` endpoint
   - No authentication required
   - Fetches only mobile-enabled products

---

## 📋 API Endpoint Details

### Endpoint: `GET /api/products/mobile`

**URL**: `https://hassanscode.com/api/products/mobile`

**Method**: `GET`

**Authentication**: Not required (public endpoint)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `category` (optional): Filter by category
- `search` (optional): Search in name, description, brand, category
- `sort` (optional): Sort by (name, price, rating, featured, newest)

**Response**:
```json
{
  "products": [
    {
      "_id": "...",
      "name": "Product Name",
      "price": 100,
      "baseCurrency": "AED",
      "stockQty": 50,
      "totalPurchased": 100,
      "images": ["/uploads/..."],
      "category": "Skincare",
      "description": "...",
      "isForMobile": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "pages": 1
  }
}
```

---

## 🎯 Differences Between Fields

| Field | Purpose | Controls |
|-------|---------|----------|
| `displayOnWebsite` | Website visibility | Public website/ecommerce site |
| `isForMobile` | Mobile app visibility | Mobile application |

**You can control them independently:**
- Enable only `displayOnWebsite`: Shows on website only
- Enable only `isForMobile`: Shows in mobile app only
- Enable both: Shows in both places
- Enable neither: Hidden from both

---

## 🚀 Testing

### 1. Test Backend Endpoint:
```bash
# Check if mobile endpoint is working
curl https://hassanscode.com/api/products/mobile
```

### 2. Mark a Product for Mobile:
- Go to user panel → Inhouse Products
- Edit any product
- Check "Show on Mobile Application"
- Save

### 3. Verify in Mobile App:
- Run the mobile app
- Check if the product appears in the products list

---

## 📝 Migration Note

If you have existing products that should appear in the mobile app:

1. **Option 1 - Manual Update**:
   - Edit each product in your user panel
   - Check the "Show on Mobile Application" checkbox
   - Save

2. **Option 2 - Database Update** (if you want to enable all products):
   ```javascript
   // Run this in MongoDB to enable all products for mobile
   db.products.updateMany(
     { displayOnWebsite: true },
     { $set: { isForMobile: true } }
   )
   ```

3. **Option 3 - Selective Update**:
   ```javascript
   // Enable mobile for specific category
   db.products.updateMany(
     { category: "Skincare", displayOnWebsite: true },
     { $set: { isForMobile: true } }
   )
   ```

---

## ✅ Checklist

- [x] Added `isForMobile` field to Product model
- [x] Updated product creation route
- [x] Updated product update route
- [x] Created `/api/products/mobile` endpoint
- [x] Updated mobile app API configuration
- [x] Mobile app now fetches products from correct endpoint

## 🎉 Summary

Your mobile app now only shows products that you specifically mark with the **"Show on Mobile Application"** checkbox in your user panel's Inhouse Products section. This gives you full control over which products appear in the mobile app independently from your website.
