import 'package:flutter_test/flutter_test.dart';
import 'package:gkhub/features/training/domain/entities/training_session.dart';

void main() {
  Map<String, dynamic> resultJson() => {
        'id': 'res-1',
        'attempts': 10,
        'successes': 8,
        'errors': 2,
        'successPercentage': 80.0,
        'reactionTimeSeconds': 0.42,
        'observations': 'ok',
      };

  Map<String, dynamic> exerciseJson() => {
        'id': 'ex-1',
        'name': 'Reflexo curto',
        'objective': 'Velocidade de reação',
        'sets': 3,
        'repetitions': 12,
        'durationSeconds': 60,
        'trainingSessionId': 'ts-1',
        'result': resultJson(),
      };

  Map<String, dynamic> sessionJson() => {
        'id': 'ts-1',
        'date': '2026-03-01',
        'category': 'reflex',
        'objective': 'Trabalhar reflexos',
        'durationMinutes': 90,
        'intensity': 'high',
        'observations': 'sessão puxada',
        'season': '2026',
        'goalkeeperId': 'gk-1',
        'exercises': [exerciseJson()],
        'createdAt': '2026-03-01T10:00:00.000Z',
      };

  group('TrainingSession.fromJson', () {
    test('parses fields and nested exercises', () {
      final s = TrainingSession.fromJson(sessionJson());
      expect(s.id, 'ts-1');
      expect(s.category, 'reflex');
      expect(s.objective, 'Trabalhar reflexos');
      expect(s.durationMinutes, 90);
      expect(s.intensity, 'high');
      expect(s.goalkeeperId, 'gk-1');
      expect(s.exercises, hasLength(1));
      expect(s.exercises.first.name, 'Reflexo curto');
      expect(s.createdAt, isNotNull);
    });

    test('defaults intensity and empty exercises', () {
      final s = TrainingSession.fromJson({
        'id': 'ts-2',
        'goalkeeperId': 'gk-1',
      });
      expect(s.intensity, 'medium');
      expect(s.exercises, isEmpty);
      expect(s.durationMinutes, isNull);
      expect(s.createdAt, isNull);
    });
  });

  group('Exercise.fromJson', () {
    test('parses fields and nested result', () {
      final ex = Exercise.fromJson(exerciseJson());
      expect(ex.id, 'ex-1');
      expect(ex.sets, 3);
      expect(ex.repetitions, 12);
      expect(ex.result, isNotNull);
      expect(ex.result!.successes, 8);
    });

    test('result is null when absent', () {
      final ex = Exercise.fromJson(exerciseJson()..remove('result'));
      expect(ex.result, isNull);
    });
  });

  group('ExerciseResult.fromJson', () {
    test('parses numeric percentage and reaction time', () {
      final r = ExerciseResult.fromJson(resultJson());
      expect(r.attempts, 10);
      expect(r.successes, 8);
      expect(r.errors, 2);
      expect(r.successPercentage, 80.0);
      expect(r.reactionTimeSeconds, 0.42);
    });

    test('parses percentage delivered as string', () {
      final r = ExerciseResult.fromJson(resultJson()
        ..['successPercentage'] = '75.5'
        ..['reactionTimeSeconds'] = '0.5');
      expect(r.successPercentage, 75.5);
      expect(r.reactionTimeSeconds, 0.5);
    });

    test('null percentage stays null', () {
      final r = ExerciseResult.fromJson(resultJson()
        ..['successPercentage'] = null
        ..['reactionTimeSeconds'] = null);
      expect(r.successPercentage, isNull);
      expect(r.reactionTimeSeconds, isNull);
    });

    test('defaults counters to zero', () {
      final r = ExerciseResult.fromJson({'id': 'r'});
      expect(r.attempts, 0);
      expect(r.successes, 0);
      expect(r.errors, 0);
    });
  });
}
