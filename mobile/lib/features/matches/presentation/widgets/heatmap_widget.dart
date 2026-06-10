import 'dart:math';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class HeatmapPoint {
  final double x; // 0.0–1.0 relative to court width
  final double y; // 0.0–1.0 relative to court height
  final HeatmapPointType type;
  const HeatmapPoint({required this.x, required this.y, required this.type});

  factory HeatmapPoint.fromJson(Map<String, dynamic> json, HeatmapPointType t) {
    return HeatmapPoint(
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
      type: t,
    );
  }
}

enum HeatmapPointType { save, goal, interception, shotOrigin }

class HeatmapWidget extends StatelessWidget {
  final List<HeatmapPoint> points;
  final bool showLegend;

  const HeatmapWidget({
    super.key,
    required this.points,
    this.showLegend = true,
  });

  static List<HeatmapPoint> fromMatchScoutJson(Map<String, dynamic>? data) {
    if (data == null) return [];
    final points = <HeatmapPoint>[];
    for (final p in (data['saves'] as List? ?? [])) {
      points.add(HeatmapPoint.fromJson(p, HeatmapPointType.save));
    }
    for (final p in (data['goals'] as List? ?? [])) {
      points.add(HeatmapPoint.fromJson(p, HeatmapPointType.goal));
    }
    for (final p in (data['interceptations'] as List? ?? [])) {
      points.add(HeatmapPoint.fromJson(p, HeatmapPointType.interception));
    }
    for (final p in (data['shotOrigins'] as List? ?? [])) {
      points.add(HeatmapPoint.fromJson(p, HeatmapPointType.shotOrigin));
    }
    return points;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AspectRatio(
          aspectRatio: 2 / 1.4,
          child: CustomPaint(
            painter: _CourtPainter(points: points),
          ),
        ),
        if (showLegend) ...[
          const SizedBox(height: 12),
          _Legend(),
        ],
      ],
    );
  }
}

class _CourtPainter extends CustomPainter {
  final List<HeatmapPoint> points;
  _CourtPainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Background
    final bgPaint = Paint()..color = const Color(0xFF1A2C4A);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(12)),
      bgPaint,
    );

    // Court lines
    final linePaint = Paint()
      ..color = const Color(0xFF3A6090)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    // Outer boundary
    canvas.drawRect(
      Rect.fromLTRB(w * 0.02, h * 0.05, w * 0.98, h * 0.95),
      linePaint,
    );

    // Center line
    canvas.drawLine(Offset(w * 0.5, h * 0.05), Offset(w * 0.5, h * 0.95),
        linePaint);

    // Center circle
    canvas.drawCircle(Offset(w * 0.5, h * 0.5), w * 0.08, linePaint);

    // Goals (left and right)
    const goalH = 0.18;
    const goalW = 0.02;
    // Left goal
    canvas.drawRect(
      Rect.fromLTRB(
          w * 0.02 - w * goalW, h * (0.5 - goalH), w * 0.02, h * (0.5 + goalH)),
      linePaint,
    );
    // Right goal
    canvas.drawRect(
      Rect.fromLTRB(
          w * 0.98, h * (0.5 - goalH), w * (0.98 + goalW), h * (0.5 + goalH)),
      linePaint,
    );

    // Goal areas
    // Left
    canvas.drawRect(
      Rect.fromLTRB(w * 0.02, h * (0.5 - 0.30), w * 0.18, h * (0.5 + 0.30)),
      linePaint,
    );
    // Right
    canvas.drawRect(
      Rect.fromLTRB(w * 0.82, h * (0.5 - 0.30), w * 0.98, h * (0.5 + 0.30)),
      linePaint,
    );

    // Draw heatmap points
    for (final pt in points) {
      final px = w * 0.02 + pt.x * (w * 0.96);
      final py = h * 0.05 + pt.y * (h * 0.90);

      Color color;
      switch (pt.type) {
        case HeatmapPointType.save:
          color = AppColors.cyan;
          break;
        case HeatmapPointType.goal:
          color = AppColors.error;
          break;
        case HeatmapPointType.interception:
          color = AppColors.success;
          break;
        case HeatmapPointType.shotOrigin:
          color = AppColors.warning;
          break;
      }

      // Glow
      canvas.drawCircle(
        Offset(px, py),
        14,
        Paint()..color = color.withOpacity(0.15),
      );
      canvas.drawCircle(
        Offset(px, py),
        7,
        Paint()..color = color.withOpacity(0.5),
      );
      canvas.drawCircle(
        Offset(px, py),
        4,
        Paint()..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _CourtPainter old) => old.points != points;
}

class _Legend extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: const [
        _LegendItem(color: AppColors.cyan, label: 'Defesa'),
        _LegendItem(color: AppColors.error, label: 'Gol Sofrido'),
        _LegendItem(color: AppColors.success, label: 'Interceptação'),
        _LegendItem(color: AppColors.warning, label: 'Origem do Chute'),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 4),
      Text(label,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: AppColors.textSecondary)),
    ]);
  }
}
