import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.read(apiClientProvider)),
);

class NotificationsRepository {
  final ApiClient _api;
  NotificationsRepository(this._api);

  Future<List<Map<String, dynamic>>> getAll({bool unreadOnly = false}) async {
    final data = await _api.get<List<dynamic>>(
      '/notifications',
      queryParameters: {'unreadOnly': unreadOnly},
    );
    return List<Map<String, dynamic>>.from(data ?? []);
  }

  Future<int> getUnreadCount() async {
    final data = await _api.get<Map<String, dynamic>>('/notifications/unread-count');
    return (data['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> markAsRead(String id) =>
      _api.patch('/notifications/$id/read');

  Future<void> markAllAsRead() =>
      _api.patch('/notifications/read-all');

  Future<void> delete(String id) => _api.delete('/notifications/$id');

  /// Registers an FCM token with the backend so the user can receive push.
  Future<void> subscribe(String fcmToken, {String? deviceInfo}) =>
      _api.post('/notifications/subscribe', data: {
        'fcmToken': fcmToken,
        if (deviceInfo != null) 'deviceInfo': deviceInfo,
      });

  /// Deactivates an FCM token (e.g. on logout).
  Future<void> unsubscribe(String fcmToken) =>
      _api.post('/notifications/unsubscribe', data: {'token': fcmToken});
}
