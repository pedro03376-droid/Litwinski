import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCtqk0eP9a3ZlLF__OaWS2jUJuN2KgH10o',
    authDomain: 'gkhub-4717d.firebaseapp.com',
    databaseURL: 'https://gkhub-4717d-default-rtdb.firebaseio.com',
    projectId: 'gkhub-4717d',
    storageBucket: 'gkhub-4717d.firebasestorage.app',
    messagingSenderId: '338475414522',
    appId: '1:338475414522:web:d9f5e20ea1f583dd392a43',
  );

  // Android: register app in Firebase Console → Project Settings → Android
  // Download google-services.json and place in mobile/android/app/
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCtqk0eP9a3ZlLF__OaWS2jUJuN2KgH10o',
    authDomain: 'gkhub-4717d.firebaseapp.com',
    databaseURL: 'https://gkhub-4717d-default-rtdb.firebaseio.com',
    projectId: 'gkhub-4717d',
    storageBucket: 'gkhub-4717d.firebasestorage.app',
    messagingSenderId: '338475414522',
    appId: '1:338475414522:android:REPLACE_WITH_ANDROID_APP_ID',
  );

  // iOS: register app in Firebase Console → Project Settings → iOS
  // Download GoogleService-Info.plist and place in mobile/ios/Runner/
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCtqk0eP9a3ZlLF__OaWS2jUJuN2KgH10o',
    authDomain: 'gkhub-4717d.firebaseapp.com',
    databaseURL: 'https://gkhub-4717d-default-rtdb.firebaseio.com',
    projectId: 'gkhub-4717d',
    storageBucket: 'gkhub-4717d.firebasestorage.app',
    messagingSenderId: '338475414522',
    appId: '1:338475414522:ios:REPLACE_WITH_IOS_APP_ID',
    iosClientId: 'REPLACE_WITH_IOS_CLIENT_ID',
    iosBundleId: 'com.gkhub.app',
  );
}
