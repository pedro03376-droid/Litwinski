import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// A line chart showing weekly goalkeeper performance evolution.
///
/// [chartData] is a list of data-point maps. Each map may contain:
///   - 'label'         : String – x-axis label (e.g. "Seg")
///   - 'overallScore'  : num – overall performance score (0-100)
///   - 'reflexScore'   : num – reflex/reaction score (0-100)
///   - 'highSaveScore' : num – high-save / aerial score (0-100)
class EvolutionChart extends StatefulWidget {
  final List<Map<String, dynamic>> chartData;
  final double height;

  const EvolutionChart({
    super.key,
    required this.chartData,
    this.height = 220,
  });

  @override
  State<EvolutionChart> createState() => _EvolutionChartState();
}

class _EvolutionChartState extends State<EvolutionChart> {
  int? _touchedIndex;

  List<Map<String, dynamic>> get _data => widget.chartData;

  // ─── Build line data ───────────────────────────────────────────────────────

  LineChartBarData _buildLine({
    required Color color,
    required List<FlSpot> spots,
    bool isDashed = false,
  }) {
    return LineChartBarData(
      spots: spots,
      isCurved: true,
      curveSmoothness: 0.35,
      color: color,
      barWidth: 2.5,
      isStrokeCapRound: true,
      dashArray: isDashed ? [6, 4] : null,
      dotData: FlDotData(
        show: true,
        getDotPainter: (spot, _, __, index) {
          final isTouched = _touchedIndex == index;
          return FlDotCirclePainter(
            radius: isTouched ? 5 : 3,
            color: color,
            strokeWidth: isTouched ? 2 : 0,
            strokeColor: Colors.white,
          );
        },
      ),
      belowBarData: BarAreaData(
        show: true,
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            color.withOpacity(0.15),
            color.withOpacity(0.0),
          ],
        ),
      ),
    );
  }

  List<FlSpot> _spotsFor(String key) {
    return _data.asMap().entries.map((e) {
      final val = (e.value[key] as num?)?.toDouble() ?? 0;
      return FlSpot(e.key.toDouble(), val.clamp(0, 100));
    }).toList();
  }

  // ─── Axis titles ──────────────────────────────────────────────────────────

  Widget _bottomTitle(double value, TitleMeta meta) {
    final index = value.toInt();
    if (index < 0 || index >= _data.length) return const SizedBox.shrink();
    final label = (_data[index]['label'] as String?) ?? '$index';
    return SideTitleWidget(
      axisSide: meta.axisSide,
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 10,
          fontFamily: 'Inter',
        ),
      ),
    );
  }

  Widget _leftTitle(double value, TitleMeta meta) {
    if (value % 25 != 0) return const SizedBox.shrink();
    return SideTitleWidget(
      axisSide: meta.axisSide,
      child: Text(
        '${value.toInt()}',
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 10,
          fontFamily: 'Inter',
        ),
      ),
    );
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_data.isEmpty) {
      return SizedBox(
        height: widget.height,
        child: const Center(
          child: Text(
            'Sem dados disponíveis',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 13,
              fontFamily: 'Inter',
            ),
          ),
        ),
      );
    }

    final overallSpots = _spotsFor('overallScore');
    final reflexSpots = _spotsFor('reflexScore');
    final highSaveSpots = _spotsFor('highSaveScore');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: widget.height,
          child: LineChart(
            LineChartData(
              backgroundColor: Colors.transparent,
              minX: 0,
              maxX: (_data.length - 1).toDouble(),
              minY: 0,
              maxY: 100,
              lineTouchData: LineTouchData(
                enabled: true,
                touchCallback: (event, response) {
                  if (!event.isInterestedForInteractions ||
                      response == null ||
                      response.lineBarSpots == null) {
                    setState(() => _touchedIndex = null);
                    return;
                  }
                  setState(
                    () => _touchedIndex =
                        response.lineBarSpots!.first.spotIndex,
                  );
                },
                touchTooltipData: LineTouchTooltipData(
                  tooltipBgColor: AppColors.darkElevated,
                  tooltipRoundedRadius: 10,
                  getTooltipItems: (spots) {
                    final labels = [
                      ('Geral', AppColors.cyan),
                      ('Reflexo', AppColors.purple),
                      ('Aéreo', AppColors.success),
                    ];
                    return spots.asMap().entries.map((e) {
                      final info = e.key < labels.length
                          ? labels[e.key]
                          : ('—', AppColors.textMuted);
                      return LineTooltipItem(
                        '${info.$1}: ${e.value.y.toStringAsFixed(1)}',
                        TextStyle(
                          color: info.$2,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          fontFamily: 'Inter',
                        ),
                      );
                    }).toList();
                  },
                ),
              ),
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: 25,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: AppColors.textMuted.withOpacity(0.08),
                  strokeWidth: 1,
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 32,
                    interval: 25,
                    getTitlesWidget: _leftTitle,
                  ),
                ),
                rightTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                topTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    getTitlesWidget: _bottomTitle,
                  ),
                ),
              ),
              lineBarsData: [
                _buildLine(color: AppColors.cyan, spots: overallSpots),
                _buildLine(
                  color: AppColors.purple,
                  spots: reflexSpots,
                  isDashed: true,
                ),
                _buildLine(
                  color: AppColors.success,
                  spots: highSaveSpots,
                  isDashed: true,
                ),
              ],
            ),
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeInOut,
          ),
        ),

        const SizedBox(height: 12),

        // Legend
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            _LegendDot(color: AppColors.cyan, label: 'Geral'),
            SizedBox(width: 16),
            _LegendDot(
              color: AppColors.purple,
              label: 'Reflexo',
              dashed: true,
            ),
            SizedBox(width: 16),
            _LegendDot(
              color: AppColors.success,
              label: 'Aéreo',
              dashed: true,
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Legend dot ───────────────────────────────────────────────────────────────

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  final bool dashed;

  const _LegendDot({
    required this.color,
    required this.label,
    this.dashed = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Line indicator
        SizedBox(
          width: 20,
          height: 2,
          child: dashed
              ? Row(
                  children: [
                    Container(width: 8, height: 2, color: color),
                    const SizedBox(width: 4),
                    Container(width: 8, height: 2, color: color),
                  ],
                )
              : Container(color: color),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontFamily: 'Inter',
          ),
        ),
      ],
    );
  }
}
