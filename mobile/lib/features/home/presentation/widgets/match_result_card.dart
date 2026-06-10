import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';

/// Card displaying the result of a single match.
class MatchResultCard extends StatelessWidget {
  final DateTime date;
  final String competition;
  final String teamName;
  final String opponentName;
  final int teamScore;
  final int opponentScore;
  final int saves;
  final bool cleanSheet;
  final String? teamLogoUrl;
  final String? opponentLogoUrl;
  final VoidCallback? onTap;

  const MatchResultCard({
    super.key,
    required this.date,
    required this.competition,
    required this.teamName,
    required this.opponentName,
    required this.teamScore,
    required this.opponentScore,
    required this.saves,
    this.cleanSheet = false,
    this.teamLogoUrl,
    this.opponentLogoUrl,
    this.onTap,
  });

  _MatchResult get _result {
    if (teamScore > opponentScore) return _MatchResult.win;
    if (teamScore < opponentScore) return _MatchResult.loss;
    return _MatchResult.draw;
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.textMuted.withOpacity(0.12),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header row: date, competition, result chip
            _buildHeader(result),

            // Divider
            Divider(
              height: 1,
              thickness: 1,
              color: AppColors.textMuted.withOpacity(0.1),
            ),

            // Score row
            _buildScoreRow(),

            // Footer stats
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(_MatchResult result) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Date
          Icon(
            Icons.calendar_today_outlined,
            size: 13,
            color: AppColors.textMuted,
          ),
          const SizedBox(width: 5),
          Text(
            DateFormat('dd/MM/yyyy', 'pt_BR').format(date),
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              fontFamily: 'Inter',
            ),
          ),
          const SizedBox(width: 12),
          // Competition
          Expanded(
            child: Text(
              competition,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
                fontFamily: 'Inter',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          // Result chip
          _ResultChip(result: result),
        ],
      ),
    );
  }

  Widget _buildScoreRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          // Team name
          Expanded(
            child: Text(
              teamName,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
                fontFamily: 'Inter',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // Score
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.darkElevated,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$teamScore',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    fontFamily: 'Inter',
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '–',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 18,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ),
                Text(
                  '$opponentScore',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    fontFamily: 'Inter',
                  ),
                ),
              ],
            ),
          ),
          // Opponent name
          Expanded(
            child: Text(
              opponentName,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 15,
                fontWeight: FontWeight.w500,
                fontFamily: 'Inter',
              ),
              textAlign: TextAlign.right,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.darkBackground.withOpacity(0.4),
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(16),
        ),
      ),
      child: Row(
        children: [
          // Saves stat
          _StatPill(
            icon: Icons.pan_tool_outlined,
            label: '$saves defesas',
            color: AppColors.cyan,
          ),
          const SizedBox(width: 10),
          // Clean sheet
          if (cleanSheet)
            const _StatPill(
              icon: Icons.shield_outlined,
              label: 'Jogo sem gols',
              color: AppColors.success,
            ),
        ],
      ),
    );
  }
}

// ─── Result chip ─────────────────────────────────────────────────────────────

enum _MatchResult { win, draw, loss }

class _ResultChip extends StatelessWidget {
  final _MatchResult result;

  const _ResultChip({required this.result});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;

    switch (result) {
      case _MatchResult.win:
        color = AppColors.success;
        label = 'V';
        break;
      case _MatchResult.draw:
        color = AppColors.warning;
        label = 'E';
        break;
      case _MatchResult.loss:
        color = AppColors.error;
        label = 'D';
        break;
    }

    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        shape: BoxShape.circle,
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Center(
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            fontFamily: 'Inter',
          ),
        ),
      ),
    );
  }
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

class _StatPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _StatPill({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 14),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
      ],
    );
  }
}
