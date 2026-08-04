import 'dart:io' show Platform;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Top-level background handler — required by firebase_messaging.
/// Must be a top-level (or static) function annotated with @pragma.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase must be initialized in the background isolate.
  await Firebase.initializeApp();
  // No UI work here — the OS shows the notification automatically when the
  // payload carries a `notification` block. Data-only messages are ignored
  // in the background by design.
}

/// Handles Firebase Cloud Messaging: initialization, permissions, token
/// retrieval, and rendering foreground messages as local notifications.
///
/// Designed to degrade gracefully: if Firebase is not configured
/// (no google-services.json / GoogleService-Info.plist), every method is a
/// no-op and the app keeps working without push.
class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  bool _available = false;
  bool _initialized = false;

  /// Callback registered by the app to send the token to the backend.
  Future<void> Function(String token)? onTokenRefresh;

  bool get isAvailable => _available;

  /// Initializes Firebase + local notifications. Safe to call once at startup.
  /// Returns true if FCM is available on this device/build.
  Future<bool> init() async {
    if (_initialized) return _available;
    _initialized = true;

    try {
      // main() already calls Firebase.initializeApp(options: ...). Only
      // initialize here if that hasn't happened yet (e.g. a different entry).
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      _available = true;
    } catch (e) {
      // Firebase not configured for this build — push disabled, app continues.
      debugPrint('[Push] Firebase not configured, push disabled: $e');
      _available = false;
      return false;
    }

    // Background handler.
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Local notifications channel (Android needs an explicit channel).
    const androidInit =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    const channel = AndroidNotificationChannel(
      'gkhub_default',
      'Notificações GKHUB',
      description: 'Alertas de desempenho, relatórios e lembretes.',
      importance: Importance.high,
    );
    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // Foreground messages → show a local notification (FCM does not display
    // notifications automatically while the app is in the foreground).
    FirebaseMessaging.onMessage.listen(_showForeground);

    // Token refresh → re-register with the backend.
    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      onTokenRefresh?.call(token);
    });

    return true;
  }

  /// Requests notification permission (iOS / Android 13+).
  Future<bool> requestPermission() async {
    if (!_available) return false;
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Returns the current FCM registration token, or null if unavailable.
  Future<String?> getToken() async {
    if (!_available) return null;
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('[Push] getToken failed: $e');
      return null;
    }
  }

  /// Deletes the current token (used on logout to stop delivery).
  Future<void> deleteToken() async {
    if (!_available) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  /// A short device description stored alongside the subscription.
  String deviceLabel() {
    try {
      if (Platform.isAndroid) return 'Android';
      if (Platform.isIOS) return 'iOS';
    } catch (_) {}
    return 'Unknown';
  }

  void _showForeground(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _local.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'gkhub_default',
          'Notificações GKHUB',
          channelDescription:
              'Alertas de desempenho, relatórios e lembretes.',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: message.data.isNotEmpty ? message.data.toString() : null,
    );
  }
}
