import 'package:flutter_test/flutter_test.dart';
import 'package:gkhub/features/matches/domain/entities/match.dart';

void main() {
  Map<String, dynamic> scoutJson() => {
        'id': 'scout-1',
        'matchId': 'match-1',
        'highSaveRight': 3,
        'highSaveLeft': 2,
        'lowSaveRight': 2,
        'lowSaveLeft': 1,
        'centralSave': 2,
        'launchRightFoot': 4,
        'launchLeftFoot': 1,
        'launchRightHand': 3,
        'interceptions': 5,
        'clearances': 2,
        'positionBaseLeft': 1,
        'positionBaseRight': 1,
        'goalOutsideArea': 1,
        'goalInsideArea': 1,
      };

  Map<String, dynamic> matchJson() => {
        'id': 'match-1',
        'date': '2026-03-10T00:00:00.000Z',
        'competition': 'Liga Nacional',
        'opponent': 'Rival FC',
        'location': 'home',
        'venue': 'Ginásio Central',
        'goalsScored': 3,
        'goalsConceded': 2,
        'result': 'win',
        'category': 'adulto',
        'observations': 'Bom jogo',
        'goalkeeperId': 'gk-1',
        'scouts': [scoutJson()],
      };

  group('GKMatch.fromJson', () {
    test('parses fields and nested scout', () {
      final m = GKMatch.fromJson(matchJson());
      expect(m.id, 'match-1');
      expect(m.competition, 'Liga Nacional');
      expect(m.opponent, 'Rival FC');
      expect(m.goalsScored, 3);
      expect(m.goalsConceded, 2);
      expect(m.result, 'win');
      expect(m.date, DateTime.parse('2026-03-10T00:00:00.000Z'));
      expect(m.scout, isNotNull);
      expect(m.scout!.interceptions, 5);
    });

    test('scout is null when scouts list is empty or missing', () {
      final m = GKMatch.fromJson(matchJson()..['scouts'] = []);
      expect(m.scout, isNull);
      final m2 = GKMatch.fromJson(matchJson()..remove('scouts'));
      expect(m2.scout, isNull);
    });

    test('falls back to defaults for missing fields', () {
      final m = GKMatch.fromJson({'id': 'm'});
      expect(m.competition, '');
      expect(m.opponent, '');
      expect(m.location, 'home');
      expect(m.goalsScored, 0);
      expect(m.goalsConceded, 0);
    });
  });

  group('GKMatch result helpers', () {
    test('isWin / isDraw / isLoss', () {
      expect(GKMatch.fromJson(matchJson()..['result'] = 'win').isWin, true);
      expect(GKMatch.fromJson(matchJson()..['result'] = 'draw').isDraw, true);
      expect(GKMatch.fromJson(matchJson()..['result'] = 'loss').isLoss, true);
    });

    test('isCleanSheet when no goals conceded', () {
      expect(
        GKMatch.fromJson(matchJson()..['goalsConceded'] = 0).isCleanSheet,
        true,
      );
      expect(
        GKMatch.fromJson(matchJson()..['goalsConceded'] = 1).isCleanSheet,
        false,
      );
    });
  });

  group('MatchScout computed stats', () {
    test('totalSaves sums all save types', () {
      final s = MatchScout.fromJson(scoutJson());
      // 3 + 2 + 2 + 1 + 2 = 10
      expect(s.totalSaves, 10);
    });

    test('totalGoals sums inside and outside area', () {
      final s = MatchScout.fromJson(scoutJson());
      expect(s.totalGoals, 2);
    });

    test('totalShots = saves + goals', () {
      final s = MatchScout.fromJson(scoutJson());
      expect(s.totalShots, 12);
    });

    test('savePercentage', () {
      final s = MatchScout.fromJson(scoutJson());
      expect(s.savePercentage, closeTo(10 / 12 * 100, 0.001));
    });

    test('savePercentage is 0 when there are no shots', () {
      final empty = {
        'id': 's',
        'matchId': 'm',
      };
      final s = MatchScout.fromJson(empty);
      expect(s.totalShots, 0);
      expect(s.savePercentage, 0);
    });
  });
}
