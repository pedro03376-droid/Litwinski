import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/training_session.dart';

final trainingRepositoryProvider = Provider<TrainingRepository>((ref) {
  return TrainingRepository(ref.read(apiClientProvider));
});

class TrainingRepository {
  final ApiClient _api;
  TrainingRepository(this._api);

  Future<List<TrainingSession>> getAll({
    String? goalkeeperId,
    String? category,
    String? season,
    int page = 1,
    int perPage = 50,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'per_page': perPage,
      if (goalkeeperId != null) 'goalkeeperId': goalkeeperId,
      if (category != null) 'category': category,
      if (season != null) 'season': season,
    };
    final data = await _api.get<List<dynamic>>('/training', queryParameters: params);
    return (data ?? [])
        .map((e) => TrainingSession.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<TrainingSession> getById(String id) async {
    final data = await _api.get<Map<String, dynamic>>('/training/$id');
    return TrainingSession.fromJson(data);
  }

  Future<TrainingSession> create(Map<String, dynamic> data) async {
    final result = await _api.post<Map<String, dynamic>>('/training', data: data);
    return TrainingSession.fromJson(result);
  }

  Future<TrainingSession> update(String id, Map<String, dynamic> data) async {
    final result =
        await _api.patch<Map<String, dynamic>>('/training/$id', data: data);
    return TrainingSession.fromJson(result);
  }

  Future<void> delete(String id) => _api.delete('/training/$id');
}
