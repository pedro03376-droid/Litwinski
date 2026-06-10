import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ScoreCard extends StatelessWidget {
  final String label;
  final double score;
  final double? previousScore;

  const ScoreCard({
    super.key,
    required this.label,
    required this.score,
    this.previousScore,
  });

  Color get _scoreColor {
    if (score >= 9) return AppColors.elite;
    if (score >= 8) return AppColors.success;
    if (score >= 7) return AppColors.cyan;
    if (score >= 5) return AppColors.warning;
    return AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    final trend = previousScore == null
        ? 0.0
        : score - previousScore!;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: _scoreColor, width: 3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                score.toStringAsFixed(1),
                style: TextStyle(
                    color: _scoreColor,
                    fontSize: 24,
                    fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              if (previousScore != null)
                _TrendArrow(trend: trend),
            ],
          ),
          LinearProgressIndicator(
            value: score / 10,
            backgroundColor: AppColors.darkElevated,
            valueColor: AlwaysStoppedAnimation(_scoreColor),
            minHeight: 3,
            borderRadius: BorderRadius.circular(2),
          ),
        ],
      ),
    );
  }
}

class _TrendArrow extends StatelessWidget {
  final double trend;
  const _TrendArrow({required this.trend});

  @override
  Widget build(BuildContext context) {
    if (trend.abs() < 0.05) {
      return const Icon(Icons.remove, size: 14, color: AppColors.textMuted);
    }
    if (trend > 0) {
      return const Icon(Icons.arrow_upward, size: 14, color: AppColors.success);
    }
    return const Icon(Icons.arrow_downward, size: 14, color: AppColors.error);
  }
}
