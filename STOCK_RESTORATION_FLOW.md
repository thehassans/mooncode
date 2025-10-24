# Stock Restoration Flow - Approval Required

## 🎯 **Problem Fixed:**

**Before:** Stock was immediately restored when orders were cancelled/returned ❌  
**After:** Stock is restored ONLY after manager/user approval ✅

---

## 🔄 **Complete Order Lifecycle:**

### **1. Order Created**
```
Action: Agent/Driver creates order
Stock: Decreases immediately (reserved)
Status: 'open'

Example:
- Initial Stock Oman: 175
- Order created (qty: 1)
- Available Stock Oman: 174 ✅ (175 - 1 order)
```

### **2. Order Delivered**
```
Action: Driver marks as delivered
Stock: No change (already reserved)
Status: 'delivered'

Example:
- Stock Oman: 174 (unchanged)
- Delivered count: +1
```

### **3. Order Cancelled/Returned**
```
Action: Driver/Agent marks as cancelled/returned
Stock: NO CHANGE (still reserved, pending approval) ⚠️
Status: 'cancelled' or 'returned'
returnVerified: false

Example:
- Stock Oman: 174 (still reserved)
- Order status: 'cancelled'
- Waiting for approval...
```

### **4. Driver Submits to Company**
```
Action: Driver submits cancelled/returned order
Stock: NO CHANGE (still reserved)
Status: 'cancelled' or 'returned'
returnSubmittedToCompany: true

Example:
- Stock Oman: 174 (still reserved)
- returnSubmittedToCompany: true
- Notification sent to manager/user
```

### **5. Manager/User Verifies**
```
Action: Manager/User approves the return/cancellation
Stock: RESTORED NOW ✅
Status: 'cancelled' or 'returned'
returnVerified: true
inventoryAdjusted: false

Example:
- Stock Oman: 175 ✅ (restored after approval)
- returnVerified: true
- inventoryRestoredAt: Date.now()
```

---

## 📊 **Warehouse Calculation:**

### **Active Orders (Reserved Stock):**
```javascript
Orders counted as "reserved":
1. All open orders
2. All in_process orders
3. All out_for_delivery orders
4. All delivered orders
5. Cancelled/Returned orders WHERE returnVerified = false ⚠️

NOT counted as reserved:
- Cancelled/Returned orders WHERE returnVerified = true ✅
```

### **Available Stock Formula:**
```javascript
availableStock = totalPurchased - activeOrders

// Example with TWG Acne Cream:
totalPurchased: 175
activeOrders: {
  open: 10,
  in_process: 5,
  delivered: 12,
  cancelled (not verified): 2  // ⚠️ Still counted as reserved!
}
total activeOrders: 29

availableStock = 175 - 29 = 146 ✅
```

---

## 🔧 **API Endpoints:**

### **1. Mark as Returned**
```
POST /api/orders/:id/return
Roles: admin, user, agent, driver

Body:
{
  "reason": "Customer refused to accept"
}

Response:
{
  "message": "Order marked as returned. Stock will be restored after verification.",
  "order": { ... }
}

⚠️ Stock is NOT restored at this point!
```

### **2. Mark as Cancelled**
```
POST /api/orders/:id/cancel
Roles: admin, user, agent, manager, driver

Body:
{
  "reason": "Customer not reachable"
}

Response:
{
  "message": "Order cancelled. Stock will be restored after verification.",
  "order": { ... }
}

⚠️ Stock is NOT restored at this point!
```

### **3. Submit to Company (Driver)**
```
POST /api/orders/:id/return/submit
Roles: driver

Response:
{
  "message": "Return/cancellation submitted to company",
  "order": {
    "returnSubmittedToCompany": true,
    "returnSubmittedAt": "2025-10-24T07:20:00Z"
  }
}

⚠️ Stock is still NOT restored - waiting for approval
```

### **4. Verify Return (Manager/User)**
```
POST /api/orders/:id/return/verify
Roles: user, manager

Response:
{
  "message": "Order verified successfully and stock refilled",
  "order": {
    "returnVerified": true,
    "returnVerifiedAt": "2025-10-24T07:25:00Z",
    "returnVerifiedBy": "user_id",
    "inventoryAdjusted": false,
    "inventoryRestoredAt": "2025-10-24T07:25:00Z"
  }
}

✅ Stock is NOW restored!
```

---

## 📈 **Example Scenario:**

### **Initial State:**
```
Product: TWG Acne Cream
Total Purchased: 175
Active Orders: 29
Available Stock: 146
```

### **Driver Cancels Order:**
```
POST /api/orders/12345/cancel
Body: { "reason": "Customer not available" }

Result:
- Order status: 'cancelled'
- returnVerified: false
- Stock Oman: 146 (unchanged - still reserved)
- Active Orders: 29 (order still counted)
```

### **Driver Submits to Company:**
```
POST /api/orders/12345/return/submit

Result:
- returnSubmittedToCompany: true
- returnSubmittedAt: now
- Stock Oman: 146 (unchanged - still reserved)
- Notification sent to manager/user
```

