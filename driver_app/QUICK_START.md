# 🚀 Quick Start - BuySial Driver App

## ⚡ 3-Minute Setup

### 1. Open Terminal/PowerShell

Press `Win + R`, type `powershell`, press Enter

### 2. Navigate to Project

```powershell
cd C:\Users\buysialllc\Desktop\mooncode\driver_app
```

### 3. Install Dependencies

```powershell
flutter pub get
```

Wait ~30 seconds for packages to download.

### 4. Connect Device

**Option A: Android Emulator**
- Open Android Studio
- Click device dropdown (top right)
- Start an emulator

**Option B: Physical Android Phone**
- Enable Developer Options
- Enable USB Debugging
- Connect via USB cable

### 5. Verify Device

```powershell
flutter devices
```

You should see your device listed.

### 6. Run App

```powershell
flutter run
```

The app will build and install automatically (~2-3 minutes first time).

---

## 🔑 Test Login

Use any driver account from your database:

**Example:**
- Email: `driver@buysial.com`
- Password: `your_password`

---

## 🎯 Quick Commands

```powershell
# Run app
flutter run

# Build APK
flutter build apk --release

# Install APK on device
flutter install

# View logs
flutter logs

# Hot reload (while running)
Press 'r' in terminal

# Hot restart (while running)
Press 'R' in terminal

# Quit app
Press 'q' in terminal
```

---

## 📱 APK Location

After building, find your APK at:
```
C:\Users\buysialllc\Desktop\mooncode\driver_app\build\app\outputs\flutter-apk\app-release.apk
```

You can copy this file to any Android device and install it!

---

## ❓ Issues?

### App doesn't start?
```powershell
flutter clean
flutter pub get
flutter run
```

### Can't connect to backend?
Open `lib/services/api_service.dart` and check the `baseUrl`.

For local testing with emulator, use:
```dart
static const String baseUrl = 'http://10.0.2.2:4000/api';
```

### Need help?
Check `SETUP_GUIDE.md` for detailed troubleshooting.

---

## ✅ What's Included

- ✅ Login screen
- ✅ Dashboard with stats
- ✅ Orders panel (Assigned/Picked/Delivered)
- ✅ Delivery history
- ✅ Driver profile with level system
- ✅ Dark/Light theme toggle
- ✅ Complete API integration

---

## 🎉 You're Ready!

Start the app and test all features with a driver account!

**Need the full docs?**
- `README.md` - Project overview
- `SETUP_GUIDE.md` - Detailed setup
- `PROJECT_SUMMARY.md` - Complete feature list
