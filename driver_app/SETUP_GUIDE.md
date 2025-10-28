# BuySial Driver App - Complete Setup Guide

## 📋 Prerequisites

### Required Software

1. **Flutter SDK** (3.0.0+)
   - Download from: https://flutter.dev/docs/get-started/install
   - Add Flutter to system PATH

2. **Android Studio** (Latest)
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API 34)
   - Install Android SDK Command-line Tools
   - Install Android SDK Build-Tools

3. **Visual Studio Code** (Optional but recommended)
   - Download from: https://code.visualstudio.com/
   - Install Flutter & Dart extensions

## 🚀 Step-by-Step Setup

### 1. Verify Flutter Installation

```bash
flutter doctor
```

Expected output should show:
- ✅ Flutter (Channel stable)
- ✅ Android toolchain
- ✅ Android Studio
- ✅ VS Code (if installed)

### 2. Clone Project

The project is already in your directory:
```
c:\Users\buysialllc\Desktop\mooncode\driver_app
```

### 3. Install Dependencies

```bash
cd c:\Users\buysialllc\Desktop\mooncode\driver_app
flutter pub get
```

This will install all packages listed in `pubspec.yaml`.

### 4. Configure API Endpoint

**Important:** Update the API URL to match your backend.

Open `lib/services/api_service.dart` and modify:

```dart
static const String baseUrl = 'https://hassanscode.com/api';
```

**For local development:**
- Android Emulator: `http://10.0.2.2:4000/api`
- Physical Device: `http://YOUR_COMPUTER_IP:4000/api`

### 5. Setup Android Device

**Option A: Physical Device**
1. Enable Developer Options on your Android phone
2. Enable USB Debugging
3. Connect phone via USB
4. Run: `flutter devices` (should show your device)

**Option B: Android Emulator**
1. Open Android Studio
2. Tools → Device Manager
3. Create a new Virtual Device (Pixel 5, API 34 recommended)
4. Start the emulator

### 6. Run the App

```bash
# Development mode (hot reload enabled)
flutter run

# Or select device explicitly
flutter run -d <device-id>

# List all devices
flutter devices
```

## 🏗️ Building APK

### Debug Build (For Testing)

```bash
flutter build apk --debug
```

Output: `build/app/outputs/flutter-apk/app-debug.apk`

### Release Build (For Production)

```bash
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`

### Optimized Build (Smaller Size)

```bash
flutter build apk --split-per-abi --release
```

This creates separate APKs for different architectures:
- `app-armeabi-v7a-release.apk` (32-bit ARM)
- `app-arm64-v8a-release.apk` (64-bit ARM)
- `app-x86_64-release.apk` (64-bit Intel)

## 📱 Installing APK

### Method 1: Direct Install

```bash
flutter install
```

### Method 2: Manual Install via ADB

```bash
adb install build/app/outputs/flutter-apk/app-release.apk
```

### Method 3: Share APK File

1. Copy APK to phone
2. Open file manager
3. Tap APK file
4. Allow "Install unknown apps" if prompted
5. Install

## 🐛 Troubleshooting

### Issue: "Flutter not found"

**Solution:**
```bash
# Windows
set PATH=%PATH%;C:\flutter\bin

# Permanently add to system PATH via Environment Variables
```

### Issue: "Android licenses not accepted"

**Solution:**
```bash
flutter doctor --android-licenses
# Accept all licenses by typing 'y'
```

### Issue: "Gradle build failed"

**Solution:**
```bash
cd android
./gradlew clean
cd ..
flutter clean
flutter pub get
flutter run
```

### Issue: "Unable to connect to backend"

**Solutions:**
1. Check if backend is running
2. Verify API URL in `api_service.dart`
3. For emulator, use `10.0.2.2` instead of `localhost`
4. For physical device, ensure phone and computer are on same network
5. Check firewall settings

### Issue: "App crashes on startup"

**Solutions:**
1. Clear app data: Settings → Apps → BuySial Driver → Storage → Clear Data
2. Rebuild: `flutter clean && flutter run`
3. Check logs: `flutter logs`

## 🔧 Development Tips

### Hot Reload

While app is running, press `r` in terminal to hot reload changes.

### Hot Restart

Press `R` (capital R) to restart the app completely.

### Debug Console

```bash
# View real-time logs
flutter logs

# View specific device logs
adb logcat -s flutter
```

### VS Code Debugging

1. Open project in VS Code
2. Press F5 to start debugging
3. Set breakpoints in code
4. Use debug console

## 📦 Project Structure Overview

```
driver_app/
├── lib/
│   ├── main.dart                 # Entry point
│   ├── providers/                # State management
│   ├── screens/                  # All UI screens
│   ├── services/                 # API & services
│   ├── utils/                    # Helpers & theme
│   └── widgets/                  # Reusable components
├── android/                      # Android config
├── assets/                       # Images & icons
└── pubspec.yaml                  # Dependencies
```

## 🎨 Customization

### Change App Name

1. Open `android/app/src/main/AndroidManifest.xml`
2. Modify `android:label="Your App Name"`

### Change App Icon

1. Replace files in `android/app/src/main/res/mipmap-*dpi/`
2. Or use: https://appicon.co/ to generate icons

### Change Package Name

1. Rename in `android/app/build.gradle`
2. Rename in `android/app/src/main/AndroidManifest.xml`
3. Rename folder structure in `android/app/src/main/kotlin/`

## 📊 Performance Optimization

### Enable R8 Optimization

Already configured in `build.gradle`:
```gradle
minifyEnabled true
shrinkResources true
```

### Reduce APK Size

```bash
# Remove unused resources
flutter build apk --split-per-abi --release

# Analyze APK size
flutter build apk --analyze-size
```

## 🔐 Security Notes

1. **Never commit API keys or tokens**
2. **Use ProGuard for code obfuscation** (already enabled)
3. **Implement certificate pinning** for production
4. **Use Flutter Secure Storage** for sensitive data

## 📱 Testing Checklist

Before release, test:
- [ ] Login/logout functionality
- [ ] All screens render correctly
- [ ] Pull to refresh works
- [ ] Order pickup/delivery actions
- [ ] Theme switching (dark/light)
- [ ] Network error handling
- [ ] Back button navigation
- [ ] Portrait/landscape modes
- [ ] Different screen sizes
- [ ] Low memory scenarios

## 🚀 Deployment Checklist

- [ ] Update version in `pubspec.yaml`
- [ ] Test on multiple devices
- [ ] Create release APK
- [ ] Test release APK
- [ ] Sign APK (if publishing to Play Store)
- [ ] Prepare Play Store assets (screenshots, description)
- [ ] Submit to Google Play

## 📞 Support

For issues or questions:
- Check logs: `flutter logs`
- Flutter docs: https://flutter.dev/docs
- Stack Overflow: https://stackoverflow.com/questions/tagged/flutter

## ✅ Quick Start Commands

```bash
# Complete setup from scratch
cd c:\Users\buysialllc\Desktop\mooncode\driver_app
flutter doctor
flutter pub get
flutter run

# Build release APK
flutter build apk --release

# Install on device
flutter install
```

---

**Ready to go!** 🎉

Your Flutter driver app is now set up and ready for development!
