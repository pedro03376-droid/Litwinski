# GK Hub — Mobile App Setup

## Prerequisites
- Flutter SDK 3.19+
- Android Studio / Xcode
- Firebase Console access (project: gkhub-4717d)

## Firebase Setup (required for Google Sign-In)

### Android
1. Go to [Firebase Console](https://console.firebase.google.com) → gkhub-4717d
2. Add Android app with package name: `com.gkhub.app`
3. Download `google-services.json` and replace `mobile/android/app/google-services.json`
4. In Authentication → Authorized domains, add your domain

### iOS
1. Add iOS app with bundle ID: `com.gkhub.app`
2. Download `GoogleService-Info.plist` → place in `mobile/ios/Runner/`
3. Update `lib/firebase_options.dart` with your iOS appId and iosClientId

## Build

### Android APK (for direct installation)
```bash
cd mobile
flutter pub get
flutter build apk --release --dart-define=API_BASE_URL=https://litwinski-production.up.railway.app/api/v1
```
APK will be at: `build/outputs/flutter-apk/app-release.apk`

### Android APK (debug, no signing required)
```bash
flutter build apk --debug
```

### iOS (requires macOS + Xcode)
```bash
flutter build ios --release
```

## Development
```bash
flutter pub get
flutter run
```
