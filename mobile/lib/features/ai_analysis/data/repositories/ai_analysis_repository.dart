import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';

class AiAnalysis {
  final String id;
  final String source;
  final List<String> strengths;
  final List<String> attentionPoints;
  final List<String> evolutionNotes;
  final List<String> trainingSuggestions;
  final double? overallScore;
  final DateTime createdAt;

  const AiAnalysis({
    required this.id,
    required this.source,
    required this.strengths,
    required this.attentionPoints,
    required this.evolutionNotes,
    required this.trainingSuggestions,
    this.overallScore,
    required this.createdAt,
  });

  factory AiAnalysis.fromJson(Map<String, dynamic> json) {
    List<String> _strings(dynamic v) =>
        v == null ? [] : List<String>.from(v as List);

    return AiAnalysis(
      id: json['id'] ?? '',
      source: json['source'] ?? '',
      strengths: _strings(json['strengths']),
      attentionPoints: _strings(json['attentionPoints']),
      evolutionNotes: _strings(json['evolutionNotes']),
      trainingSuggestions: _strings(json['trainingSuggestions']),
      overallScore: json['overallScore'] != null
          ? (json['overallScore'] as num).toDouble()
          : null,
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}

final aiAnalysisRepositoryProvider = Provider<AiAnalysisRepository>(
  (ref) => AiAnalysisRepository(ref.read(apiClientProvider)),
);

class AiAnalysisRepository {
  final ApiClient _api;
  AiAnalysisRepository(this._api);

  Future<List<AiAnalysis>> getForMatch(String matchId) async {
    final data =
        await _api.get<List<dynamic>>('/ai-analysis/match/$matchId');
    return (data ?? [])
        .map((e) => AiAnalysis.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<AiAnalysis>> getForTraining(String sessionId) async {
    final data =
        await _api.get<List<dynamic>>('/ai-analysis/training/$sessionId');
    return (data ?? [])
        .map((e) => AiAnalysis.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<AiAnalysis>> getForGoalkeeper(String goalkeeperId,
      {int limit = 10}) async {
    final data = await _api.get<List<dynamic>>(
      '/ai-analysis/goalkeeper/$goalkeeperId',
      queryParameters: {'limit': limit},
    );
    return (data ?? [])
        .map((e) => AiAnalysis.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AiAnalysis> generateForMatch({
    required String goalkeeperId,
    required String matchId,
    required Map<String, dynamic> metrics,
    Map<String, dynamic>? previousMetrics,
  }) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/ai-analysis/generate/match',
      data: {
        'goalkeeperId': goalkeeperId,
        'matchId': matchId,
        'metrics': metrics,
        if (previousMetrics != null) 'previousMetrics': previousMetrics,
      },
    );
    return AiAnalysis.fromJson(data);
  }

  Future<AiAnalysis> generateForTraining({
    required String goalkeeperId,
    required String trainingSessionId,
    required Map<String, dynamic> metrics,
  }) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/ai-analysis/generate/training',
      data: {
        'goalkeeperId': goalkeeperId,
        'trainingSessionId': trainingSessionId,
        'metrics': metrics,
      },
    );
    return AiAnalysis.fromJson(data);
  }
}
