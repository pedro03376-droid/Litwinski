import 'package:flutter/foundation.dart';

@immutable
class Goalkeeper {
  final String id;
  final String name;
  final String? photo;
  final DateTime birthDate;
  final double? height;
  final double? weight;
  final String dominantHand;
  final String dominantFoot;
  final String category;
  final int? jerseyNumber;
  final String? observations;
  final String? teamId;
  final String? teamName;
  final bool isActive;
  final double? lastPerformanceScore;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Goalkeeper({
    required this.id,
    required this.name,
    this.photo,
    required this.birthDate,
    this.height,
    this.weight,
    required this.dominantHand,
    required this.dominantFoot,
    required this.category,
    this.jerseyNumber,
    this.observations,
    this.teamId,
    this.teamName,
    this.isActive = true,
    this.lastPerformanceScore,
    this.createdAt,
    this.updatedAt,
  });

  /// Calculated age in full years
  int get age {
    final today = DateTime.now();
    int years = today.year - birthDate.year;
    final hadBirthdayThisYear = today.month > birthDate.month ||
        (today.month == birthDate.month && today.day >= birthDate.day);
    if (!hadBirthdayThisYear) years--;
    return years;
  }

  /// Human-readable category label in pt-BR
  String get categoryLabel {
    const labels = {
      'adulto': 'Adulto',
      'juvenil': 'Juvenil',
      'infantil': 'Infantil',
      'infantojuvenil': 'Infantojuvenil',
      'sub17': 'Sub-17',
      'sub15': 'Sub-15',
      'sub13': 'Sub-13',
      'sub11': 'Sub-11',
      'sub09': 'Sub-09',
    };
    return labels[category.toLowerCase()] ?? category;
  }

  /// Dominant-hand label in pt-BR
  String get dominantHandLabel =>
      dominantHand.toLowerCase() == 'right' ? 'Destro' : 'Canhoto';

  /// Dominant-foot label in pt-BR
  String get dominantFootLabel =>
      dominantFoot.toLowerCase() == 'right' ? 'Pé Direito' : 'Pé Esquerdo';

  /// Initials derived from [name] (up to 2 characters)
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
  }

  factory Goalkeeper.fromJson(Map<String, dynamic> json) {
    return Goalkeeper(
      id: json['id'] as String,
      name: json['name'] as String,
      photo: json['photo'] as String?,
      birthDate: DateTime.parse(json['birth_date'] as String),
      height: (json['height'] as num?)?.toDouble(),
      weight: (json['weight'] as num?)?.toDouble(),
      dominantHand: json['dominant_hand'] as String? ?? 'right',
      dominantFoot: json['dominant_foot'] as String? ?? 'right',
      category: json['category'] as String? ?? 'adulto',
      jerseyNumber: json['jersey_number'] as int?,
      observations: json['observations'] as String?,
      teamId: json['team_id'] as String?,
      teamName: json['team_name'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      lastPerformanceScore:
          (json['last_performance_score'] as num?)?.toDouble(),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'photo': photo,
        'birth_date': birthDate.toIso8601String(),
        'height': height,
        'weight': weight,
        'dominant_hand': dominantHand,
        'dominant_foot': dominantFoot,
        'category': category,
        'jersey_number': jerseyNumber,
        'observations': observations,
        'team_id': teamId,
        'team_name': teamName,
        'is_active': isActive,
        'last_performance_score': lastPerformanceScore,
        'created_at': createdAt?.toIso8601String(),
        'updated_at': updatedAt?.toIso8601String(),
      };

  Goalkeeper copyWith({
    String? id,
    String? name,
    String? photo,
    DateTime? birthDate,
    double? height,
    double? weight,
    String? dominantHand,
    String? dominantFoot,
    String? category,
    int? jerseyNumber,
    String? observations,
    String? teamId,
    String? teamName,
    bool? isActive,
    double? lastPerformanceScore,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) =>
      Goalkeeper(
        id: id ?? this.id,
        name: name ?? this.name,
        photo: photo ?? this.photo,
        birthDate: birthDate ?? this.birthDate,
        height: height ?? this.height,
        weight: weight ?? this.weight,
        dominantHand: dominantHand ?? this.dominantHand,
        dominantFoot: dominantFoot ?? this.dominantFoot,
        category: category ?? this.category,
        jerseyNumber: jerseyNumber ?? this.jerseyNumber,
        observations: observations ?? this.observations,
        teamId: teamId ?? this.teamId,
        teamName: teamName ?? this.teamName,
        isActive: isActive ?? this.isActive,
        lastPerformanceScore:
            lastPerformanceScore ?? this.lastPerformanceScore,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Goalkeeper && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'Goalkeeper(id: $id, name: $name, category: $category)';
}
