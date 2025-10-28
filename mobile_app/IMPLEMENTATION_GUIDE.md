# BuySial Mobile App - Implementation Guide

## Project Status: Initial Structure Complete ✅

This document outlines what has been created and what still needs to be implemented.

## ✅ Completed Components

### 1. Project Structure & Configuration
- ✅ `pubspec.yaml` - Dependencies and assets configuration
- ✅ `analysis_options.yaml` - Linting rules
- ✅ `README.md` - Project documentation

### 2. Core Configuration
- ✅ `lib/core/config/api_config.dart` - API endpoints and configuration
- ✅ `lib/core/constants/app_colors.dart` - Color palette
- ✅ `lib/core/constants/app_dimensions.dart` - Spacing and sizing
- ✅ `lib/core/constants/app_strings.dart` - Text constants
- ✅ `lib/core/theme/app_theme.dart` - Material Theme configuration

### 3. Data Models
- ✅ `lib/models/user_model.dart` - User and Address models
- ✅ `lib/models/product_model.dart` - Product, Variant, and Rating models
- ✅ `lib/models/cart_model.dart` - Cart and CartItem models
- ✅ `lib/models/order_model.dart` - Order and OrderItem models

### 4. API Services
- ✅ `lib/core/services/api_service.dart` - Base HTTP client
- ✅ `lib/core/services/auth_service.dart` - Authentication API calls
- ✅ `lib/core/services/product_service.dart` - Product API calls
- ✅ `lib/core/services/order_service.dart` - Order API calls

### 5. State Management (Provider)
- ✅ `lib/providers/auth_provider.dart` - Authentication state
- ✅ `lib/providers/product_provider.dart` - Product catalog state
- ✅ `lib/providers/cart_provider.dart` - Shopping cart state
- ✅ `lib/providers/order_provider.dart` - Order management state

### 6. App Entry Point
- ✅ `lib/main.dart` - Main app with Provider setup
- ✅ `lib/screens/splash_screen.dart` - Splash screen with auth check

## 📋 Remaining Screens to Build

### Authentication Screens (Priority: HIGH)
```
lib/screens/auth/
├── login_screen.dart         - Email/password login
├── register_screen.dart      - User registration
└── widgets/                  - Auth form widgets
    ├── auth_text_field.dart
    └── auth_button.dart
```

### Main Navigation (Priority: HIGH)
```
lib/screens/home/
├── main_screen.dart          - Bottom navigation container
├── home_tab.dart             - Home/featured products
├── categories_tab.dart       - Category browser
├── cart_tab.dart             - Shopping cart
└── profile_tab.dart          - User profile
```

### Product Screens (Priority: HIGH)
```
lib/screens/products/
├── product_list_screen.dart  - Grid/list of products
├── product_detail_screen.dart - Product details
├── category_products_screen.dart - Products by category
└── search_screen.dart        - Product search
```

### Cart & Checkout (Priority: MEDIUM)
```
lib/screens/cart/
├── cart_screen.dart          - Shopping cart view
├── checkout_screen.dart      - Multi-step checkout
├── payment_screen.dart       - Payment method selection
└── order_success_screen.dart - Order confirmation
```

### Orders (Priority: MEDIUM)
```
lib/screens/orders/
├── orders_list_screen.dart   - Order history
└── order_detail_screen.dart  - Single order details
```

### Profile & Settings (Priority: LOW)
```
lib/screens/profile/
├── profile_screen.dart       - User profile
├── edit_profile_screen.dart  - Edit user info
├── addresses_screen.dart     - Manage addresses
└── settings_screen.dart      - App settings
```

### Reusable Widgets (Priority: MEDIUM)
```
lib/widgets/
├── product_card.dart         - Product grid item
├── cart_item_card.dart       - Cart list item
├── order_card.dart           - Order list item
├── custom_button.dart        - Styled buttons
├── custom_text_field.dart    - Input fields
├── loading_indicator.dart    - Loading states
├── error_view.dart           - Error states
└── empty_state.dart          - Empty list states
```

## 🔧 Backend Integration Required

### New API Endpoints Needed

#### 1. Product Endpoints (for mobile)
```javascript
// backend/src/modules/routes/products.js

// Get products for mobile app (isForMobile = true)
router.get('/mobile', async (req, res) => {
  const { page = 1, limit = 20, category, search } = req.query;
  
  const query = { 
    isForMobile: true, 
    isActive: true,
    stock: { $gt: 0 }
  };
  
  if (category) query.category = category;
  if (search) query.$text = { $search: search };
  
  const products = await Product.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });
    
  res.json({ products, page, limit });
});

// Get single product for mobile
router.get('/mobile/:id', async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isForMobile: true,
    isActive: true
  });
  
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ product });
});
```

