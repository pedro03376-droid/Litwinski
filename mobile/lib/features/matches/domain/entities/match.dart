class GKMatch {
  final String id;
  final DateTime date;
  final String competition;
  final String opponent;
  final String location;
  final String? venue;
  final int goalsScored;
  final int goalsConceded;
  final String? result;
  final String? category;
  final String? observations;
  final String goalkeeperId;
  final MatchScout? scout;

  const GKMatch({
    required this.id,
    required this.date,
    required this.competition,
    required this.opponent,
    required this.location,
    this.venue,
    required this.goalsScored,
    required this.goalsConceded,
    this.result,
    this.category,
    this.observations,
    required this.goalkeeperId,
    this.scout,
  });

  bool get isWin => result == 'win';
  bool get isDraw => result == 'draw';
  bool get isLoss => result == 'loss';
  bool get isCleanSheet => goalsConceded == 0;

  factory GKMatch.fromJson(Map<String, dynamic> json) {
    return GKMatch(
      id: json['id'] ?? '',
      date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
      competition: json['competition'] ?? '',
      opponent: json['opponent'] ?? '',
      location: json['location'] ?? 'home',
      venue: json['venue'],
      goalsScored: json['goalsScored'] ?? 0,
      goalsConceded: json['goalsConceded'] ?? 0,
      result: json['result'],
      category: json['category'],
      observations: json['observations'],
      goalkeeperId: json['goalkeeperId'] ?? '',
      scout: json['scouts'] != null && (json['scouts'] as List).isNotEmpty
          ? MatchScout.fromJson((json['scouts'] as List).first)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'date': date.toIso8601String().split('T').first,
        'competition': competition,
        'opponent': opponent,
        'location': location,
        'venue': venue,
        'goalsScored': goalsScored,
        'goalsConceded': goalsConceded,
        'result': result,
        'category': category,
        'observations': observations,
        'goalkeeperId': goalkeeperId,
      };
}

class MatchScout {
  final String id;
  final String matchId;
  final int highSaveRight;
  final int highSaveLeft;
  final int lowSaveRight;
  final int lowSaveLeft;
  final int centralSave;
  final int launchRightFoot;
  final int launchLeftFoot;
  final int launchRightHand;
  final int interceptions;
  final int clearances;
  final int positionBaseLeft;
  final int positionBaseRight;
  final int goalOutsideArea;
  final int goalInsideArea;
  final Map<String, dynamic>? heatmapData;

  const MatchScout({
    required this.id,
    required this.matchId,
    this.highSaveRight = 0,
    this.highSaveLeft = 0,
    this.lowSaveRight = 0,
    this.lowSaveLeft = 0,
    this.centralSave = 0,
    this.launchRightFoot = 0,
    this.launchLeftFoot = 0,
    this.launchRightHand = 0,
    this.interceptions = 0,
    this.clearances = 0,
    this.positionBaseLeft = 0,
    this.positionBaseRight = 0,
    this.goalOutsideArea = 0,
    this.goalInsideArea = 0,
    this.heatmapData,
  });

  int get totalSaves =>
      highSaveRight + highSaveLeft + lowSaveRight + lowSaveLeft + centralSave;
  int get totalGoals => goalOutsideArea + goalInsideArea;
  int get totalShots => totalSaves + totalGoals;
  double get savePercentage =>
      totalShots == 0 ? 0 : (totalSaves / totalShots) * 100;

  factory MatchScout.fromJson(Map<String, dynamic> json) {
    return MatchScout(
      id: json['id'] ?? '',
      matchId: json['matchId'] ?? '',
      highSaveRight: json['highSaveRight'] ?? 0,
      highSaveLeft: json['highSaveLeft'] ?? 0,
      lowSaveRight: json['lowSaveRight'] ?? 0,
      lowSaveLeft: json['lowSaveLeft'] ?? 0,
      centralSave: json['centralSave'] ?? 0,
      launchRightFoot: json['launchRightFoot'] ?? 0,
      launchLeftFoot: json['launchLeftFoot'] ?? 0,
      launchRightHand: json['launchRightHand'] ?? 0,
      interceptions: json['interceptions'] ?? 0,
      clearances: json['clearances'] ?? 0,
      positionBaseLeft: json['positionBaseLeft'] ?? 0,
      positionBaseRight: json['positionBaseRight'] ?? 0,
      goalOutsideArea: json['goalOutsideArea'] ?? 0,
      goalInsideArea: json['goalInsideArea'] ?? 0,
      heatmapData: json['heatmapData'],
    );
  }

  Map<String, dynamic> toJson() => {
        'matchId': matchId,
        'highSaveRight': highSaveRight,
        'highSaveLeft': highSaveLeft,
        'lowSaveRight': lowSaveRight,
        'lowSaveLeft': lowSaveLeft,
        'centralSave': centralSave,
        'launchRightFoot': launchRightFoot,
        'launchLeftFoot': launchLeftFoot,
        'launchRightHand': launchRightHand,
        'interceptions': interceptions,
        'clearances': clearances,
        'positionBaseLeft': positionBaseLeft,
        'positionBaseRight': positionBaseRight,
        'goalOutsideArea': goalOutsideArea,
        'goalInsideArea': goalInsideArea,
      };
}
