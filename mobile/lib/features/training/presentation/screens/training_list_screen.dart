import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import 'package:gkhub/core/constants/app_constants.dart';
import '../../data/repositories/training_repository.dart';
import '../../domain/entities/training_session.dart';
import '../widgets/training_card.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final _selectedCategoryProvider = StateProvider<String?>((ref) => null);

final _trainingsProvider = FutureProvider<List<TrainingSession>>((ref) async {
  final repo = ref.read(trainingRepositoryProvider);
  return repo.getAll(perPage: 100);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

DateTime _parseDate(String raw) {
  try {
    return DateTime.parse(raw);
  } catch (_) {
    return DateTime.now();
  }
}

String _categoryLabel(String apiCategory) =>
    AppConstants.trainingCategoryLabels[apiCategory] ?? apiCategory;

TrainingIntensity _intensityFromApi(String intensity) =>
    TrainingIntensityExt.fromString(intensity);

// ─── Screen ──────────────────────────────────────────────────────────────────

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
    final trainingsAsync = ref.watch(_trainingsProvider);
    final selectedCategory = ref.watch(_selectedCategoryProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Treinos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => ref.invalidate(_trainingsProvider),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.add),
      ),
      body: trainingsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.cyan),
        ),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(
                'Erro ao carregar treinos',
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 16),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.invalidate(_trainingsProvider),
                child: const Text('Tentar novamente',
                    style: TextStyle(color: AppColors.cyan)),
              ),
            ],
          ),
        ),
        data: (sessions) {
          // Map each TrainingSession to what the UI needs
          final views = sessions.map((s) {
            final label = _categoryLabel(s.category);
            return _SessionView(
              id: s.id,
              date: _parseDate(s.date),
              categoryLabel: label,
              intensity: _intensityFromApi(s.intensity),
              durationMinutes: s.durationMinutes ?? 0,
              objective: s.objective,
            );
          }).toList();

          final filtered = selectedCategory == null
              ? views
              : views
                  .where((v) => v.categoryLabel == selectedCategory)
                  .toList();

          final totalSessions = views.length;
          final totalHours = views.isEmpty
              ? 0.0
              : views
                      .map((s) => s.durationMinutes)
                      .reduce((a, b) => a + b) /
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
                        padding:
                            const EdgeInsets.fromLTRB(16, 12, 16, 100),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final s = filtered[i];
                          return TrainingCard(
                            id: s.id,
                            date: s.date,
                            category: s.categoryLabel,
                            intensity: s.intensity,
                            durationMinutes: s.durationMinutes,
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

// Internal view model
class _SessionView {
  final String id;
  final DateTime date;
  final String categoryLabel;
  final TrainingIntensity intensity;
  final int durationMinutes;
  final String objective;

  const _SessionView({
    required this.id,
    required this.date,
    required this.categoryLabel,
    required this.intensity,
    required this.durationMinutes,
    required this.objective,
  });
}

// ─── Stats summary bar ────────────────────────────────────────────────────────

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
          _DividerLine(),
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

class _DividerLine extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 36,
      color: AppColors.textMuted.withOpacity(0.2),
    );
  }
}

// ─── Filter chips row ─────────────────────────────────────────────────────────

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
          color: isSelected
              ? color.withOpacity(0.2)
              : AppColors.darkElevated,
          border: Border.all(
            color: isSelected
                ? color
                : AppColors.textMuted.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? color : AppColors.textSecondary,
            fontSize: 12,
            fontWeight:
                isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

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
            hasFilter
                ? Icons.filter_list_off
                : Icons.fitness_center_outlined,
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