### **Manager Verifies:**
```
POST /api/orders/12345/return/verify

Result:
- returnVerified: true ✅
- returnVerifiedAt: now
- Stock Oman: 147 ✅ (restored!)
- Active Orders: 28 (order no longer counted)
- inventoryAdjusted: false
- inventoryRestoredAt: now
```

---

## 🎯 **Database Integration:**

### **Order Document:**
```javascript
{
  _id: "order123",
  productId: "TWG Acne Cream",
  quantity: 1,
  orderCountry: "Oman",
  shipmentStatus: "cancelled",
  returnReason: "Customer refused",
  
  // Inventory tracking
  inventoryAdjusted: true,  // Was decremented on creation
  inventoryAdjustedAt: "2025-10-20T10:00:00Z",
  inventoryRestoredAt: null,  // Will be set after verification
  
  // Return/Cancel workflow
  returnSubmittedToCompany: true,
  returnSubmittedAt: "2025-10-24T07:20:00Z",
  returnVerified: false,  // ⚠️ Pending approval
  returnVerifiedAt: null,
  returnVerifiedBy: null
}
```

### **After Verification:**
```javascript
{
  _id: "order123",
  productId: "TWG Acne Cream",
  quantity: 1,
  orderCountry: "Oman",
  shipmentStatus: "cancelled",
  returnReason: "Customer refused",
  
  // Inventory tracking
  inventoryAdjusted: false,  // ✅ Restored
  inventoryAdjustedAt: "2025-10-20T10:00:00Z",
  inventoryRestoredAt: "2025-10-24T07:25:00Z",  // ✅ Set
  
  // Return/Cancel workflow
  returnSubmittedToCompany: true,
  returnSubmittedAt: "2025-10-24T07:20:00Z",
  returnVerified: true,  // ✅ Approved
  returnVerifiedAt: "2025-10-24T07:25:00Z",
  returnVerifiedBy: "manager_id_or_user_id"
}
```

---

## ✅ **Benefits:**

### **1. Accurate Stock Management**
- Stock is never prematurely restored
- Prevents overselling
- Warehouse shows true available stock

### **2. Approval Workflow**
- Manager/User must verify before stock restoration
- Prevents fraudulent cancellations
- Audit trail for all returns

### **3. Database Integrity**
- All stock changes tracked with timestamps
- Clear history of who verified returns
- Easy to query pending approvals

### **4. Frontend Integration**
```javascript
// Warehouse shows correct stock
GET /api/warehouse/summary
Response:
{
  items: [{
    name: "TWG Acne Cream",
    totalBought: 175,
    stockLeft: {
      Oman: 146  // ✅ Excludes unverified cancelled orders
    },
    delivered: {
      Oman: 12
    }
  }]
}
```

---

## 🔍 **Query Examples:**

### **Get Pending Approvals:**
```javascript
// Orders waiting for verification
db.orders.find({
  shipmentStatus: { $in: ['cancelled', 'returned'] },
  returnSubmittedToCompany: true,
  returnVerified: false
})
```

### **Get Verified Returns:**
```javascript
// Orders with stock already restored
db.orders.find({
  shipmentStatus: { $in: ['cancelled', 'returned'] },
  returnVerified: true
})
```

### **Calculate Active Orders:**
```javascript
// Orders that are reserving stock
db.orders.find({
  $or: [
    { shipmentStatus: { $nin: ['cancelled', 'returned'] } },
    { 
      shipmentStatus: { $in: ['cancelled', 'returned'] },
      returnVerified: false  // ⚠️ Still reserving stock
    }
  ]
})
```

---

## 🚀 **Deployment:**

```bash
cd ~/httpdocs
git pull origin main
pm2 restart buysial-api
```

---

## 🎯 **Testing:**

### **Test 1: Cancel Order**
1. Create order → Stock decreases
2. Cancel order → Stock DOES NOT increase
3. Verify stock is still reserved in warehouse

### **Test 2: Submit to Company**
1. Cancel order
2. Submit to company
3. Verify stock is still reserved
4. Check notification sent to manager

### **Test 3: Manager Approval**
1. Cancel order
2. Submit to company
3. Manager verifies
4. ✅ Stock is now restored
5. Verify warehouse shows increased stock

### **Test 4: Warehouse Display**
```
Before Cancellation:
- Stock Oman: 146
- Cancelled (pending): 0

After Cancellation (before approval):
- Stock Oman: 146 (unchanged)
- Cancelled (pending): 1

After Manager Approval:
- Stock Oman: 147 ✅
- Cancelled (verified): 1
```

---

## ⚠️ **Important Notes:**

1. **Stock is reserved until approval** - This prevents overselling
2. **Manager/User must verify** - No automatic restoration
3. **Driver cannot restore stock** - Only submit for approval
4. **Warehouse shows real-time data** - Calculated from orders dynamically
5. **Audit trail maintained** - All timestamps and verifier IDs tracked

---

## 🎯 **Commit:**
- **Hash:** `797f061`
- **Message:** "Fix stock restoration: Only restore after manager/user approval, not on cancel/return"

---

**Perfect integration between orders, warehouse, and approval workflow!** ✅📦💯🔐