#### 2. Order Endpoints (for mobile)
```javascript
// backend/src/modules/routes/orders.js

// Create order from mobile app
router.post('/create/mobile', auth, async (req, res) => {
  const { 
    items, 
    shippingAddress, 
    subtotal, 
    tax, 
    shipping, 
    total,
    paymentMethod 
  } = req.body;
  
  const order = new Order({
    userId: req.user.id,
    orderNumber: `ORD-${Date.now()}`,
    items,
    shippingAddress,
    subtotal,
    tax,
    shipping,
    total,
    currency: 'AED',
    paymentMethod,
    status: 'pending',
    source: 'mobile', // Important: marks order as from mobile app
    createdAt: new Date()
  });
  
  await order.save();
  res.json({ order });
});

// Get user's orders from mobile
router.get('/mobile/user/:userId', auth, async (req, res) => {
  const orders = await Order.find({
    userId: req.params.userId,
    source: 'mobile'
  }).sort({ createdAt: -1 });
  
  res.json({ orders });
});
```

#### 3. Product Model Update
```javascript
// backend/src/modules/models/Product.js

// Add new field to schema
const productSchema = new mongoose.Schema({
  // ... existing fields
  isForMobile: {
    type: Boolean,
    default: false  // Must be explicitly enabled in admin panel
  }
});
```

### React Admin Panel Updates

#### Update Product Form
```javascript
// frontend/src/pages/products/AddProduct.jsx or EditProduct.jsx

// Add checkbox to product form
<div className="form-group">
  <label>
    <input
      type="checkbox"
      checked={formData.isForMobile || false}
      onChange={(e) => setFormData({
        ...formData,
        isForMobile: e.target.checked
      })}
    />
    <span>Publish to Mobile Application</span>
  </label>
  <small>Enable this to make the product visible in the mobile app</small>
</div>
```

#### Update Online Orders List
```javascript
// frontend/src/pages/orders/OnlineOrders.jsx

// Ensure mobile orders are included
useEffect(() => {
  async function loadOrders() {
    const response = await apiGet('/api/orders'); // Gets all orders including mobile
    setOrders(response.orders);
  }
  loadOrders();
}, []);

// Add source badge to order list
<td>
  {order.source === 'mobile' && (
    <span className="badge badge-info">Mobile App</span>
  )}
  {!order.source || order.source === 'web' && (
    <span className="badge badge-secondary">Website</span>
  )}
</td>
```

## 🚀 Next Steps

### Phase 1: Authentication & Navigation (Week 1)
1. Create login screen with email/password
2. Create registration screen  
3. Build main navigation with bottom tabs
4. Create home tab with product grid

### Phase 2: Product Browsing (Week 1-2)
1. Create product card widget
2. Build product detail screen
3. Implement category filtering
4. Add search functionality

### Phase 3: Shopping Cart (Week 2)
1. Create cart screen UI
2. Implement add to cart
3. Update quantities
4. Calculate totals

### Phase 4: Checkout & Orders (Week 3)
1. Build checkout flow
2. Address selection/creation
3. Payment integration
4. Order confirmation
5. Order history screen

### Phase 5: Profile & Polish (Week 4)
1. User profile screen
2. Edit profile
3. Manage addresses
4. Testing and bug fixes
5. UI/UX improvements

## 📱 Running the App

### Prerequisites
```bash
# Install Flutter SDK
flutter --version

# Check for issues
flutter doctor
```

### Setup
```bash
cd mobile_app

# Get dependencies
flutter pub get

# Run on Android
flutter run

# Run on iOS (Mac only)
flutter run --device-id <ios-device-id>
```

### Build for Production
```bash
# Android APK
flutter build apk --release

# Android App Bundle (for Play Store)
flutter build appbundle --release

# iOS (Mac only)
flutter build ios --release
```

## 🔑 Key Integration Points

### 1. API Base URL
Update in `lib/core/config/api_config.dart`:
```dart
static const String baseUrl = 'https://hassanscode.com';
```

### 2. Authentication Flow
- App checks token on splash screen
- Token stored in secure storage
- Auto-login if valid token exists
- Logout clears token and navigates to login

### 3. Product Sync
- Only fetches products where `isForMobile: true`
- Admin panel controls visibility via checkbox
- Products automatically sync when mobile app refreshes

### 4. Order Tracking
- Orders created with `source: 'mobile'`
- Visible in admin panel's "Online Orders"
- Admin can filter by source if needed

## 📊 State Management Architecture

```
AuthProvider
  ├── User authentication state
  ├── Login/Register methods
  └── User profile data

ProductProvider
  ├── Product list
  ├── Filtering & Search
  └── Selected category

CartProvider
  ├── Cart items (local storage)
  ├── Add/Remove/Update
  └── Calculate totals

OrderProvider
  ├── Order creation
  ├── Order history
  └── Order details
```

## 🎨 Design Philosophy

This app follows modern e-commerce UI/UX principles:
- **Clean & Minimal**: No unnecessary clutter
- **Professional**: Business-appropriate tone
- **Intuitive**: Clear navigation and actions
- **Fast**: Optimized loading and caching
- **Responsive**: Adapts to all screen sizes

## 📝 Notes

- All screens follow Material Design 3 guidelines
- Uses Provider for state management (lightweight & performant)
- API calls are cached where appropriate
- Images are lazy-loaded with placeholders
- Error states are handled gracefully
- Loading states provide visual feedback

## 🆘 Support

For questions or issues:
1. Check this implementation guide
2. Review the README.md
3. Examine existing code patterns
4. Test API endpoints in Postman first
