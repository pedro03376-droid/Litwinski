import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/section_header.dart';
import '../widgets/ranking_list_item.dart';
import '../widgets/efficiency_bar_chart.dart';

final _dashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiClientProvider);
  // Fetch multiple endpoints in parallel
  final results = await Future.wait([
    api.get<Map<String, dynamic>>('/performance/ranking'),
    api.get<Map<String, dynamic>>('/matches/stats/all').catchError((_) => <String, dynamic>{}),
  ]);
  return {
    'ranking': results[0]['data'] ?? [],
    'matchStats': results[1],
  };
});

class ExecutiveDashboardScreen extends ConsumerWidget {
  const ExecutiveDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(_dashboardProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Dashboard Executivo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_dashboardProvider),
          ),
        ],
      ),
      body: dashAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.cyan)),
        error: (e, _) => _DashboardBody(ranking: const [], matchStats: const {}),
        data: (data) => _DashboardBody(
          ranking: (data['ranking'] as List?)?.cast<Map<String, dynamic>>() ?? [],
          matchStats: (data['matchStats'] as Map<String, dynamic>?) ?? {},
        ),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  final List<Map<String, dynamic>> ranking;
  final Map<String, dynamic> matchStats;

  const _DashboardBody({required this.ranking, required this.matchStats});

  @override
  Widget build(BuildContext context) {
    final efficiencyData = ranking.map((r) => {
          'name': (r['goalkeeperName'] ?? r['name'] ?? 'GK').toString(),
          'savePercentage': double.tryParse(
                  r['avgSavePercentage']?.toString() ?? '0') ?? 0.0,
        }).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Summary row
        Row(children: [
          _SummaryTile(
            title: 'Goleiras',
            value: '${ranking.length}',
            icon: Icons.sports_handball,
            color: AppColors.cyan,
          ),
          const SizedBox(width: 12),
          _SummaryTile(
            title: 'Nota Média',
            value: ranking.isEmpty
                ? '--'
                : (ranking
                          .map((r) =>
                              double.tryParse(r['avgOverall']?.toString() ?? '0') ?? 0.0)
                          .reduce((a, b) => a + b) /
                      ranking.length)
                    .toStringAsFixed(1),
            icon: Icons.star,
            color: AppColors.elite,
          ),
        ]),
        const SizedBox(height: 24),

        // Ranking
        SectionHeader(
          title: 'Ranking de Goleiras',
          subtitle: 'Por nota geral',
        ),
        const SizedBox(height: 8),
        if (ranking.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Sem dados de performance',
                  style: TextStyle(color: AppColors.textMuted)),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: AppColors.darkCard,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: ranking.asMap().entries.take(10).map((e) {
                final item = e.value;
                final score = double.tryParse(
                        item['avgOverall']?.toString() ?? '0') ??
                    0.0;
                return Column(children: [
                  RankingListItem(
                    rank: e.key + 1,
                    name: item['goalkeeperName'] ?? item['name'] ?? 'GK',
                    team: item['teamName'],
                    overallScore: score,
                    classification: _classify(score),
                    photoUrl: item['photo'],
                  ),
                  if (e.key < ranking.length - 1)
                    const Divider(height: 1, indent: 60),
                ]);
              }).toList(),
            ),
          ),

        const SizedBox(height: 24),

        // Efficiency chart
        SectionHeader(
          title: 'Eficiência Defensiva',
          subtitle: 'Taxa de defesas por goleira',
        ),
        const SizedBox(height: 12),
        Container(
          height: 200,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.darkCard,
            borderRadius: BorderRadius.circular(16),
          ),
          child: efficiencyData.isEmpty
              ? const Center(
                  child: Text('Sem dados',
                      style: TextStyle(color: AppColors.textMuted)))
              : EfficiencyBarChart(data: efficiencyData),
        ),

        const SizedBox(height: 24),

        // Trends
        SectionHeader(title: 'Tendências', subtitle: 'Últimos 30 dias'),
        const SizedBox(height: 8),
        _TrendsSection(ranking: ranking),
      ],
    );
  }

  String _classify(double score) {
    if (score >= 9) return 'elite';
    if (score >= 8) return 'excellent';
    if (score >= 7) return 'good';
    if (score >= 5) return 'regular';
    return 'developing';
  }
}

class _SummaryTile extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryTile({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(14),
          border: Border(top: BorderSide(color: color, width: 3)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w800, fontSize: 28)),
          Text(title,
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 12)),
        ]),
      ),
    );
  }
}

class _TrendsSection extends StatelessWidget {
  final List<Map<String, dynamic>> ranking;
  const _TrendsSection({required this.ranking});

  @override
  Widget build(BuildContext context) {
    if (ranking.isEmpty) {
      return const Center(
        child: Text('Sem dados de tendência',
            style: TextStyle(color: AppColors.textMuted)),
      );
    }

    // Simulated trends from ranking data
    final avgScore = ranking.isEmpty
        ? 0.0
        : ranking.map((r) => double.tryParse(r['avgOverall']?.toString() ?? '0') ?? 0.0)
              .reduce((a, b) => a + b) / ranking.length;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(children: [
        _TrendRow(
          label: 'Nota Média Geral',
          value: avgScore.toStringAsFixed(1),
          trend: 0.3,
        ),
        const Divider(height: 1, indent: 16),
        _TrendRow(
          label: 'Goleiras Elite',
          value: '${ranking.where((r) => (double.tryParse(r['avgOverall']?.toString() ?? '0') ?? 0) >= 9).length}',
          trend: 1,
        ),
        const Divider(height: 1, indent: 16),
        _TrendRow(
          label: 'Goleiras em Desenvolvimento',
          value: '${ranking.where((r) => (double.tryParse(r['avgOverall']?.toString() ?? '0') ?? 0) < 5).length}',
          trend: -1,
        ),
      ]),
    );
  }
}

class _TrendRow extends StatelessWidget {
  final String label;
  final String value;
  final double trend;
  const _TrendRow({required this.label, required this.value, required this.trend});

  @override
  Widget build(BuildContext context) {
    final trendColor = trend > 0 ? AppColors.success : trend < 0 ? AppColors.error : AppColors.textMuted;
    final trendIcon = trend > 0 ? Icons.trending_up : trend < 0 ? Icons.trending_down : Icons.trending_flat;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(children: [
        Icon(trendIcon, color: trendColor, size: 20),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
        Text(value,
            style: const TextStyle(
                color: AppColors.cyan, fontWeight: FontWeight.w700, fontSize: 16)),
      ]),
    );
  }
}
