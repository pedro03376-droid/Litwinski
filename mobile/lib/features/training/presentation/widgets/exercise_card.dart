import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import '../../domain/entities/training_session.dart';

// ---------------------------------------------------------------------------
// ExerciseCard widget
// ---------------------------------------------------------------------------

class ExerciseCard extends StatefulWidget {
  final String name;
  final String? objective;
  final int sets;
  final int reps;
  final ExerciseResult result;
  final bool initiallyExpanded;

  const ExerciseCard({
    super.key,
    required this.name,
    this.objective,
    required this.sets,
    required this.reps,
    required this.result,
    this.initiallyExpanded = false,
  });

  @override
  State<ExerciseCard> createState() => _ExerciseCardState();
}

class _ExerciseCardState extends State<ExerciseCard>
    with SingleTickerProviderStateMixin {
  late bool _expanded;
  late AnimationController _controller;
  late Animation<double> _expandAnimation;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
      value: _expanded ? 1.0 : 0.0,
    );
    _expandAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  Color _rateColor(double rate) {
    if (rate >= 0.85) return AppColors.success;
    if (rate >= 0.70) return AppColors.good;
    if (rate >= 0.55) return AppColors.warning;
    return AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    final rate = widget.result.attempts == 0
        ? 0.0
        : widget.result.successes / widget.result.attempts;
    final rateColor = _rateColor(rate);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.textMuted.withOpacity(0.15),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // Header row (always visible)
          InkWell(
            onTap: _toggle,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  // Progress ring
                  _MiniProgressRing(value: rate, color: rateColor),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.name,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (widget.objective != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            widget.objective!,
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Sets x Reps badge
                  _SetsRepsBadge(sets: widget.sets, reps: widget.reps),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 280),
                    child: const Icon(
                      Icons.keyboard_arrow_down,
                      color: AppColors.textMuted,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Expandable results section
          SizeTransition(
            sizeFactor: _expandAnimation,
            child: Column(
              children: [
                Divider(
                  height: 1,
                  thickness: 1,
                  color: AppColors.textMuted.withOpacity(0.15),
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: _ResultsSection(
                    result: widget.result,
                    rateColor: rateColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Private sub-widgets
// ---------------------------------------------------------------------------

class _MiniProgressRing extends StatelessWidget {
  final double value; // 0..1
  final Color color;

  const _MiniProgressRing({required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 42,
      height: 42,
      child: CustomPaint(
        painter: _RingPainter(value: value, color: color),
        child: Center(
          child: Text(
            '${(value * 100).round()}%',
            style: TextStyle(
              color: color,
              fontSize: 9,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double value;
  final Color color;

  const _RingPainter({required this.value, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 6) / 2;
    const startAngle = -math.pi / 2;

    // Background ring
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      0,
      2 * math.pi,
      false,
      Paint()
        ..color = color.withOpacity(0.15)
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Filled arc
    if (value > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        2 * math.pi * value,
        false,
        Paint()
          ..color = color
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.value != value || old.color != color;
}

class _SetsRepsBadge extends StatelessWidget {
  final int sets;
  final int reps;

  const _SetsRepsBadge({required this.sets, required this.reps});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.cyan.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: AppColors.cyan.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Text(
        '${sets}x$reps',
        style: const TextStyle(
          color: AppColors.cyan,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ResultsSection extends StatelessWidget {
  final ExerciseResult result;
  final Color rateColor;

  const _ResultsSection({
    required this.result,
    required this.rateColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _Counter(
                label: 'Tentativas',
                value: result.attempts,
                color: AppColors.cyan,
                icon: Icons.sports_handball_outlined,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _Counter(
                label: 'Acertos',
                value: result.successes,
                color: AppColors.success,
                icon: Icons.check_circle_outline,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _Counter(
                label: 'Erros',
                value: result.errors,
                color: AppColors.error,
                icon: Icons.cancel_outlined,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Success rate bar
        Row(
          children: [
            const Text(
              'Taxa de Acerto',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            Text(
              '${((result.attempts == 0 ? 0.0 : result.successes / result.attempts) * 100).toStringAsFixed(1)}%',
              style: TextStyle(
                color: rateColor,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: result.attempts == 0 ? 0.0 : result.successes / result.attempts,
            backgroundColor: rateColor.withOpacity(0.15),
            valueColor: AlwaysStoppedAnimation<Color>(rateColor),
            minHeight: 6,
          ),
        ),
        // Reaction time
        if (result.reactionTimeSeconds != null) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(
                Icons.bolt,
                size: 14,
                color: AppColors.warning,
              ),
              const SizedBox(width: 4),
              const Text(
                'Tempo de reação: ',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
              Text(
                '${result.reactionTimeSeconds!.toStringAsFixed(2)}s',
                style: const TextStyle(
                  color: AppColors.warning,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Counter extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final IconData icon;

  const _Counter({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.25), width: 1),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}
