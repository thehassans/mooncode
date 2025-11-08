# Logo Setup Instructions

## Copy the BuySial Logo

Please manually copy the logo file to complete the setup:

```bash
# Run this command in PowerShell from the mooncode directory:
Copy-Item -Path "frontend\public\BuySial2.png" -Destination "mobile_app\assets\images\buysial2.png"
```

Or manually:
1. Navigate to `frontend/public/` folder
2. Copy the file `BuySial2.png`
3. Navigate to `mobile_app/assets/images/` folder
4. Paste and rename it to `buysial2.png` (lowercase)

The app has been configured to use this logo in:
- Splash/Loading screen
- Home screen header (top left)

## What's been fixed:

1. ✅ Logo added to loading screen
2. ✅ Logo added to header (top left)
3. ✅ API endpoint changed to use public products endpoint (`/api/products/public`)
4. ✅ Products filter for `displayOnWebsite: true` (backend automatically filters)
5. ✅ Cart functionality is working correctly
6. ✅ Assets configuration added to pubspec.yaml

## To Display Products on Mobile App:

In your user panel (frontend), when you add or edit a product:
1. Check the **"Display on Website"** checkbox
2. This will make the product visible in the mobile app
3. The mobile app fetches products from `/api/products/public` which only returns products with `displayOnWebsite: true`

## Next Steps:

1. Copy the logo file as described above
2. Run `flutter pub get` to refresh dependencies
3. Run `flutter run` to start the app
