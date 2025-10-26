# Complete Stock & Order Integration Guide

## 📊 Data Flow Overview

### **Single Source of Truth: Product Database Fields**

```javascript
Product Schema:
{
  stockQty: Number,              // Current available stock (all countries)
  stockByCountry: {              // Stock per country
    UAE: Number,
    Oman: Number,
    KSA: Number,
    Bahrain: Number,
    India: Number,
    Kuwait: Number,
    Qatar: Number
  },
  totalPurchased: Number,        // ✅ Cumulative inventory purchased (from stock additions)
  stockHistory: [{               // History of all stock additions
    country: String,
    quantity: Number,
    notes: String,
    addedBy: ObjectId,
    date: Date
  }],
  purchasePrice: Number,
  price: Number,
  baseCurrency: String,
  createdAt: Date,
  createdBy: ObjectId,
  createdByActorName: String,
  createdByRole: String
}
```

---

## 🔄 Complete Lifecycle

### **1. Product Creation**
```javascript
POST /api/products
Body: {
  name: "TWG Acne Cream",
  price: 80,
  stockOman: 175,
  purchasePrice: 40
}

Backend Processing:
✅ product.stockByCountry.Oman = 175
✅ product.stockQty = 175
✅ product.totalPurchased = 175  // Initial inventory
✅ product.createdByActorName = "John Doe"
✅ product.createdByRole = "user"
✅ product.createdAt = Date.now()

Result:
- Total Stock: 175
- Total Bought: 175 ✅
- Delivered: 0
```

---

### **2. Adding Stock (Inhouse/Shipment)**
```javascript
POST /api/products/:id/stock/add
Body: {
  country: "Oman",
  quantity: 50,
  notes: "New shipment from supplier"
}

Backend Processing:
✅ product.stockByCountry.Oman += 50  // 175 → 225
✅ product.stockQty += 50             // 175 → 225
✅ product.totalPurchased += 50       // 175 → 225 ✅
✅ product.stockHistory.push({
     country: "Oman",
     quantity: 50,
     notes: "New shipment",
     addedBy: userId,
     date: Date.now()
   })

Result:
- Total Stock: 225 (175 + 50)
- Total Bought: 225 (175 + 50) ✅
- Delivered: 0
```

---

### **3. Order Created (Pending)**
```javascript
POST /api/orders
Body: {
  productId: "...",
  quantity: 10,
  orderCountry: "Oman"
}

Backend Processing:
✅ Stock decreases IMMEDIATELY:
   product.stockByCountry.Oman -= 10  // 225 → 215
   product.stockQty -= 10             // 225 → 215
   order.inventoryAdjusted = true
   order.inventoryAdjustedAt = Date.now()

✅ totalPurchased UNCHANGED:
   product.totalPurchased = 225  // Still 225! ✅

Result:
- Total Stock: 215 (reserved for order)
- Total Bought: 225 (unchanged) ✅
- Delivered: 0
- Pending Orders: 1
```

---

### **4. Order Delivered**
```javascript
POST /api/orders/:id/deliver

Backend Processing:
✅ Status change only:
   order.shipmentStatus = 'delivered'
   order.deliveredAt = Date.now()

✅ Stock UNCHANGED (already decreased at creation):
   product.stockByCountry.Oman = 215  // Same
   product.stockQty = 215             // Same

✅ totalPurchased UNCHANGED:
   product.totalPurchased = 225  // Still 225! ✅

Result:
- Total Stock: 215 (same)
- Total Bought: 225 (unchanged) ✅
- Delivered: 1 ✅
- Pending Orders: 0
```

---

### **5. Order Cancelled**
```javascript
POST /api/orders/:id/cancel

Backend Processing:
✅ Stock RESTORED automatically:
   if (order.inventoryAdjusted) {
     product.stockByCountry.Oman += 10  // 215 → 225
     product.stockQty += 10             // 215 → 225
     order.inventoryAdjusted = false
     order.inventoryRestoredAt = Date.now()
   }

✅ totalPurchased UNCHANGED:
   product.totalPurchased = 225  // Still 225! ✅

Result:
- Total Stock: 225 (restored) ✅
- Total Bought: 225 (unchanged) ✅
- Delivered: 0
- Cancelled: 1
```

---

