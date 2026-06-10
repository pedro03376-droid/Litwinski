class TrainingSession {
  final String id;
  final String date;
  final String category;
  final String objective;
  final int? durationMinutes;
  final String intensity;
  final String? observations;
  final String? season;
  final String goalkeeperId;
  final List<Exercise> exercises;
  final DateTime? createdAt;

  const TrainingSession({
    required this.id,
    required this.date,
    required this.category,
    required this.objective,
    this.durationMinutes,
    required this.intensity,
    this.observations,
    this.season,
    required this.goalkeeperId,
    this.exercises = const [],
    this.createdAt,
  });

  factory TrainingSession.fromJson(Map<String, dynamic> json) {
    return TrainingSession(
      id: json['id'] ?? '',
      date: json['date'] ?? '',
      category: json['category'] ?? '',
      objective: json['objective'] ?? '',
      durationMinutes: json['durationMinutes'],
      intensity: json['intensity'] ?? 'medium',
      observations: json['observations'],
      season: json['season'],
      goalkeeperId: json['goalkeeperId'] ?? '',
      exercises: (json['exercises'] as List? ?? [])
          .map((e) => Exercise.fromJson(e))
          .toList(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'date': date,
        'category': category,
        'objective': objective,
        'durationMinutes': durationMinutes,
        'intensity': intensity,
        'observations': observations,
        'season': season,
        'goalkeeperId': goalkeeperId,
      };
}

class Exercise {
  final String id;
  final String name;
  final String? objective;
  final int? sets;
  final int? repetitions;
  final int? durationSeconds;
  final String trainingSessionId;
  final ExerciseResult? result;

  const Exercise({
    required this.id,
    required this.name,
    this.objective,
    this.sets,
    this.repetitions,
    this.durationSeconds,
    required this.trainingSessionId,
    this.result,
  });

  factory Exercise.fromJson(Map<String, dynamic> json) {
    return Exercise(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      objective: json['objective'],
      sets: json['sets'],
      repetitions: json['repetitions'],
      durationSeconds: json['durationSeconds'],
      trainingSessionId: json['trainingSessionId'] ?? '',
      result: json['result'] != null
          ? ExerciseResult.fromJson(json['result'])
          : null,
    );
  }
}

class ExerciseResult {
  final String id;
  final int attempts;
  final int successes;
  final int errors;
  final double? successPercentage;
  final double? reactionTimeSeconds;
  final String? observations;

  const ExerciseResult({
    required this.id,
    required this.attempts,
    required this.successes,
    required this.errors,
    this.successPercentage,
    this.reactionTimeSeconds,
    this.observations,
  });

  factory ExerciseResult.fromJson(Map<String, dynamic> json) {
    return ExerciseResult(
      id: json['id'] ?? '',
      attempts: json['attempts'] ?? 0,
      successes: json['successes'] ?? 0,
      errors: json['errors'] ?? 0,
      successPercentage: json['successPercentage'] != null
          ? double.tryParse(json['successPercentage'].toString())
          : null,
      reactionTimeSeconds: json['reactionTimeSeconds'] != null
          ? double.tryParse(json['reactionTimeSeconds'].toString())
          : null,
      observations: json['observations'],
    );
  }
}
