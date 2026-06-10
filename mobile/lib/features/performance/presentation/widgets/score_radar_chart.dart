import 'dart:math';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../../core/theme/app_theme.dart';

class ScoreRadarChart extends StatelessWidget {
  final Map<String, double> scores; // key → 0–10 score

  static const _labels = [
    'Reflexo', 'Posic.', 'Alta', 'Baixa',
    'Intercep.', 'Saída', 'Pés', 'Distrib.', 'Decisão',
  ];

  static const _keys = [
    'reflexScore', 'positioningScore', 'highSaveScore', 'lowSaveScore',
    'interceptionScore', 'goalExitScore', 'footworkScore',
    'distributionScore', 'decisionMakingScore',
  ];

  const ScoreRadarChart({super.key, required this.scores});

  @override
  Widget build(BuildContext context) {
    final dataPoints = _keys.map((k) {
      final v = (scores[k] ?? 0.0).clamp(0.0, 10.0);
      return RadarEntry(value: v);
    }).toList();

    return AspectRatio(
      aspectRatio: 1,
      child: RadarChart(
        RadarChartData(
          radarShape: RadarShape.polygon,
          tickCount: 4,
          ticksTextStyle:
              const TextStyle(color: AppColors.textMuted, fontSize: 9),
          gridBorderData:
              const BorderSide(color: Color(0xFF2A2A45), width: 1),
          tickBorderData:
              const BorderSide(color: Color(0xFF2A2A45), width: 1),
          radarBorderData: const BorderSide(color: AppColors.cyan, width: 1.5),
          titlePositionPercentageOffset: 0.2,
          titleTextStyle: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 10,
              fontWeight: FontWeight.w600),
          getTitle: (index, angle) {
            return RadarChartTitle(text: _labels[index % _labels.length]);
          },
          dataSets: [
            RadarDataSet(
              fillColor: AppColors.cyan.withOpacity(0.18),
              borderColor: AppColors.cyan,
              borderWidth: 2,
              entryRadius: 3,
              dataEntries: dataPoints,
            ),
          ],
        ),
      ),
    );
  }
}
