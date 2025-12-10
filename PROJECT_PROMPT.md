# BuySial Commerce - Complete Project Prompt

## Project Overview

Build a **full-stack e-commerce order management and dropshipping platform** called "BuySial Commerce" with the following core capabilities:

- Multi-role access control (Admin, User/Owner, Agents, Managers, Investors)
- Order lifecycle management (creation → assignment → delivery → settlement)
- Product catalog with e-commerce storefront
- Financial tracking with commission and remittance systems
- WhatsApp integration for customer communication
- Shopify integration for dropshipping
- Real-time notifications via Socket.IO

---

## Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **WhatsApp**: @whiskeysockets/baileys
- **PDF Generation**: jspdf
- **File Uploads**: multer

### Frontend

- **Framework**: React 18 (Vite)
- **Routing**: React Router v6
- **Styling**: CSS (custom design system with dark mode)
- **Charts**: recharts
- **Icons**: lucide-react

---

## User Roles & Permissions

### 1. Admin

- Full system access
- Manage all users
- Branding, theme, SEO, banners
- Page management
- Navigation menu

### 2. User (Store Owner)

- Dashboard with sales analytics
- Order management (create, edit, track)
- Agent/Manager/Driver/Investor management
- Product catalog management
- Financial reports & settlements
- Shopify integration
- WhatsApp inbox
- Website customization
- API setup for integrations

### 3. Agent (Sales Representative)

- Dashboard with personal metrics
- Submit new orders
- View order history
- Track commission earnings
- Request payouts
- Access in-house products

### 4. Manager (Regional Manager)

- Dashboard for assigned country/region
- Create and manage agents
- Create and manage drivers
- Order assignment and tracking
- Driver settlement and finances
- Warehouse management
- Expense tracking

### 5. Investor

- View investment plans
- Track investments
- Monitor daily profits
- Referral program
- Withdrawal requests
- Profile management

---

## Core Modules

### Orders Module

```
Status Flow: pending → processing → shipped → picked → out_for_delivery → delivered
                                                    ↓
                                              cancelled / returned
```

**Order Fields:**

- Customer info (name, phone, address, city, country, location)
- Product(s) with quantities
- Shipping method (in-house driver, courier)
- Payment (COD amount, collected amount, balance)
- Driver assignment & commission
- Shopify/Website source tracking
- Invoice generation

### Products Module

- In-house products with variants
- SKU management
- Stock tracking per warehouse
- Image uploads (multiple)
- Category/brand organization
- Shopify sync flag
- Investor product allocation

### Finance Module

- **Agent Commissions**: Percentage-based, auto-calculated on delivery
- **Driver Commissions**: Per-order or percentage-based
- **Manager Settlements**: Track collections from drivers/agents
- **Investor Profits**: Sequential profit distribution from orders
- **Remittances**: Track money flow between roles
- **Expenses**: Company expense tracking

### Warehouse Module

- Multi-warehouse support
- Stock levels per location
- Stock restoration on cancellation/return
- Inventory adjustment logging

---

## Integrations

### WhatsApp (Baileys)

- QR code authentication
- Send/receive messages
- Auto-send invoice PDFs
- Chat assignment round-robin
- Quick replies
- Media support

### Shopify

- Product sync (one-way: BuySial → Shopify)
- Order webhooks (Shopify → BuySial)
- Automatic fulfillment updates
- Inventory sync
- Multi-store support

### E-commerce Website

- Public product catalog
- Product detail pages
- Shopping cart
- Checkout flow
- Online order creation
- Custom domain support

---

## Database Models

### User

```javascript
{
  firstName, lastName, email, password,
  phone, country, city,
  role: ['admin', 'user', 'agent', 'manager', 'investor', 'customer'],
  availability: ['available', 'away', 'busy', 'offline'],
  assignedCountry, assignedCountries[],
  managerPermissions: { canCreateAgents, canManageProducts, canCreateOrders, canCreateDrivers },
  investorProfile: { investmentAmount, profitAmount, profitPercentage, earnedProfit, status },
  driverProfile: { commissionPerOrder, commissionRate, totalCommission, paidCommission },
  payoutProfile: { method, accountName, bankName, iban, accountNumber },
  customDomain
}
```

### Order

```javascript
{
  customerName, customerPhone, customerAddress, city, orderCountry,
  locationLat, locationLng, preferredTiming,
  items: [{ productId, quantity }],
  createdBy, createdByRole,
  shipmentMethod, courierName, trackingNumber,
  deliveryBoy, driverCommission, shippingFee,
  codAmount, collectedAmount, balanceDue,
  status, shipmentStatus,
  invoiceNumber, total, discount,
  orderSource: ['manual', 'shopify', 'website'],
  shopifyOrderId, shopifyOrderNumber
}
```

