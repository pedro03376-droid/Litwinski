import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../../core/theme/app_theme.dart';

class EfficiencyBarChart extends StatelessWidget {
  /// Each entry: {'name': String, 'savePercentage': double}
  final List<Map<String, dynamic>> data;

  const EfficiencyBarChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Center(
        child: Text('Sem dados de eficiência',
            style: TextStyle(color: AppColors.textMuted)),
      );
    }

    final bars = data.asMap().entries.map((e) {
      final pct = (e.value['savePercentage'] as num?)?.toDouble() ?? 0.0;
      return BarChartGroupData(
        x: e.key,
        barRods: [
          BarChartRodData(
            toY: pct,
            width: 20,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [
                AppColors.cyan.withOpacity(0.5),
                AppColors.cyan,
              ],
            ),
          ),
        ],
      );
    }).toList();

    return BarChart(
      BarChartData(
        maxY: 100,
        barGroups: bars,
        borderData: FlBorderData(show: false),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(
            color: AppColors.textMuted.withOpacity(0.1),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (x, _) {
                final idx = x.toInt();
                if (idx < 0 || idx >= data.length) return const SizedBox();
                final name = data[idx]['name']?.toString() ?? '';
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    name.length > 6 ? '${name.substring(0, 6)}.' : name,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 9),
                  ),
                );
              },
              reservedSize: 24,
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 36,
              getTitlesWidget: (v, _) => Text(
                '${v.toInt()}%',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 9),
              ),
            ),
          ),
          topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false)),
        ),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            tooltipBgColor: AppColors.darkCard,
            getTooltipItem: (group, _, rod, __) {
              final name = data[group.x.toInt()]['name'] ?? '';
              return BarTooltipItem(
                '$name\n${rod.toY.toStringAsFixed(1)}%',
                const TextStyle(
                    color: AppColors.cyan,
                    fontWeight: FontWeight.w700,
                    fontSize: 12),
              );
            },
          ),
        ),
      ),
    );
  }
}
