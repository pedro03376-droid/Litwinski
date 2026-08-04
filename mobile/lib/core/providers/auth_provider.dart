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

/// Lists the teams/clubs/national teams the current user belongs to.
final myWorkspacesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiClientProvider);
  final data = await api.get<List<dynamic>>('/teams/my-workspaces');
  return List<Map<String, dynamic>>.from(data ?? []);
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
    Map<String, dynamic>? user;
    try {
      user = await _api.get<Map<String, dynamic>>('/auth/me');
    } catch (_) {
      try {
        user = await _api.get<Map<String, dynamic>>('/auth/profile');
      } catch (_) {
        user = null;
      }
    }
    if (user == null) {
      await _storage.deleteAll();
      state = state.copyWith(isLoading: false, isAuthenticated: false);
      return;
    }
    state = state.copyWith(isLoading: false, isAuthenticated: true, user: user);
    _registerPush();
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _api.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      final token = data['accessToken'] as String?
          ?? data['access_token'] as String?
          ?? '';
      await _storage.write(key: AppConstants.tokenKey, value: token);
      final refreshToken = data['refreshToken'] as String?
          ?? data['refresh_token'] as String?
          ?? '';
      if (refreshToken.isNotEmpty) {
        await _storage.write(key: AppConstants.refreshTokenKey, value: refreshToken);
      }
      final user = data['user'] as Map<String, dynamic>?;
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: user,
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

  Future<bool> googleSignIn(String idToken, String? accessToken, Map<String, dynamic> userInfo) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      // Try backend Google auth endpoint first
      Map<String, dynamic> data;
      try {
        data = await _api.post<Map<String, dynamic>>(
          '/auth/google',
          data: {'idToken': idToken},
        );
      } catch (_) {
        // Fallback: use Firebase user info directly, get a session from backend
        data = await _api.post<Map<String, dynamic>>(
          '/auth/login-google',
          data: {'idToken': idToken, 'email': userInfo['email']},
        );
      }
      final token = data['accessToken'] as String? ?? data['access_token'] as String? ?? '';
      if (token.isEmpty) throw Exception('No token from backend');
      await _storage.write(key: AppConstants.tokenKey, value: token);
      final refreshToken = data['refreshToken'] as String?
          ?? data['refresh_token'] as String?
          ?? '';
      if (refreshToken.isNotEmpty) {
        await _storage.write(key: AppConstants.refreshTokenKey, value: refreshToken);
      }
      final user = data['user'] as Map<String, dynamic>? ?? userInfo;
      state = state.copyWith(isLoading: false, isAuthenticated: true, user: user);
      _registerPush();
      return true;
    } catch (e) {
      // No insecure fallback: without a real backend session token the app must
      // NOT consider the user authenticated (the Firebase idToken is not a valid
      // bearer for our API and would only produce 401s).
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        error: 'Erro ao autenticar com Google.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _unregisterPush();
    await _storage.deleteAll();
    state = const AuthState(isLoading: false, isAuthenticated: false);
  }

  /// Switches the active team/workspace: gets a new token scoped to [teamId]
  /// and persists it. The caller should then restart the app so every screen
  /// reloads with the new scope. Returns true on success.
  Future<bool> switchTeam(String teamId) async {
    try {
      final data = await _api.post<Map<String, dynamic>>(
        '/auth/switch-team',
        data: {'teamId': teamId},
      );
      final token = data['accessToken'] as String?
          ?? data['access_token'] as String?
          ?? '';
      if (token.isEmpty) return false;
      await _storage.write(key: AppConstants.tokenKey, value: token);
      return true;
    } catch (_) {
      return false;
    }
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