### **6. Order Returned**
```javascript
POST /api/orders/:id/return

Backend Processing:
✅ Stock RESTORED automatically:
   if (order.inventoryAdjusted) {
     product.stockByCountry.Oman += 10  // 215 → 225
     product.stockQty += 10             // 215 → 225
     order.inventoryAdjusted = false
     order.inventoryRestoredAt = Date.now()
   }

✅ totalPurchased UNCHANGED:
   product.totalPurchased = 225  // Still 225! ✅

Result:
- Total Stock: 225 (restored) ✅
- Total Bought: 225 (unchanged) ✅
- Delivered: 0
- Returned: 1
```

---

## 📱 Frontend Integration

### **Products List Page (`/user/products`)**
```javascript
Data Source:
✅ Total Stock: product.stockQty (from DB)
✅ Total Bought: product.totalPurchased (from DB)

Display:
┌────────────────────────────┐
│ TWG Acne Cream             │
│ AED 80.00                  │
├────────────────────────────┤
│ Total Stock: 215           │ ← product.stockQty
│ Total Bought: 225          │ ← product.totalPurchased ✅
└────────────────────────────┘
```

---

### **Product Detail Page (`/user/products/:id`)**
```javascript
Data Source:
✅ Total Stock: product.stockQty
✅ Total Bought: product.totalPurchased ✅
✅ Products Sold: count(orders WHERE shipmentStatus='delivered')
✅ Created By: product.createdByActorName
✅ Created Date: product.createdAt
✅ Created Role: product.createdByRole

Display:
┌────────────────────────────────────────────────┐
│ TWG Acne Cream                                 │
│ SKU: TWG-001                                   │
├────────────────────────────────────────────────┤
│ Price (AED): AED 80.00                         │
│ Category: Skincare                             │
│ Total Stock: 215                               │
├────────────────────────────────────────────────┤
│ Created By: John Doe (user)                    │
│ Created Date: Oct 24, 2025, 01:30 AM           │
├────────────────────────────────────────────────┤
│ Stock by Country:                              │
│ Oman: 215  KSA: 0  UAE: 0                     │
├────────────────────────────────────────────────┤
│ Total Orders: 10                               │
│ Total Bought: 225 ✅ (Inventory purchased)     │
│ Products Sold: 8 (8 delivered)                 │
│ Cancelled/Returned: 2                          │
│ Pending: 0                                     │
├────────────────────────────────────────────────┤
│ Total Revenue (AED): AED 640.00                │
│ Total Sell Price (AED): AED 18,000.00          │
│   225 units purchased × AED 80.00              │
│ Total Purchase (AED): AED 9,000.00             │
│ Gross Profit (AED): AED 9,000.00 (50.0%)      │
└────────────────────────────────────────────────┘
```

---

### **Warehouse Page (`/user/warehouses`)**
```javascript
Data Source:
✅ Stock Oman: product.stockByCountry.Oman
✅ Delivered Oman: count(orders WHERE orderCountry='Oman' AND shipmentStatus='delivered')
✅ Stock Value OMR: product.purchasePrice × (currentStock / totalPurchased)
✅ Delivered Revenue OMR: sum(order.total WHERE delivered)
✅ Bought: product.totalPurchased ✅

Display:
┌──────────────────────────────────────────────────────────┐
│ TWG Acne Cream                                           │
├──────────────────────────────────────────────────────────┤
│ Stock Oman: 215    Delivered Oman: 8                     │
│ Stock Value OMR: 190.22    Delivered Revenue: 121.60 OMR │
│ Bought: 225 ✅ (Inventory purchased)                      │
└──────────────────────────────────────────────────────────┘
```

---

## ✅ What "Total Bought" Means

### **Includes:**
✅ Initial stock when product created  
✅ Stock added via "Add Stock" feature  
✅ Stock from inhouse products  
✅ Stock from shipments  
✅ All inventory purchases (cumulative from `product.totalPurchased`)

### **Does NOT Include:**
❌ Customer orders  
❌ Pending orders  
❌ Delivered quantities  
❌ Cancelled orders  
❌ Returned orders

---

## 🎯 Key Metrics Explained

| Metric | Source | When Changes | Example |
|--------|--------|--------------|---------|
| **Total Bought** | `product.totalPurchased` | Only when adding stock | 225 units |
| **Total Stock** | `product.stockQty` | Order creation, cancellation, return | 215 units |
| **Stock Oman** | `product.stockByCountry.Oman` | Order creation, cancellation, return | 215 units |
| **Delivered Oman** | Count delivered orders | Only when order delivered | 8 orders |
| **Products Sold** | Sum delivered quantities | Only when order delivered | 10 units |
| **Pending** | Count pending orders | Order creation, delivery, cancel | 0 orders |

