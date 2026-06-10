import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme/app_theme.dart';

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.darkElevated,
                border: Border.all(
                  color: AppColors.textMuted.withOpacity(0.2),
                  width: 1,
                ),
              ),
              child: Icon(
                icon,
                color: AppColors.textMuted,
                size: 36,
              ),
            )
                .animate()
                .fade(duration: 400.ms)
                .scale(
                  begin: const Offset(0.7, 0.7),
                  end: const Offset(1.0, 1.0),
                  duration: 400.ms,
                  curve: Curves.easeOutBack,
                ),

            const SizedBox(height: 20),

            Text(
              title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w600,
                fontFamily: 'Inter',
              ),
              textAlign: TextAlign.center,
            )
                .animate()
                .fade(delay: 100.ms, duration: 300.ms)
                .slideY(begin: 0.2, end: 0, delay: 100.ms, duration: 300.ms),

            const SizedBox(height: 8),

            Text(
              subtitle,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
                fontFamily: 'Inter',
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            )
                .animate()
                .fade(delay: 180.ms, duration: 300.ms),

            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 28),
              OutlinedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.add, size: 18),
                label: Text(actionLabel!),
              )
                  .animate()
                  .fade(delay: 260.ms, duration: 300.ms)
                  .slideY(begin: 0.2, end: 0, delay: 260.ms, duration: 300.ms),
            ],
          ],
        ),
      ),
    );
  }
}
