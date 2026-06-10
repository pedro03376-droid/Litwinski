import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

enum PerformanceClassification {
  elite,
  excellent,
  good,
  regular,
  developing,
}

class PerformanceBadge extends StatelessWidget {
  final String classification;
  final double fontSize;
  final EdgeInsetsGeometry padding;

  const PerformanceBadge({
    super.key,
    required this.classification,
    this.fontSize = 11,
    this.padding = const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
  });

  _BadgeStyle get _style {
    switch (classification.toLowerCase()) {
      case 'elite':
        return _BadgeStyle(
          color: AppColors.elite,
          label: 'Elite',
          icon: Icons.star,
        );
      case 'excellent':
      case 'excelente':
        return _BadgeStyle(
          color: AppColors.excellent,
          label: 'Excelente',
          icon: Icons.trending_up,
        );
      case 'good':
      case 'bom':
      case 'boa':
        return _BadgeStyle(
          color: AppColors.good,
          label: 'Bom',
          icon: Icons.thumb_up_outlined,
        );
      case 'regular':
        return _BadgeStyle(
          color: AppColors.regular,
          label: 'Regular',
          icon: Icons.remove,
        );
      case 'developing':
      case 'em desenvolvimento':
      case 'desenvolvimento':
        return _BadgeStyle(
          color: AppColors.developing,
          label: 'Em Desenvolvimento',
          icon: Icons.trending_down,
        );
      default:
        return _BadgeStyle(
          color: AppColors.textMuted,
          label: classification,
          icon: Icons.help_outline,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = _style;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: style.color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: style.color.withOpacity(0.5),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(style.icon, color: style.color, size: fontSize + 1),
          const SizedBox(width: 4),
          Text(
            style.label,
            style: TextStyle(
              color: style.color,
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              fontFamily: 'Inter',
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeStyle {
  final Color color;
  final String label;
  final IconData icon;

  const _BadgeStyle({
    required this.color,
    required this.label,
    required this.icon,
  });
}
