import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gkhub/core/constants/app_constants.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import 'package:gkhub/features/training/data/repositories/training_repository.dart';
import 'package:gkhub/features/training/domain/entities/training_session.dart';
import '../widgets/training_card.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _trainingListProvider =
    FutureProvider.autoDispose<List<TrainingSession>>((ref) async {
  return ref.read(trainingRepositoryProvider).getAll(limit: 100);
});

final _selectedCategoryProvider = StateProvider.autoDispose<String?>((ref) => null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

TrainingIntensity _intensityEnum(String api) {
  switch (api) {
    case 'low':
      return TrainingIntensity.baixa;
    case 'high':
      return TrainingIntensity.alta;
    case 'max':
      return TrainingIntensity.maxima;
    default:
      return TrainingIntensity.media;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class TrainingListScreen extends ConsumerWidget {
  const TrainingListScreen({super.key});

  static const _categories = [
    'Reflexo',
    'Defesa Alta',
    'Defesa Baixa',
    'Posicionamento',
    'Saída do Gol',
    '1x1',
    'Distribuição',
    'Jogo com os Pés',
    'Coordenação',
    'Agilidade',
    'Tempo de Reação',
    'Misto',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_trainingListProvider);
    final selectedCategory = ref.watch(_selectedCategoryProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Treinos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => ref.invalidate(_trainingListProvider),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/training/new');
          ref.invalidate(_trainingListProvider);
        },
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.add),
      ),
      body: async.when(
        loading: () => _LoadingState(),
        error: (e, _) => _ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(_trainingListProvider),
        ),
        data: (sessions) {
          final filtered = selectedCategory == null
              ? sessions
              : sessions.where((s) {
                  final label = AppConstants.trainingCategoryLabels[s.category] ?? s.category;
                  return label == selectedCategory;
                }).toList();

          final totalSessions = sessions.length;
          final totalHours = sessions.isEmpty
              ? 0.0
              : sessions
                      .map((s) => s.durationMinutes ?? 0)
                      .fold(0, (a, b) => a + b) /
                  60.0;

          return Column(
            children: [
              _StatsSummaryBar(
                totalSessions: totalSessions,
                totalHours: totalHours,
              ),
              _CategoryFilterRow(
                categories: _categories,
                selected: selectedCategory,
                onSelect: (c) =>
                    ref.read(_selectedCategoryProvider.notifier).state = c,
              ),
              Expanded(
                child: filtered.isEmpty
                    ? _EmptyState(hasFilter: selectedCategory != null)
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final s = filtered[i];
                          final categoryLabel =
                              AppConstants.trainingCategoryLabels[s.category] ??
                                  s.category;
                          return TrainingCard(
                            id: s.id,
                            date: DateTime.tryParse(s.date) ?? DateTime.now(),
                            category: categoryLabel,
                            intensity: _intensityEnum(s.intensity),
                            durationMinutes: s.durationMinutes ?? 0,
                            objective: s.objective,
                            onTap: () => context.go('/training/${s.id}'),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Loading state (shimmer-like)
// ---------------------------------------------------------------------------

class _LoadingState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.darkCard,
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
            itemCount: 5,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, __) => Container(
              height: 110,
              decoration: BoxDecoration(
                color: AppColors.darkCard,
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ),
      ],
    );
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
              'Não foi possível carregar os treinos',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
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

// ---------------------------------------------------------------------------
// Stats summary bar
// ---------------------------------------------------------------------------

class _StatsSummaryBar extends StatelessWidget {
  final int totalSessions;
  final double totalHours;

  const _StatsSummaryBar({
    required this.totalSessions,
    required this.totalHours,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.cyan.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          _SummaryItem(
            label: 'Sessões',
            value: '$totalSessions',
            color: AppColors.cyan,
          ),
          _Divider(),
          _SummaryItem(
            label: 'Total Horas',
            value: '${totalHours.toStringAsFixed(1)}h',
            color: AppColors.warning,
          ),
        ],
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SummaryItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 36,
      color: AppColors.textMuted.withOpacity(0.2),
    );
  }
}

// ---------------------------------------------------------------------------
// Filter chips row
// ---------------------------------------------------------------------------

class _CategoryFilterRow extends StatelessWidget {
  final List<String> categories;
  final String? selected;
  final void Function(String?) onSelect;

  const _CategoryFilterRow({
    required this.categories,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        scrollDirection: Axis.horizontal,
        children: [
          _FilterChip(
            label: 'Todos',
            isSelected: selected == null,
            color: AppColors.cyan,
            onTap: () => onSelect(null),
          ),
          const SizedBox(width: 6),
          ...categories.map((c) {
            final isSelected = selected == c;
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: _FilterChip(
                label: c,
                isSelected: isSelected,
                color: categoryColor(c),
                onTap: () => onSelect(isSelected ? null : c),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: isSelected ? color.withOpacity(0.2) : AppColors.darkElevated,
          border: Border.all(
            color: isSelected ? color : AppColors.textMuted.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? color : AppColors.textSecondary,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  final bool hasFilter;

  const _EmptyState({required this.hasFilter});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hasFilter ? Icons.filter_list_off : Icons.fitness_center_outlined,
            size: 56,
            color: AppColors.textMuted,
          ),
          const SizedBox(height: 12),
          Text(
            hasFilter
                ? 'Nenhum treino nessa categoria'
                : 'Nenhum treino registrado',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            hasFilter
                ? 'Selecione outra categoria ou remova o filtro'
                : 'Toque no + para adicionar um treino',
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
