import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';

final performanceRepositoryProvider = Provider<PerformanceRepository>(
  (ref) => PerformanceRepository(ref.read(apiClientProvider)),
);

class PerformanceRepository {
  final ApiClient _api;
  PerformanceRepository(this._api);

  /// Global ranking. [season] and [limit] are optional.
  Future<List<Map<String, dynamic>>> getRanking({
    String? season,
    int limit = 20,
    int page = 1,
  }) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/performance/ranking',
      queryParameters: {
        if (season != null) 'season': season,
        'limit': limit,
        'page': page,
      },
    );
    return List<Map<String, dynamic>>.from(data['data'] as List? ?? []);
  }

  /// All-time or period performance summary for one goalkeeper.
  Future<Map<String, dynamic>> getByGoalkeeper(String goalkeeperId) =>
      _api.get('/performance/$goalkeeperId');

  /// Weekly / monthly / yearly evolution chart data.
  Future<List<Map<String, dynamic>>> getEvolution(
    String goalkeeperId, {
    String period = 'monthly',
  }) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/performance/evolution/$goalkeeperId',
      queryParameters: {'period': period},
    );
    return List<Map<String, dynamic>>.from(data['data'] as List? ?? []);
  }

  /// Compare two goalkeepers.
  Future<Map<String, dynamic>> compare(String idA, String idB) =>
      _api.get('/performance/compare', queryParameters: {'a': idA, 'b': idB});
}
