import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import '../constants/app_constants.dart';
import '../network/api_client.dart';
import '../notifications/push_notification_service.dart';

final authStateProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(apiClientProvider));
});

class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final Map<String, dynamic>? user;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = true,
    this.user,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    Map<String, dynamic>? user,
    String? error,
  }) =>
      AuthState(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        isLoading: isLoading ?? this.isLoading,
        user: user ?? this.user,
        error: error ?? this.error,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;
  final _storage = const FlutterSecureStorage();

  AuthNotifier(this._api) : super(const AuthState()) {
    // Re-register the token with the backend whenever FCM rotates it.
    PushNotificationService.instance.onTokenRefresh = (token) async {
      if (state.isAuthenticated) await _sendToken(token);
    };
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final token = await _storage.read(key: AppConstants.tokenKey);
    if (token == null) {
      state = state.copyWith(isLoading: false, isAuthenticated: false);
      return;
    }
    try {
      final user = await _api.get<Map<String, dynamic>>('/auth/profile');
      state = state.copyWith(isLoading: false, isAuthenticated: true, user: user);
      _registerPush();
    } catch (_) {
      await _storage.deleteAll();
      state = state.copyWith(isLoading: false, isAuthenticated: false);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _api.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      await _storage.write(
        key: AppConstants.tokenKey,
        value: data['access_token'],
      );
      await _storage.write(
        key: AppConstants.refreshTokenKey,
        value: data['refresh_token'] ?? '',
      );
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: data['user'],
      );
      _registerPush();
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        error: 'Email ou senha incorretos.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _unregisterPush();
    await _storage.deleteAll();
    state = const AuthState(isLoading: false, isAuthenticated: false);
  }

  // ─── Push registration ──────────────────────────────────────────────────────

  /// Asks for permission, fetches the FCM token and registers it. Fire-and-forget.
  Future<void> _registerPush() async {
    final push = PushNotificationService.instance;
    if (!push.isAvailable) return;
    try {
      await push.requestPermission();
      final token = await push.getToken();
      if (token != null) await _sendToken(token);
    } catch (_) {
      // Push failures never block authentication.
    }
  }

  Future<void> _sendToken(String token) async {
    try {
      await _api.post('/notifications/subscribe', data: {
        'fcmToken': token,
        'deviceInfo': PushNotificationService.instance.deviceLabel(),
      });
    } catch (_) {}
  }

  Future<void> _unregisterPush() async {
    final push = PushNotificationService.instance;
    if (!push.isAvailable) return;
    try {
      final token = await push.getToken();
      if (token != null) {
        await _api.post('/notifications/unsubscribe', data: {'token': token});
      }
      await push.deleteToken();
    } catch (_) {}
  }

  bool get isAdmin => state.user?['role'] == 'admin';
  bool get isTechnicalStaff =>
      state.user?['role'] == 'technical_staff' || isAdmin;
}
