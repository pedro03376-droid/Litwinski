import 'package:flutter_test/flutter_test.dart';
import 'package:gkhub/features/ai_analysis/data/repositories/ai_analysis_repository.dart';

void main() {
  Map<String, dynamic> analysisJson() => {
        'id': 'ai-1',
        'source': 'match',
        'strengths': ['Boa taxa de defesas', 'Sólido no alto'],
        'attentionPoints': ['Saídas em 1x1'],
        'evolutionNotes': ['+10% defesas'],
        'trainingSuggestions': ['Treino de reflexo'],
        'overallScore': 8.5,
        'createdAt': '2026-03-10T12:00:00.000Z',
      };

  group('AiAnalysis.fromJson', () {
    test('parses all list fields and score', () {
      final a = AiAnalysis.fromJson(analysisJson());
      expect(a.id, 'ai-1');
      expect(a.source, 'match');
      expect(a.strengths, hasLength(2));
      expect(a.strengths.first, 'Boa taxa de defesas');
      expect(a.attentionPoints, ['Saídas em 1x1']);
      expect(a.evolutionNotes, ['+10% defesas']);
      expect(a.trainingSuggestions, ['Treino de reflexo']);
      expect(a.overallScore, 8.5);
      expect(a.createdAt, DateTime.parse('2026-03-10T12:00:00.000Z'));
    });

    test('handles null list fields as empty lists', () {
      final a = AiAnalysis.fromJson({
        'id': 'ai-2',
        'source': 'training',
        'strengths': null,
        'attentionPoints': null,
        'evolutionNotes': null,
        'trainingSuggestions': null,
        'overallScore': null,
        'createdAt': null,
      });
      expect(a.strengths, isEmpty);
      expect(a.attentionPoints, isEmpty);
      expect(a.evolutionNotes, isEmpty);
      expect(a.trainingSuggestions, isEmpty);
      expect(a.overallScore, isNull);
      // createdAt falls back to "now" when absent — just ensure it's set.
      expect(a.createdAt, isNotNull);
    });

    test('coerces integer overallScore to double', () {
      final a = AiAnalysis.fromJson(analysisJson()..['overallScore'] = 7);
      expect(a.overallScore, 7.0);
    });

    test('defaults id and source when missing', () {
      final a = AiAnalysis.fromJson({});
      expect(a.id, '');
      expect(a.source, '');
      expect(a.strengths, isEmpty);
    });
  });
}
