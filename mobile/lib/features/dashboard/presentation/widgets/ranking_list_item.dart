import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/gk_avatar.dart';
import '../../../../shared/widgets/performance_badge.dart';

class RankingListItem extends StatelessWidget {
  final int rank;
  final String name;
  final String? team;
  final double overallScore;
  final String? classification;
  final double? previousScore;
  final String? photoUrl;

  const RankingListItem({
    super.key,
    required this.rank,
    required this.name,
    this.team,
    required this.overallScore,
    this.classification,
    this.previousScore,
    this.photoUrl,
  });

  @override
  Widget build(BuildContext context) {
    final trend = previousScore != null ? overallScore - previousScore! : 0.0;
    final rankColor = rank == 1
        ? const Color(0xFFFFD700)
        : rank == 2
            ? const Color(0xFFC0C0C0)
            : rank == 3
                ? const Color(0xFFCD7F32)
                : AppColors.textMuted;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: [
        SizedBox(
          width: 32,
          child: Text(
            '#$rank',
            style: TextStyle(
                color: rankColor,
                fontWeight: FontWeight.w800,
                fontSize: 14),
          ),
        ),
        GKAvatar(name: name, imageUrl: photoUrl, radius: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600)),
            if (team != null)
              Text(team!,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 11)),
          ]),
        ),
        if (classification != null)
          PerformanceBadge(classification: classification!),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(
            overallScore.toStringAsFixed(1),
            style: const TextStyle(
                color: AppColors.cyan,
                fontWeight: FontWeight.w800,
                fontSize: 18),
          ),
          if (trend.abs() > 0.05)
            Row(children: [
              Icon(
                trend > 0 ? Icons.arrow_upward : Icons.arrow_downward,
                size: 10,
                color: trend > 0 ? AppColors.success : AppColors.error,
              ),
              Text(
                trend.abs().toStringAsFixed(1),
                style: TextStyle(
                    fontSize: 10,
                    color: trend > 0 ? AppColors.success : AppColors.error),
              ),
            ]),
        ]),
      ]),
    );
  }
}
