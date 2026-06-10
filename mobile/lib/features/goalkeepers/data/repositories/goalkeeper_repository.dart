import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gkhub/core/network/api_client.dart';
import '../../domain/entities/goalkeeper.dart';

final goalkeeperRepositoryProvider = Provider<GoalkeeperRepository>((ref) {
  return GoalkeeperRepository(ref.read(apiClientProvider));
});

class GoalkeeperRepository {
  final ApiClient _api;

  GoalkeeperRepository(this._api);

  /// Returns a paginated list of goalkeepers, optionally filtered.
  Future<List<Goalkeeper>> getAll({
    String? search,
    String? teamId,
    String? category,
    bool? isActive,
    int page = 1,
    int perPage = 20,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'per_page': perPage,
      if (search != null && search.isNotEmpty) 'search': search,
      if (teamId != null) 'team_id': teamId,
      if (category != null) 'category': category,
      if (isActive != null) 'is_active': isActive,
    };
    final data = await _api.get<List<dynamic>>(
      '/goalkeepers',
      queryParameters: params,
    );
    return data
        .map((e) => Goalkeeper.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Returns a single goalkeeper by [id].
  Future<Goalkeeper> getById(String id) async {
    final data = await _api.get<Map<String, dynamic>>('/goalkeepers/$id');
    return Goalkeeper.fromJson(data);
  }

  /// Creates a new goalkeeper record.
  Future<Goalkeeper> create(Map<String, dynamic> data) async {
    final result =
        await _api.post<Map<String, dynamic>>('/goalkeepers', data: data);
    return Goalkeeper.fromJson(result);
  }

  /// Updates an existing goalkeeper identified by [id].
  Future<Goalkeeper> update(String id, Map<String, dynamic> data) async {
    final result = await _api.patch<Map<String, dynamic>>(
      '/goalkeepers/$id',
      data: data,
    );
    return Goalkeeper.fromJson(result);
  }

  /// Permanently deletes a goalkeeper record by [id].
  Future<void> delete(String id) async {
    await _api.delete('/goalkeepers/$id');
  }

  /// Returns aggregate statistics for a goalkeeper.
  ///
  /// Response shape is backend-defined; typed as a generic map so callers can
  /// destructure what they need without a full typed model.
  Future<Map<String, dynamic>> getStats(String id) async {
    return _api.get<Map<String, dynamic>>('/goalkeepers/$id/stats');
  }

  /// Returns the performance evolution data for a goalkeeper over [period].
  ///
  /// [period] values: 'month', 'quarter', 'semester', 'year'.
  Future<Map<String, dynamic>> getEvolution(String id, String period) async {
    return _api.get<Map<String, dynamic>>(
      '/goalkeepers/$id/evolution',
      queryParameters: {'period': period},
    );
  }

  /// Uploads a profile photo for a goalkeeper using multipart form-data.
  Future<Goalkeeper> uploadPhoto(
    String id,
    String filePath, {
    void Function(int sent, int total)? onProgress,
  }) async {
    final fileName = filePath.split('/').last;
    final formData = FormData.fromMap({
      'photo': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    final result = await _api.upload<Map<String, dynamic>>(
      '/goalkeepers/$id/photo',
      formData,
      onProgress: onProgress,
    );
    return Goalkeeper.fromJson(result);
  }
}
