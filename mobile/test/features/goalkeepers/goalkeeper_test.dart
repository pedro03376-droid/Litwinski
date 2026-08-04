import 'package:flutter_test/flutter_test.dart';
import 'package:gkhub/features/goalkeepers/domain/entities/goalkeeper.dart';

void main() {
  Map<String, dynamic> baseJson() => {
        'id': 'gk-1',
        'name': 'Ana Paula Silva',
        'photo': null,
        'birth_date': '2000-05-10T00:00:00.000Z',
        'height': 1.72,
        'weight': 65.5,
        'dominant_hand': 'right',
        'dominant_foot': 'left',
        'category': 'adulto',
        'jersey_number': 1,
        'observations': 'Boa reflexo',
        'team_id': 'team-1',
        'team_name': 'GK Hub',
        'is_active': true,
        'last_performance_score': 8.4,
        'created_at': '2024-01-01T00:00:00.000Z',
        'updated_at': '2024-06-01T00:00:00.000Z',
      };

  group('Goalkeeper.fromJson', () {
    test('parses all fields', () {
      final gk = Goalkeeper.fromJson(baseJson());
      expect(gk.id, 'gk-1');
      expect(gk.name, 'Ana Paula Silva');
      expect(gk.height, 1.72);
      expect(gk.weight, 65.5);
      expect(gk.dominantHand, 'right');
      expect(gk.dominantFoot, 'left');
      expect(gk.category, 'adulto');
      expect(gk.jerseyNumber, 1);
      expect(gk.teamName, 'GK Hub');
      expect(gk.isActive, true);
      expect(gk.lastPerformanceScore, 8.4);
      expect(gk.createdAt, isNotNull);
    });

    test('applies defaults for missing optional fields', () {
      final json = {
        'id': 'gk-2',
        'name': 'Bia',
        'birth_date': '2005-01-01T00:00:00.000Z',
      };
      final gk = Goalkeeper.fromJson(json);
      expect(gk.dominantHand, 'right');
      expect(gk.dominantFoot, 'right');
      expect(gk.category, 'adulto');
      expect(gk.isActive, true);
      expect(gk.height, isNull);
      expect(gk.jerseyNumber, isNull);
      expect(gk.createdAt, isNull);
    });

    test('integer height/weight are coerced to double', () {
      final json = baseJson()..['height'] = 2;
      final gk = Goalkeeper.fromJson(json);
      expect(gk.height, 2.0);
    });
  });

  group('Goalkeeper.toJson', () {
    test('round-trips through fromJson preserving identity fields', () {
      final gk = Goalkeeper.fromJson(baseJson());
      final json = gk.toJson();
      final again = Goalkeeper.fromJson(json);
      expect(again.id, gk.id);
      expect(again.name, gk.name);
      expect(again.category, gk.category);
      expect(again.dominantHand, gk.dominantHand);
      expect(again.height, gk.height);
    });
  });

  group('age', () {
    test('is exact on the birthday', () {
      final now = DateTime.now();
      final gk = Goalkeeper.fromJson(baseJson()
        ..['birth_date'] =
            DateTime(now.year - 20, now.month, now.day).toIso8601String());
      expect(gk.age, 20);
    });

    test('subtracts one year before the birthday this year', () {
      final now = DateTime.now();
      // Birthday is "tomorrow-ish": pick a clearly future month/day in this year.
      final futureMonth = now.month == 12 ? 12 : now.month + 1;
      final gk = Goalkeeper.fromJson(baseJson()
        ..['birth_date'] =
            DateTime(now.year - 20, futureMonth, 28).toIso8601String());
      // If birthday hasn't happened yet this year, age is 19.
      if (futureMonth > now.month) {
        expect(gk.age, 19);
      }
    });
  });

  group('labels', () {
    test('categoryLabel maps known categories', () {
      expect(
        Goalkeeper.fromJson(baseJson()..['category'] = 'sub17').categoryLabel,
        'Sub-17',
      );
      expect(
        Goalkeeper.fromJson(baseJson()..['category'] = 'juvenil').categoryLabel,
        'Juvenil',
      );
    });

    test('categoryLabel falls back to raw value when unknown', () {
      expect(
        Goalkeeper.fromJson(baseJson()..['category'] = 'xpto').categoryLabel,
        'xpto',
      );
    });

    test('dominantHandLabel and dominantFootLabel', () {
      final gk = Goalkeeper.fromJson(baseJson()
        ..['dominant_hand'] = 'right'
        ..['dominant_foot'] = 'left');
      expect(gk.dominantHandLabel, 'Destro');
      expect(gk.dominantFootLabel, 'Pé Esquerdo');
    });
  });

  group('initials', () {
    test('uses first and last name initials', () {
      final gk = Goalkeeper.fromJson(baseJson()..['name'] = 'Ana Paula Silva');
      expect(gk.initials, 'AS');
    });

    test('single name returns one initial', () {
      final gk = Goalkeeper.fromJson(baseJson()..['name'] = 'Bia');
      expect(gk.initials, 'B');
    });
  });

  group('copyWith & equality', () {
    test('copyWith overrides only provided fields', () {
      final gk = Goalkeeper.fromJson(baseJson());
      final updated = gk.copyWith(name: 'Novo Nome', jerseyNumber: 99);
      expect(updated.name, 'Novo Nome');
      expect(updated.jerseyNumber, 99);
      expect(updated.id, gk.id);
      expect(updated.category, gk.category);
    });

    test('equality is based on id', () {
      final a = Goalkeeper.fromJson(baseJson());
      final b = Goalkeeper.fromJson(baseJson()..['name'] = 'Outro');
      expect(a, equals(b));
      expect(a.hashCode, b.hashCode);
    });
  });
}
