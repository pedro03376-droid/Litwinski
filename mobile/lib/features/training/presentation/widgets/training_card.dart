import 'package:flutter/material.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import 'package:intl/intl.dart';

// ---------------------------------------------------------------------------
// Enums & extensions
// ---------------------------------------------------------------------------

/// Training intensity levels.
enum TrainingIntensity { baixa, media, alta, maxima }

extension TrainingIntensityExt on TrainingIntensity {
  String get label {
    switch (this) {
      case TrainingIntensity.baixa:
        return 'Baixa';
      case TrainingIntensity.media:
        return 'Média';
      case TrainingIntensity.alta:
        return 'Alta';
      case TrainingIntensity.maxima:
        return 'Máxima';
    }
  }

  Color get color {
    switch (this) {
      case TrainingIntensity.baixa:
        return AppColors.good;
      case TrainingIntensity.media:
        return AppColors.warning;
      case TrainingIntensity.alta:
        return const Color(0xFFFF7043);
      case TrainingIntensity.maxima:
        return AppColors.error;
    }
  }

  int get filledBars {
    switch (this) {
      case TrainingIntensity.baixa:
        return 1;
      case TrainingIntensity.media:
        return 2;
      case TrainingIntensity.alta:
        return 3;
      case TrainingIntensity.maxima:
        return 4;
    }
  }

  static TrainingIntensity fromString(String value) {
    switch (value.toLowerCase()) {
      case 'baixa':
      case 'low':
        return TrainingIntensity.baixa;
      case 'média':
      case 'media':
      case 'medium':
        return TrainingIntensity.media;
      case 'alta':
      case 'high':
        return TrainingIntensity.alta;
      case 'máxima':
      case 'maxima':
      case 'max':
        return TrainingIntensity.maxima;
      default:
        return TrainingIntensity.media;
    }
  }
}

/// Returns a colour associated with a given training category string.
Color categoryColor(String category) {
  switch (category.toLowerCase()) {
    case 'reflexo':
      return AppColors.cyan;
    case 'defesa alta':
      return AppColors.purple;
    case 'defesa baixa':
      return AppColors.success;
    case 'posicionamento':
      return AppColors.warning;
    case 'saída':
    case 'saida':
      return const Color(0xFFFF7043);
    case 'jogo com os pés':
    case 'jogo com os pes':
      return AppColors.purpleLight;
    case 'distribuição':
    case 'distribuicao':
      return AppColors.cyanLight;
    case 'interceptação':
    case 'interceptacao':
      return AppColors.good;
    case 'decisão':
    case 'decisao':
      return AppColors.elite;
    default:
      return AppColors.textSecondary;
  }
}

// ---------------------------------------------------------------------------
// TrainingCard widget
// ---------------------------------------------------------------------------

class TrainingCard extends StatelessWidget {
  final String id;
  final DateTime date;
  final String category;
  final TrainingIntensity intensity;

  /// Duration in minutes.
  final int durationMinutes;
  final String objective;
  final VoidCallback? onTap;

  const TrainingCard({
    super.key,
    required this.id,
    required this.date,
    required this.category,
    required this.intensity,
    required this.durationMinutes,
    required this.objective,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final catColor = categoryColor(category);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.textMuted.withOpacity(0.15),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top accent line
            Container(
              height: 3,
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
                color: catColor,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Row 1: date + duration
                  Row(
                    children: [
                      const Icon(
                        Icons.calendar_today_outlined,
                        size: 12,
                        color: AppColors.textMuted,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        DateFormat('dd MMM yyyy', 'pt_BR').format(date),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.timer_outlined,
                        size: 12,
                        color: AppColors.textMuted,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        _formatDuration(durationMinutes),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Row 2: category chip + intensity bar
                  Row(
                    children: [
                      _CategoryChip(label: category, color: catColor),
                      const Spacer(),
                      _IntensityBar(intensity: intensity),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Objective
                  Text(
                    objective,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(int minutes) {
    if (minutes < 60) return '${minutes}min';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m == 0 ? '${h}h' : '${h}h${m}min';
  }
}

// ---------------------------------------------------------------------------
// Private sub-widgets
// ---------------------------------------------------------------------------

class _CategoryChip extends StatelessWidget {
  final String label;
  final Color color;

  const _CategoryChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: color.withOpacity(0.15),
        border: Border.all(color: color.withOpacity(0.4), width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _IntensityBar extends StatelessWidget {
  final TrainingIntensity intensity;

  const _IntensityBar({required this.intensity});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          intensity.label,
          style: TextStyle(
            color: intensity.color,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: 5),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(4, (i) {
            final filled = i < intensity.filledBars;
            return Container(
              width: 5,
              height: 14,
              margin: const EdgeInsets.only(left: 2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: filled
                    ? intensity.color
                    : intensity.color.withOpacity(0.2),
              ),
            );
          }),
        ),
      ],
    );
  }
}
