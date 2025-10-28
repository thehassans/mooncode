# BuySial Mobile App

A professional cross-platform e-commerce mobile application built with Flutter for Android and iOS.

## Features

- **User Authentication**: Secure login and registration
- **Product Catalog**: Browse products synced from admin panel
- **Product Details**: View detailed product information
- **Shopping Cart**: Add, update, and remove items
- **Checkout**: Complete orders with shipping and payment
- **Order History**: Track past orders and statuses
- **User Profile**: Manage account details and addresses

## Backend Integration

This app integrates with the existing Node.js/React/MongoDB backend:

- **Product Sync**: Only shows products marked `isForMobile: true` in admin panel
- **Order Creation**: Orders placed in app appear in admin panel's "Online Orders"
- **User Management**: Shares authentication with existing system

## Getting Started

### Prerequisites

- Flutter SDK (3.0.0 or higher)
- Android Studio / Xcode
- Node.js backend running

### Installation

```bash
# Install dependencies
flutter pub get

# Run on Android
flutter run

# Run on iOS
flutter run --device-id <ios-device-id>

# Build for production
flutter build apk --release
flutter build ios --release
```

### Configuration

Edit `lib/core/config/api_config.dart` to set your backend URL:

```dart
static const String baseUrl = 'https://hassanscode.com';
```

## Project Structure

```
lib/
├── core/
│   ├── config/         # API and app configuration
│   ├── constants/      # Colors, strings, dimensions
│   ├── services/       # API services
│   └── utils/          # Helper functions
├── models/             # Data models
├── providers/          # State management
├── screens/            # UI screens
├── widgets/            # Reusable widgets
└── main.dart           # Entry point
```

## State Management

This app uses **Provider** for state management with the following providers:

- `AuthProvider`: User authentication and session
- `ProductProvider`: Product catalog and filtering
- `CartProvider`: Shopping cart management
- `OrderProvider`: Order history and creation

## API Endpoints

### Products
- `GET /api/products/mobile` - Get mobile products (isForMobile=true)
- `GET /api/products/mobile/:id` - Get product details

### Orders
- `POST /api/orders/create/mobile` - Create order from mobile app
- `GET /api/orders/mobile/user/:userId` - Get user's orders

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/users/me` - Get current user profile

## Design Philosophy

- **Clean & Modern**: Professional UI inspired by Amazon, Shopify
- **Intuitive UX**: Easy navigation and checkout flow
- **Performance**: Optimized images, caching, and loading states
- **Responsive**: Adapts to different screen sizes

## License

Proprietary - BuySial
