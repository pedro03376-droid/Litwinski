import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/match.dart';

final matchRepositoryProvider = Provider<MatchRepository>(
  (ref) => MatchRepository(ref.read(apiClientProvider)),
);

class MatchRepository {
  final ApiClient _api;
  MatchRepository(this._api);

  Future<List<GKMatch>> getAll({
    String? goalkeeperId,
    String? result,
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/matches',
      queryParameters: {
        if (goalkeeperId != null) 'goalkeeperId': goalkeeperId,
        if (result != null) 'result': result,
        'page': page,
        'limit': limit,
      },
    );
    return (data['data'] as List? ?? [])
        .map((e) => GKMatch.fromJson(e))
        .toList();
  }

  Future<GKMatch> getById(String id) async {
    final data = await _api.get<Map<String, dynamic>>('/matches/$id');
    return GKMatch.fromJson(data);
  }

  Future<GKMatch> create(Map<String, dynamic> body) async {
    final data = await _api.post<Map<String, dynamic>>('/matches', data: body);
    return GKMatch.fromJson(data);
  }

  Future<GKMatch> update(String id, Map<String, dynamic> body) async {
    final data = await _api.patch<Map<String, dynamic>>('/matches/$id', data: body);
    return GKMatch.fromJson(data);
  }

  Future<void> delete(String id) => _api.delete('/matches/$id');

  Future<Map<String, dynamic>> getStats(String goalkeeperId) =>
      _api.get('/matches/stats/$goalkeeperId');

  Future<List<GKMatch>> getRecent(String goalkeeperId, {int limit = 5}) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/matches/recent/$goalkeeperId',
      queryParameters: {'limit': limit},
    );
    return (data as List? ?? []).map((e) => GKMatch.fromJson(e)).toList();
  }

  Future<MatchScout?> getScout(String matchId) async {
    try {
      final data =
          await _api.get<Map<String, dynamic>>('/scouts/match/$matchId');
      return MatchScout.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  Future<MatchScout> saveScout(String matchId, Map<String, dynamic> body) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/scouts/match/$matchId',
      data: body,
    );
    return MatchScout.fromJson(data);
  }
}
