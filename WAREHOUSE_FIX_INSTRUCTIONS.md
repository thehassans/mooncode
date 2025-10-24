# Warehouse Stock Fix - Migration Instructions

## 🎯 **Problem Identified:**

The warehouse is showing:
```
Bought: 175 ✅ (correct - total inventory purchased)
Stock Oman: 175 ❌ (wrong - should be 158)
Delivered Oman: 17 ✅ (correct)
```

**Root Cause:**
- Existing 17 orders were created BEFORE the inventory adjustment logic was added
- These orders have `inventoryAdjusted: false` in the database
- Stock was never decremented when these orders were created
- New orders work correctly (stock decreases on creation)

---

## ✅ **Solution:**

Run the migration endpoint to adjust stock for all existing orders that were created without inventory adjustment.

---

## 🚀 **Step 1: Deploy Latest Code**

```bash
cd ~/httpdocs
git pull origin main
pm2 restart buysial-api
```

---

## 🔧 **Step 2: Run Migration via API**

### **Option A: Using Postman/Thunder Client**

**Request:**
```
POST https://buysial.com/api/orders/migrate/adjust-stock
Headers:
  Authorization: Bearer <your-admin-token>
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Migration complete! Adjusted 17 orders, skipped 0",
  "totalOrders": 17,
  "adjusted": 17,
  "skipped": 0,
  "logs": [
    "Processing single-item order ... for TWG Acne Cream in Oman",
    "  - TWG Acne Cream: Oman stock 175 → 174",
    "Processing single-item order ... for TWG Acne Cream in Oman",
    "  - TWG Acne Cream: Oman stock 174 → 173",
    ...
  ]
}
```

### **Option B: Using cURL**

```bash
curl -X POST https://buysial.com/api/orders/migrate/adjust-stock \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📊 **Step 3: Verify Results**

### **Check Warehouse Page:**
```
Expected After Migration:
| Product         | Bought | Stock Oman | Delivered Oman |
|-----------------|--------|------------|----------------|
| TWG Acne Cream  | 175 ✅  | 158 ✅      | 17 ✅           |

Calculation: 175 (bought) - 17 (orders) = 158 (stock left)
```

### **Check Database:**
```javascript
// All orders should now have:
{
  inventoryAdjusted: true,
  inventoryAdjustedAt: Date
}
```

---

## 🔄 **How It Works:**

### **Before Migration:**
```
MongoDB Orders Collection:
{
  _id: "order1",
  productId: "TWG Acne Cream",
  quantity: 1,
  orderCountry: "Oman",
  shipmentStatus: "delivered",
  inventoryAdjusted: false  ❌
}

MongoDB Products Collection:
{
  _id: "TWG Acne Cream",
  totalPurchased: 175,
  stockByCountry: {
    Oman: 175  ❌ (wrong - should be decreased)
  },
  stockQty: 175
}
```

### **After Migration:**
```
MongoDB Orders Collection:
{
  _id: "order1",
  productId: "TWG Acne Cream",
  quantity: 1,
  orderCountry: "Oman",
  shipmentStatus: "delivered",
  inventoryAdjusted: true,  ✅
  inventoryAdjustedAt: "2025-10-24T06:35:00Z"
}

MongoDB Products Collection:
{
  _id: "TWG Acne Cream",
  totalPurchased: 175,  (unchanged)
  stockByCountry: {
    Oman: 158  ✅ (175 - 17 orders)
  },
  stockQty: 158
}
```

---

## 🎯 **What The Migration Does:**

1. **Finds** all orders where `inventoryAdjusted !== true` and not cancelled/returned
2. **For each order:**
   - Gets the product and quantity
   - Decreases stock in the correct country
   - Recalculates total stock
   - Marks order as `inventoryAdjusted: true`
3. **Returns** a summary with logs

---

## 🔐 **Security:**

- ✅ Endpoint requires **admin role** authentication
- ✅ Only processes orders that haven't been adjusted
- ✅ Skips cancelled/returned orders
- ✅ Safe to run multiple times (idempotent)

---

## ⚠️ **Important Notes:**

### **1. This Migration is ONE-TIME:**
- Only fixes existing orders created before inventory logic
- New orders will automatically adjust stock on creation

### **2. Future Orders Work Automatically:**
When a new order is created:
```javascript
// Stock decreases IMMEDIATELY on order creation
product.stockByCountry.Oman -= quantity
order.inventoryAdjusted = true

// When cancelled/returned:
product.stockByCountry.Oman += quantity  (restored)
order.inventoryAdjusted = false
```

### **3. Complete Flow:**

```
Action                  | Stock Oman | Bought | Delivered
------------------------|------------|--------|----------
Initial inventory       | 175        | 175    | 0
Create order (qty: 1)   | 174 ✅     | 175    | 0
Deliver order           | 174 ✅     | 175    | 1 ✅
Cancel order            | 175 ✅     | 175    | 0
(stock restored)
```

---

## 🐛 **Troubleshooting:**

### **Issue: Migration returns 0 adjusted**
**Solution:** All orders already have `inventoryAdjusted: true`. Check database directly.

### **Issue: Stock still wrong after migration**
**Solution:** 
1. Check migration logs for errors
2. Verify admin token is valid
3. Check server logs for errors

### **Issue: 401 Unauthorized**
**Solution:** Use an admin user token. Regular user/manager tokens won't work.

---

## 📝 **Migration Logs Example:**

```
Processing single-item order 67197abc123 for TWG Acne Cream in Oman
  - TWG Acne Cream: Oman stock 175 → 174
Processing single-item order 67197def456 for TWG Acne Cream in Oman
  - TWG Acne Cream: Oman stock 174 → 173
Processing single-item order 67197ghi789 for B5 Cream twg in Oman
  - B5 Cream twg: Oman stock 206 → 205
...
```

---

## ✅ **Expected Final State:**

### **Warehouse Page:**
```
| Product                        | Bought | Stock Oman | Delivered Oman |
|--------------------------------|--------|------------|----------------|
| TWG Acne Cream                 | 175    | 158        | 17             |
| B5 Cream twg                   | 206    | 206        | 0              |
| TWG amino Acid facial cleanser | 70     | 70         | 0              |
| TWG Collagen Cream             | 83     | 83         | 0              |
```

### **Product Detail (TWG Acne Cream):**
```
Total Bought: 175 (Inventory purchased)
Total Stock: 158 (Available)
Products Sold: 17 (Delivered)
```

---

## 🎯 **Commit:**
- **Hash:** `88be936`
- **Message:** "Add migration to adjust stock for existing orders without inventory adjustment"

---

**After running this migration, your warehouse will perfectly reflect the actual stock levels based on orders in MongoDB!** ✅📦💯
