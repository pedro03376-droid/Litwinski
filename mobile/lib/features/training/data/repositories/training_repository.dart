import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/training_session.dart';

final trainingRepositoryProvider = Provider<TrainingRepository>(
  (ref) => TrainingRepository(ref.read(apiClientProvider)),
);

class TrainingRepository {
  final ApiClient _api;
  TrainingRepository(this._api);

  Future<List<TrainingSession>> getAll({
    String? goalkeeperId,
    String? category,
    String? intensity,
    String? season,
    int page = 1,
    int limit = 50,
  }) async {
    final data = await _api.get<List<dynamic>>(
      '/training',
      queryParameters: {
        if (goalkeeperId != null) 'goalkeeperId': goalkeeperId,
        if (category != null) 'category': category,
        if (intensity != null) 'intensity': intensity,
        if (season != null) 'season': season,
        'page': page,
        'limit': limit,
      },
    );
    return (data ?? []).map((e) => TrainingSession.fromJson(e)).toList();
  }

  Future<TrainingSession> getById(String id) async {
    final data = await _api.get<Map<String, dynamic>>('/training/$id');
    return TrainingSession.fromJson(data);
  }

  Future<TrainingSession> create(Map<String, dynamic> body) async {
    final data = await _api.post<Map<String, dynamic>>('/training', data: body);
    return TrainingSession.fromJson(data);
  }

  Future<TrainingSession> update(String id, Map<String, dynamic> body) async {
    final data = await _api.patch<Map<String, dynamic>>('/training/$id', data: body);
    return TrainingSession.fromJson(data);
  }

  Future<void> delete(String id) => _api.delete('/training/$id');

  Future<Map<String, dynamic>> getStats(String goalkeeperId) =>
      _api.get('/training/stats/$goalkeeperId');

  Future<TrainingSession> addExercise(String sessionId, Map<String, dynamic> body) async {
    await _api.post<Map<String, dynamic>>('/training/$sessionId/exercises', data: body);
    return getById(sessionId);
  }

  Future<void> updateExercise(String exerciseId, Map<String, dynamic> body) =>
      _api.patch('/training/exercises/$exerciseId', data: body);

  Future<void> addExerciseResult(String exerciseId, Map<String, dynamic> body) =>
      _api.post('/training/exercises/$exerciseId/results', data: body);
}