---

## 🔧 Backend Endpoints

### **GET /api/products**
```javascript
Returns: All products with auto-calculated totalPurchased
Response: {
  products: [{
    _id: "...",
    name: "TWG Acne Cream",
    stockQty: 215,
    totalPurchased: 225,  // Auto-calculated if not set
    stockByCountry: { Oman: 215, ... },
    createdByActorName: "John Doe",
    createdByRole: "user",
    createdAt: "2025-10-24T01:30:00Z"
  }]
}
```

### **GET /api/products/:id**
```javascript
Returns: Single product with auto-calculated totalPurchased
Response: {
  product: {
    _id: "...",
    name: "TWG Acne Cream",
    stockQty: 215,
    totalPurchased: 225,  // Auto-calculated if not set
    stockHistory: [...],
    createdByActorName: "John Doe",
    createdAt: "2025-10-24T01:30:00Z"
  }
}
```

### **POST /api/products/:id/stock/add**
```javascript
Body: { country: "Oman", quantity: 50 }
Processing:
  product.stockByCountry.Oman += 50
  product.stockQty += 50
  product.totalPurchased += 50  ✅
  product.stockHistory.push(...)
```

### **GET /api/warehouse/summary**
```javascript
Returns: Warehouse metrics per product
Response: {
  items: [{
    _id: "...",
    name: "TWG Acne Cream",
    totalBought: 225,  // From product.totalPurchased ✅
    stockLeft: { Oman: 215, total: 215 },
    delivered: { Oman: 8, total: 8 },
    deliveredRevenue: 121.60
  }]
}
```

---

## 🚀 Deployment Checklist

✅ Product model has `totalPurchased` field  
✅ Product creation sets initial `totalPurchased`  
✅ Stock addition increments `totalPurchased`  
✅ Order creation decreases stock, NOT `totalPurchased`  
✅ Order cancellation restores stock  
✅ Order return restores stock  
✅ Warehouse page uses `product.totalPurchased`  
✅ Product Detail page uses `product.totalPurchased`  
✅ Products list uses `product.totalPurchased`  
✅ All pages show created by and created date  
✅ All delivered counts only include `shipmentStatus='delivered'`

---

## 📊 Example Complete Flow

### **Day 1: Create Product**
```
Action: Create TWG Acne Cream with 175 units in Oman
Result:
  stockQty: 175
  stockByCountry.Oman: 175
  totalPurchased: 175 ✅
```

### **Day 2: Add Shipment**
```
Action: Add 50 units to Oman
Result:
  stockQty: 225 (175 + 50)
  stockByCountry.Oman: 225
  totalPurchased: 225 ✅ (175 + 50)
```

### **Day 3: 5 Orders Created**
```
Action: 5 orders × 2 units = 10 units
Result:
  stockQty: 215 (225 - 10)
  stockByCountry.Oman: 215
  totalPurchased: 225 ✅ (unchanged)
  Pending orders: 5
```

### **Day 4: 3 Orders Delivered**
```
Action: Deliver 3 orders
Result:
  stockQty: 215 (unchanged)
  stockByCountry.Oman: 215
  totalPurchased: 225 ✅ (unchanged)
  Delivered: 3
  Pending: 2
```

### **Day 5: 2 Orders Cancelled**
```
Action: Cancel 2 orders (4 units)
Result:
  stockQty: 219 (215 + 4)
  stockByCountry.Oman: 219
  totalPurchased: 225 ✅ (unchanged)
  Delivered: 3
  Cancelled: 2
  Pending: 0
```

### **Final Summary:**
```
✅ Total Bought: 225 (inventory purchased)
✅ Total Stock: 219 (available)
✅ Delivered: 3 orders (6 units)
✅ Cancelled: 2 orders (4 units)
✅ Stock utilization: (225-219)/225 = 2.7% sold
```

---

## 🎯 Key Takeaways

1. **"Total Bought"** = Inventory purchased (from stock additions)
2. **"Total Stock"** = Currently available
3. **"Delivered"** = Orders fulfilled
4. **All pages integrated** with same database fields
5. **Stock refills automatically** on cancel/return
6. **Created info displayed** on Product Detail page

**Everything is now perfectly integrated!** ✅
