import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/performance_badge.dart';
import '../../data/repositories/performance_repository.dart';
import '../widgets/score_radar_chart.dart';
import '../widgets/score_card.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _selectedPeriodProvider = StateProvider<String>((ref) => 'monthly');

final _rankingProvider = FutureProvider.family<List<Map<String, dynamic>>, String>(
  (ref, period) async {
    return ref.read(performanceRepositoryProvider).getRanking(limit: 30);
  },
);

final _selectedGoalkeeperIdProvider = StateProvider<String?>((ref) => null);

final _goalkeeperDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, gkId) async {
  return ref.read(performanceRepositoryProvider).getByGoalkeeper(gkId);
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class PerformanceScreen extends ConsumerWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(_selectedPeriodProvider);
    final rankingAsync = ref.watch(_rankingProvider(period));
    final selectedId = ref.watch(_selectedGoalkeeperIdProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Performance'),
        actions: [
          if (selectedId != null)
            IconButton(
              icon: const Icon(Icons.close),
              tooltip: 'Fechar detalhe',
              onPressed: () =>
                  ref.read(_selectedGoalkeeperIdProvider.notifier).state = null,
            ),
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(_rankingProvider(period)),
          ),
        ],
      ),
      body: rankingAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.cyan)),
        error: (e, _) => _ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(_rankingProvider(period)),
        ),
        data: (ranking) => _PerformanceBody(
          ranking: ranking,
          period: period,
          selectedId: selectedId,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

class _PerformanceBody extends ConsumerWidget {
  final List<Map<String, dynamic>> ranking;
  final String period;
  final String? selectedId;

  const _PerformanceBody({
    required this.ranking,
    required this.period,
    required this.selectedId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
      children: [
        // Period selector
        _PeriodSelector(selected: period),

        const SizedBox(height: 20),

        // Goalkeeper detail panel (when selected)
        if (selectedId != null) ...[
          _GoalkeeperDetailPanel(goalkeeperId: selectedId!),
          const SizedBox(height: 24),
        ],

        Text('Ranking de Goleiras',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),

        if (ranking.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Nenhum dado de performance disponível.',
                style: TextStyle(color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          ...ranking.asMap().entries.map((e) {
            final item = e.value;
            final gkId = item['goalkeeperId'] as String?;
            return _RankingItem(
              rank: e.key + 1,
              data: item,
              isSelected: gkId != null && gkId == selectedId,
              onTap: gkId == null
                  ? null
                  : () {
                      final notifier =
                          ref.read(_selectedGoalkeeperIdProvider.notifier);
                      notifier.state = notifier.state == gkId ? null : gkId;
                    },
            );
          }),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

class _PeriodSelector extends ConsumerWidget {
  final String selected;
  const _PeriodSelector({required this.selected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        for (final (val, label) in [
          ('weekly', 'Semanal'),
          ('monthly', 'Mensal'),
          ('yearly', 'Anual'),
        ])
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(label),
              selected: selected == val,
              onSelected: (_) {
                ref.read(_selectedPeriodProvider.notifier).state = val;
              },
              selectedColor: AppColors.cyan.withOpacity(0.2),
              labelStyle: TextStyle(
                color: selected == val ? AppColors.cyan : AppColors.textSecondary,
                fontWeight:
                    selected == val ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Goalkeeper detail panel (radar + score cards)
// ---------------------------------------------------------------------------

class _GoalkeeperDetailPanel extends ConsumerWidget {
  final String goalkeeperId;
  const _GoalkeeperDetailPanel({required this.goalkeeperId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_goalkeeperDetailProvider(goalkeeperId));

    return async.when(
      loading: () => Container(
        height: 120,
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
            child: CircularProgressIndicator(color: AppColors.cyan)),
      ),
      error: (e, _) => const SizedBox.shrink(),
      data: (data) {
        final scores = _extractScores(data);
        if (scores.isEmpty) return const SizedBox.shrink();

        final scoreCards = [
          ('Reflexo', 'reflexScore'),
          ('Defesas Altas', 'highSaveScore'),
          ('Defesas Baixas', 'lowSaveScore'),
          ('Posicionamento', 'positioningScore'),
          ('Saída do Gol', 'goalExitScore'),
          ('Jogo com os Pés', 'footworkScore'),
          ('Distribuição', 'distributionScore'),
          ('Tomada de Decisão', 'decisionMakingScore'),
        ];

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.darkCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.cyan.withOpacity(0.2),
              width: 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.radar, color: AppColors.cyan, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Mapa de Habilidades',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ]),
              const SizedBox(height: 12),
              ScoreRadarChart(scores: scores),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 2.2,
                children: scoreCards.map((c) {
                  final val = (scores[c.$2] ?? 0.0);
                  return ScoreCard(label: c.$1, score: val);
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  Map<String, double> _extractScores(Map<String, dynamic> data) {
    const keys = [
      'reflexScore', 'positioningScore', 'highSaveScore', 'lowSaveScore',
      'interceptionScore', 'goalExitScore', 'footworkScore',
      'distributionScore', 'decisionMakingScore', 'overallScore',
    ];
    final result = <String, double>{};
    for (final k in keys) {
      final v = data[k];
      if (v != null) result[k] = double.tryParse(v.toString()) ?? 0.0;
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Ranking item
// ---------------------------------------------------------------------------

class _RankingItem extends StatelessWidget {
  final int rank;
  final Map<String, dynamic> data;
  final bool isSelected;
  final VoidCallback? onTap;

  const _RankingItem({
    required this.rank,
    required this.data,
    required this.isSelected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final score =
        double.tryParse(data['avgOverall']?.toString() ?? '0') ?? 0.0;
    final name =
        data['goalkeeperName'] ?? data['name'] ?? 'Goleira';
    final classification = _classify(score);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.cyan.withOpacity(0.08)
              : AppColors.darkCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? AppColors.cyan.withOpacity(0.4)
                : Colors.transparent,
            width: 1,
          ),
        ),
        child: Row(children: [
          SizedBox(
            width: 28,
            child: Text(
              '#$rank',
              style: TextStyle(
                color: rank <= 3 ? AppColors.elite : AppColors.textMuted,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                ),
                if (data['totalMatches'] != null)
                  Text(
                    '${data['totalMatches']} partidas',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 11),
                  ),
              ],
            ),
          ),
          PerformanceBadge(classification: classification),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                score.toStringAsFixed(1),
                style: const TextStyle(
                    color: AppColors.cyan,
                    fontWeight: FontWeight.w800,
                    fontSize: 20),
              ),
              const Text('nota',
                  style:
                      TextStyle(color: AppColors.textMuted, fontSize: 10)),
            ],
          ),
          if (onTap != null) ...[
            const SizedBox(width: 8),
            Icon(
              isSelected ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
              color: AppColors.textMuted,
              size: 18,
            ),
          ],
        ]),
      ),
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

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'Não foi possível carregar o ranking',
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 15,
                  fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style:
                  const TextStyle(color: AppColors.textMuted, fontSize: 12),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.cyan,
                foregroundColor: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
