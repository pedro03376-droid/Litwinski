import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/performance_badge.dart';
import '../widgets/score_radar_chart.dart';
import '../widgets/score_card.dart';

final _performanceProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, gkId) async {
  return ref.read(apiClientProvider).get('/performance/$gkId');
});

final _evolutionProvider =
    FutureProvider.family<List<dynamic>, ({String gkId, String period})>(
  (ref, args) async {
    final data = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
          '/performance/evolution/${args.gkId}',
          queryParameters: {'period': args.period},
        );
    return data['data'] as List? ?? [];
  },
);

final _rankingProvider = FutureProvider<List<dynamic>>((ref) async {
  final data = await ref
      .read(apiClientProvider)
      .get<Map<String, dynamic>>('/performance/ranking');
  return data['data'] as List? ?? [];
});

final _selectedPeriodProvider = StateProvider<String>((ref) => 'monthly');

class PerformanceScreen extends ConsumerWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // For demo, show ranking; in production, filter by selected goalkeeper
    final rankingAsync = ref.watch(_rankingProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Performance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.leaderboard_outlined),
            tooltip: 'Ranking',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Role para baixo para ver o ranking completo'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
          ),
        ],
      ),
      body: rankingAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.cyan)),
        error: (e, _) =>
            Center(child: Text('Erro: $e', style: const TextStyle(color: AppColors.error))),
        data: (ranking) => _PerformanceBody(ranking: ranking),
      ),
    );
  }
}

class _PerformanceBody extends ConsumerWidget {
  final List<dynamic> ranking;
  const _PerformanceBody({required this.ranking});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(_selectedPeriodProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Period selector
        Row(children: [
          for (final (val, label) in [
            ('weekly', 'Semanal'),
            ('monthly', 'Mensal'),
            ('yearly', 'Anual'),
          ])
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(label),
                selected: period == val,
                onSelected: (_) =>
                    ref.read(_selectedPeriodProvider.notifier).state = val,
                selectedColor: AppColors.cyan.withOpacity(0.2),
                labelStyle: TextStyle(
                  color: period == val ? AppColors.cyan : AppColors.textSecondary,
                  fontWeight: period == val ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
            ),
        ]),

        const SizedBox(height: 20),
        Text('Ranking de Goleiras',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),

        if (ranking.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text('Nenhum dado de performance disponível.',
                  style: TextStyle(color: AppColors.textMuted),
                  textAlign: TextAlign.center),
            ),
          )
        else
          ...ranking.asMap().entries.map((e) {
            final index = e.key;
            final item = e.value as Map<String, dynamic>;
            return _RankingItem(rank: index + 1, data: item);
          }),
      ],
    );
  }
}

class _RankingItem extends StatelessWidget {
  final int rank;
  final Map<String, dynamic> data;
  const _RankingItem({required this.rank, required this.data});

  @override
  Widget build(BuildContext context) {
    final score = double.tryParse(data['avgOverall']?.toString() ?? '0') ?? 0.0;
    final name = data['goalkeeperName'] ?? data['name'] ?? 'Goleira';
    final classification = _classify(score);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        SizedBox(
          width: 28,
          child: Text('#$rank',
              style: TextStyle(
                color: rank <= 3 ? AppColors.elite : AppColors.textMuted,
                fontWeight: FontWeight.w800,
              )),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(name,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600)),
        ),
        PerformanceBadge(classification: classification),
        const SizedBox(width: 12),
        Text(
          score.toStringAsFixed(1),
          style: const TextStyle(
              color: AppColors.cyan,
              fontWeight: FontWeight.w800,
              fontSize: 18),
        ),
      ]),
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
