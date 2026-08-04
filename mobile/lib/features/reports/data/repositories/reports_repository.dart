import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => ReportsRepository(ref.read(apiClientProvider)),
);

class ReportsRepository {
  final ApiClient _api;
  ReportsRepository(this._api);

  Future<List<Map<String, dynamic>>> getAll({String? goalkeeperId}) async {
    final data = await _api.get<List<dynamic>>(
      '/reports',
      queryParameters: {
        if (goalkeeperId != null) 'goalkeeperId': goalkeeperId,
      },
    );
    return List<Map<String, dynamic>>.from(data ?? []);
  }

  Future<Map<String, dynamic>> generateMatch({
    required String goalkeeperId,
    required String matchId,
  }) async {
    return _api.post('/reports/match',
        data: {'goalkeeperId': goalkeeperId, 'matchId': matchId});
  }

  Future<Map<String, dynamic>> generatePeriod({
    required String goalkeeperId,
    required DateTime dateFrom,
    required DateTime dateTo,
  }) async {
    return _api.post('/reports/period', data: {
      'goalkeeperId': goalkeeperId,
      'dateFrom': dateFrom.toIso8601String().split('T').first,
      'dateTo': dateTo.toIso8601String().split('T').first,
    });
  }

  Future<Map<String, dynamic>> generateTraining({
    required String goalkeeperId,
    required String trainingSessionId,
  }) async {
    return _api.post('/reports/training', data: {
      'goalkeeperId': goalkeeperId,
      'trainingSessionId': trainingSessionId,
    });
  }

  Future<void> delete(String id) => _api.delete('/reports/$id');

  /// Returns the full download URL for a report's PDF.
  String downloadUrl(String pdfPath, String baseUrl) {
    if (pdfPath.startsWith('http')) return pdfPath;
    // pdfPath is like /uploads/reports/xxx.pdf — prepend base origin
    final origin = Uri.parse(baseUrl).origin;
    return '$origin$pdfPath';
  }
}
