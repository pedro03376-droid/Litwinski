import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import '../../domain/entities/goalkeeper.dart';

class GoalkeeperCard extends StatelessWidget {
  final Goalkeeper goalkeeper;
  final VoidCallback? onTap;

  const GoalkeeperCard({
    super.key,
    required this.goalkeeper,
    this.onTap,
  });

  Color _scoreColor(double score) {
    if (score >= 9.0) return AppColors.elite;
    if (score >= 8.0) return AppColors.excellent;
    if (score >= 7.0) return AppColors.good;
    if (score >= 5.0) return AppColors.regular;
    return AppColors.developing;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.darkCard,
              AppColors.darkElevated.withOpacity(0.6),
            ],
          ),
          border: Border.all(
            color: AppColors.textMuted.withOpacity(0.15),
            width: 1,
          ),
        ),
        child: Stack(
          children: [
            // Subtle corner accent
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(16),
                    bottomLeft: Radius.circular(40),
                  ),
                  gradient: LinearGradient(
                    colors: [
                      AppColors.cyan.withOpacity(0.08),
                      AppColors.purple.withOpacity(0.04),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar row
                  Row(
                    children: [
                      _GoalkeeperAvatar(goalkeeper: goalkeeper),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              goalkeeper.name,
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${goalkeeper.age} anos',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (goalkeeper.jerseyNumber != null)
                        _JerseyBadge(number: goalkeeper.jerseyNumber!),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Category chip
                  _CategoryChip(label: goalkeeper.categoryLabel),
                  const SizedBox(height: 8),
                  // Team row
                  if (goalkeeper.teamName != null) ...[
                    Row(
                      children: [
                        const Icon(
                          Icons.shield_outlined,
                          size: 12,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            goalkeeper.teamName!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                  // Performance score chip
                  if (goalkeeper.lastPerformanceScore != null)
                    _ScoreChip(score: goalkeeper.lastPerformanceScore!),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoalkeeperAvatar extends StatelessWidget {
  final Goalkeeper goalkeeper;

  const _GoalkeeperAvatar({required this.goalkeeper});

  @override
  Widget build(BuildContext context) {
    if (goalkeeper.photo != null && goalkeeper.photo!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: goalkeeper.photo!,
          width: 52,
          height: 52,
          fit: BoxFit.cover,
          placeholder: (_, __) => _Placeholder(initials: goalkeeper.initials),
          errorWidget: (_, __, ___) =>
              _Placeholder(initials: goalkeeper.initials),
        ),
      );
    }
    return _Placeholder(initials: goalkeeper.initials);
  }
}

class _Placeholder extends StatelessWidget {
  final String initials;

  const _Placeholder({required this.initials});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.cyan, AppColors.purple],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 18,
        ),
      ),
    );
  }
}

class _JerseyBadge extends StatelessWidget {
  final int number;

  const _JerseyBadge({required this.number});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.cyan.withOpacity(0.15),
        border: Border.all(color: AppColors.cyan.withOpacity(0.4), width: 1),
      ),
      alignment: Alignment.center,
      child: Text(
        '#$number',
        style: const TextStyle(
          color: AppColors.cyan,
          fontSize: 9,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;

  const _CategoryChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: AppColors.purple.withOpacity(0.2),
        border: Border.all(
          color: AppColors.purpleLight.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.purpleLight,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ScoreChip extends StatelessWidget {
  final double score;

  const _ScoreChip({required this.score});

  Color get _color {
    if (score >= 9.0) return AppColors.elite;
    if (score >= 8.0) return AppColors.excellent;
    if (score >= 7.0) return AppColors.good;
    if (score >= 5.0) return AppColors.regular;
    return AppColors.developing;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            color: _color.withOpacity(0.15),
            border: Border.all(color: _color.withOpacity(0.4), width: 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.star_rounded, size: 10, color: _color),
              const SizedBox(width: 3),
              Text(
                score.toStringAsFixed(1),
                style: TextStyle(
                  color: _color,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
