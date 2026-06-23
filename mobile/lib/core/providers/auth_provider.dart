import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import '../constants/app_constants.dart';
import '../network/api_client.dart';

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
      final user = data['user'] as Map<String, dynamic>? ?? userInfo;
      state = state.copyWith(isLoading: false, isAuthenticated: true, user: user);
      return true;
    } catch (e) {
      // If backend doesn't support Google auth, create local session from Firebase token
      try {
        await _storage.write(key: AppConstants.tokenKey, value: idToken);
        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          user: userInfo,
          error: null,
        );
        return true;
      } catch (_) {
        state = state.copyWith(
          isLoading: false,
          error: 'Erro ao autenticar com Google.',
        );
        return false;
      }
    }
  }

  Future<void> logout() async {
    await _storage.deleteAll();
    state = const AuthState(isLoading: false, isAuthenticated: false);
  }

  bool get isAdmin => state.user?['role'] == 'admin';
  bool get isTechnicalStaff =>
      state.user?['role'] == 'technical_staff' || isAdmin;
}