### Product

```javascript
{
  name, description, sku, barcode,
  category, brand, images[],
  price, salePrice, onSale,
  stock, warehouseStock: Map,
  displayOnShopify, shopifyProductId,
  createdBy
}
```

### Remittance (Driver Settlements)

```javascript
{
  driver, manager, country,
  amount, status: ['pending', 'accepted'],
  codAmount, commissionAmount,
  ordersCount, pdf
}
```

---

## API Routes Structure

```
/api/auth         - Login, register, token refresh
/api/users        - User CRUD, role management
/api/orders       - Order CRUD, status updates, assignment
/api/products     - Product CRUD, stock management
/api/finance      - Settlements, commissions, expenses
/api/reports      - Sales reports, driver reports, analytics
/api/warehouse    - Warehouse management, stock levels
/api/shopify      - Shopify sync, webhooks
/api/wa           - WhatsApp connection, messaging
/api/settings     - App settings, branding
/api/notifications - In-app notifications
/api/support      - Support tickets
```

---

## Frontend Pages Structure

### Admin Panel (`/admin`)

- Dashboard, Users, Branding, Banners, Theme, SEO, Pages, Navigation

### User Panel (`/user`)

- Dashboard, Orders, Online Orders, Products, Warehouses
- Agents, Managers, Investors, Drivers
- Finances, Reports, Driver Reports, Insights
- Shopify, WhatsApp, API Setup, Profile Settings

### Agent Panel (`/agent`)

- Dashboard, Submit Orders, Order History
- In-house Products, Payout, Profile

### Manager Panel (`/manager`)

- Dashboard, Orders, Returned Orders
- Agents, Drivers, Driver Finances
- Warehouse, Expenses

### Investor Panel (`/investor`)

- Plans, My Investments, Referrals
- Withdraw, Profile

### Public E-commerce

- Product Catalog (`/`), Product Detail, Checkout
- Home, About, Contact, Categories
- Terms, Privacy

---

## Key Features

### Real-time Notifications

- Socket.IO integration
- Order status updates
- New order alerts
- Driver assignment notifications

### PDF Generation

- Order invoices
- Shipping labels (customizable)
- Commission receipts
- Monthly reports
- Settlement summaries

### Multi-Currency Support

- AED, SAR, OMR, BHD, INR, KWD, QAR, USD, CNY
- Currency-specific formatting

### Multi-Country Operations

- UAE, Saudi Arabia, Oman, Bahrain, India, Kuwait, Qatar
- Country-based filtering
- Manager country assignment

### Dark Mode

- Full theme support
- CSS variables based
- User preference persistence

---

## Deployment

### Plesk Deployment

- Node.js app configuration
- Frontend build served by backend
- Environment variables for config
- Nginx WebSocket proxy
- Git auto-deploy support

### Environment Variables

```
PORT=4000
MONGO_URI=mongodb://...
JWT_SECRET=...
CORS_ORIGIN=https://domain.com
PUBLIC_BASE_URL=https://domain.com
ENABLE_WA=true/false
SERVE_STATIC=true
```

---

## Directory Structure

```
/
├── backend/
│   └── src/
│       ├── index.js              # Express app entry
│       └── modules/
│           ├── config/           # DB, middleware config
│           ├── controllers/
│           ├── jobs/             # Background jobs
│           ├── middleware/       # Auth, roles
│           ├── models/           # Mongoose schemas
│           ├── routes/           # API endpoints
│           ├── services/         # Business logic
│           └── utils/            # Helpers, PDF generation
│
├── frontend/
│   └── src/
│       ├── App.jsx               # Router & routes
│       ├── api.js                # API client
│       ├── components/           # Shared components
│       ├── contexts/             # React contexts
│       ├── layout/               # Layout components
│       ├── pages/                # Page components
│       │   ├── admin/
│       │   ├── agent/
│       │   ├── ecommerce/
│       │   ├── finance/
│       │   ├── investor/
│       │   ├── manager/
│       │   ├── orders/
│       │   ├── site/
│       │   └── user/
│       ├── styles/               # CSS files
│       └── util/                 # Helper functions
│
└── docs/                         # README, guides
```

---

## Design Requirements

- **Premium UI/UX**: Modern, clean, professional design
- **Responsive**: Works on desktop and mobile
- **Dark Mode**: Full support with smooth transitions
- **Animations**: Subtle micro-interactions
- **Icons**: Lucide React icons
- **Colors**: Professional palette with accent colors
- **Typography**: Clean, readable fonts
