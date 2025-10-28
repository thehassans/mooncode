# BuySial Driver - Flutter Android App

A complete Flutter-based Android application for the BuySial driver panel, featuring the same UI/UX as the web version with full integration to the existing MongoDB backend.

## 🎯 Features

### ✅ Core Functionality
- **Authentication** - Secure login with JWT tokens
- **Dashboard** - Real-time stats and delivery metrics
- **Order Management** - View assigned, picked up, and delivered orders
- **Order Actions** - Pick up and deliver orders with confirmation dialogs
- **Order History** - Complete delivery history
- **Profile Management** - View driver level, stats, and settings
- **Dark/Light Theme** - Beautiful theme matching web design
- **Pull to Refresh** - All screens support pull-to-refresh

### 📱 Screens

1. **Splash Screen** - Loading screen with branding
2. **Login Screen** - Email/password authentication
3. **Dashboard** - Overview with wallet, stats, and recent orders
4. **Orders Panel** - Tabbed interface (Assigned, Picked, Delivered)
5. **History** - All delivered orders
6. **Profile** - Driver info, level progress, settings

### 🎨 UI/UX Features

- **Premium Design** - Gold gradient branding matching web app
- **Dark Mode** - Automatic theme switching
- **Bottom Navigation** - 4 main tabs (Dashboard, Panel, History, Me)
- **Status Badges** - Color-coded order statuses
- **Progress Indicators** - Driver level progression
- **Responsive Cards** - Beautiful order and stat cards
- **Loading States** - Smooth loading indicators

## 🏗️ Project Structure

```
driver_app/
├── lib/
│   ├── main.dart                 # App entry point
│   ├── providers/                # State management
│   │   ├── auth_provider.dart
│   │   ├── theme_provider.dart
│   │   └── order_provider.dart
│   ├── screens/                  # All app screens
│   │   ├── auth/
│   │   │   └── login_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   ├── dashboard/
│   │   │   └── dashboard_screen.dart
│   │   ├── orders/
│   │   │   ├── orders_panel_screen.dart
│   │   │   └── history_screen.dart
│   │   ├── profile/
│   │   │   └── profile_screen.dart
│   │   └── splash_screen.dart
│   ├── services/                 # API services
│   │   └── api_service.dart
│   ├── utils/                    # Utilities
│   │   └── theme.dart
│   └── widgets/                  # Reusable widgets
│       ├── stat_card.dart
│       └── order_card.dart
├── android/                      # Android-specific files
├── pubspec.yaml                  # Dependencies
└── README.md                     # This file
```

## 📦 Dependencies

```yaml
# UI & Design
google_fonts: ^6.1.0              # Inter font matching web
flutter_svg: ^2.0.9               # SVG support

# State Management
provider: ^6.1.1                  # Simple state management

# HTTP & API
http: ^1.1.2                      # HTTP requests
dio: ^5.4.0                       # Advanced HTTP client

# Storage
shared_preferences: ^2.2.2        # Local storage
flutter_secure_storage: ^9.0.0    # Secure token storage

# Utils
intl: ^0.19.0                     # Date formatting
uuid: ^4.3.3                      # UUID generation

# Features
flutter_local_notifications       # Push notifications
pull_to_refresh: ^2.0.0           # Pull to refresh
flutter_spinkit: ^5.2.0           # Loading animations
cached_network_image: ^3.3.1      # Image caching
```

## 🚀 Getting Started

### Prerequisites

- Flutter SDK (3.0.0 or higher)
- Android Studio / VS Code
- Android device or emulator

### Installation

1. **Clone the repository:**
   ```bash
   cd c:\Users\buysialllc\Desktop\mooncode\driver_app
   ```

2. **Install dependencies:**
   ```bash
   flutter pub get
   ```

3. **Configure API endpoint:**
   
   Open `lib/services/api_service.dart` and update the `baseUrl`:
   ```dart
   static const String baseUrl = 'https://hassanscode.com/api';
   ```

4. **Run the app:**
   ```bash
   flutter run
   ```

### Build APK

```bash
# Debug APK
flutter build apk --debug

# Release APK
flutter build apk --release

# Split APKs by ABI (smaller file size)
flutter build apk --split-per-abi
```

The APK will be located at:
`build/app/outputs/flutter-apk/app-release.apk`

## 🔐 Authentication

The app uses JWT token authentication:

1. User logs in with email/password
2. Backend returns JWT token and user data
3. Token is stored in `SharedPreferences`
4. Token is sent in `Authorization: Bearer <token>` header for all requests
5. On 401 response, user is logged out and redirected to login

## 🌐 API Integration

### Endpoints Used

- `POST /api/auth/login` - User login
- `GET /api/orders/driver/metrics` - Get driver stats
- `GET /api/orders/driver/list?status=<status>` - Get orders by status
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id/pickup` - Mark order as picked up
- `PATCH /api/orders/:id/deliver` - Mark order as delivered
- `GET /api/users/me` - Get user profile
- `PATCH /api/users/me/password` - Change password

### API Service

All API calls go through `ApiService` class:

```dart
// Example usage
final orders = await ApiService.getDriverOrders('assigned');
await ApiService.pickupOrder(orderId);
```

## 🎨 Theme System

The app supports dark and light themes:

### Colors (matching web design)

- **Primary Gold:** `#D4AF37`
- **Success:** `#10B981`
- **Warning:** `#F59E0B`
- **Danger:** `#EF4444`
- **Info:** `#3B82F6`

### Usage

```dart
// Access theme colors
AppTheme.primaryGold
AppTheme.success
AppTheme.darkBg
AppTheme.lightPanel

// Toggle theme
final themeProvider = Provider.of<ThemeProvider>(context);
themeProvider.toggleTheme();
```

## 📊 State Management

Using Provider for state management:

### Providers

1. **AuthProvider** - User authentication state
2. **ThemeProvider** - Theme (dark/light) state
3. **OrderProvider** - Orders and metrics state

### Usage

```dart
// Access provider
final orderProvider = Provider.of<OrderProvider>(context);

// Call methods
await orderProvider.fetchOrders('assigned');
await orderProvider.pickupOrder(orderId);

// Access data
final orders = orderProvider.getOrders('assigned');
final metrics = orderProvider.metrics;
```

## 🔔 Future Enhancements

- [ ] Push notifications for new orders
- [ ] Real-time updates via WebSocket
- [ ] Google Maps integration for navigation
- [ ] Camera integration for delivery proof
- [ ] Offline mode support
- [ ] Biometric authentication
- [ ] Multi-language support
- [ ] In-app chat with support

## 📱 Screenshots

(Add screenshots of the app here)

## 🐛 Troubleshooting

### Common Issues

1. **API Connection Error:**
   - Ensure backend is running
   - Check API URL in `api_service.dart`
   - For emulator, use `http://10.0.2.2:4000/api` for localhost

2. **Build Errors:**
   - Run `flutter clean`
   - Run `flutter pub get`
   - Restart IDE

3. **Theme Not Changing:**
   - Clear app data and restart
   - Check SharedPreferences permissions

## 📄 License

This project is proprietary software for BuySial.

## 👥 Team

Developed for BuySial Logistics Platform

## 📞 Support

For technical support, contact: support@buysial.com

---

**Version:** 1.0.0  
**Last Updated:** October 2025  
**Platform:** Flutter / Android
