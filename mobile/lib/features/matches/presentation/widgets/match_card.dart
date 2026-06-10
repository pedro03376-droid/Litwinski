import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/match.dart';
import '../../../../core/theme/app_theme.dart';

class MatchCard extends StatelessWidget {
  final GKMatch match;
  final VoidCallback? onTap;

  const MatchCard({super.key, required this.match, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.textMuted.withOpacity(0.15)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(
                    match.competition,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: AppColors.textMuted,
                        ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  DateFormat('dd/MM/yyyy').format(match.date),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppColors.textMuted,
                      ),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Minha Equipe',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.textMuted)),
                      Text(match.opponent,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                Column(children: [
                  _ResultBadge(result: match.result),
                  const SizedBox(height: 4),
                  Text(
                    '${match.goalsScored}  ×  ${match.goalsConceded}',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2,
                        ),
                  ),
                ]),
                const SizedBox(width: 8),
              ]),
              if (match.scout != null) ...[
                const SizedBox(height: 10),
                const Divider(height: 1),
                const SizedBox(height: 8),
                Row(children: [
                  _StatChip(
                    label: '${match.scout!.totalSaves} def.',
                    color: AppColors.cyan,
                  ),
                  const SizedBox(width: 6),
                  _StatChip(
                    label:
                        '${match.scout!.savePercentage.toStringAsFixed(0)}%',
                    color: AppColors.success,
                  ),
                  if (match.isCleanSheet) ...[
                    const SizedBox(width: 6),
                    _StatChip(label: 'Clean Sheet', color: AppColors.elite),
                  ],
                ]),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultBadge extends StatelessWidget {
  final String? result;
  const _ResultBadge({this.result});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    switch (result) {
      case 'win':
        color = AppColors.success;
        label = 'V';
        break;
      case 'draw':
        color = AppColors.warning;
        label = 'E';
        break;
      case 'loss':
        color = AppColors.error;
        label = 'D';
        break;
      default:
        color = AppColors.textMuted;
        label = '-';
    }
    return Container(
      width: 26,
      height: 26,
      decoration:
          BoxDecoration(color: color.withOpacity(0.2), shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(label,
          style: TextStyle(
              color: color, fontWeight: FontWeight.w800, fontSize: 12)),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final Color color;
  const _StatChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
