import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import '../widgets/training_card.dart';

// ---------------------------------------------------------------------------
// Mock data (using domain entity fields)
// ---------------------------------------------------------------------------

// Local view model that pairs the domain entity with a parsed date and intensity
class _TrainingSessionView {
  final String id;
  final DateTime date;
  final String category;
  final TrainingIntensity intensity;
  final int durationMinutes;
  final String objective;

  const _TrainingSessionView({
    required this.id,
    required this.date,
    required this.category,
    required this.intensity,
    required this.durationMinutes,
    required this.objective,
  });
}

final _mockSessions = <_TrainingSessionView>[
  _TrainingSessionView(
    id: '1',
    date: DateTime(2026, 6, 7),
    category: 'Reflexo',
    intensity: TrainingIntensity.alta,
    durationMinutes: 90,
    objective: 'Trabalhar tempo de reação em defesas de curta distância',
  ),
  _TrainingSessionView(
    id: '2',
    date: DateTime(2026, 6, 5),
    category: 'Defesa Alta',
    intensity: TrainingIntensity.media,
    durationMinutes: 75,
    objective: 'Aperfeiçoar posicionamento em cruzamentos e bolas altas',
  ),
  _TrainingSessionView(
    id: '3',
    date: DateTime(2026, 6, 3),
    category: 'Posicionamento',
    intensity: TrainingIntensity.baixa,
    durationMinutes: 60,
    objective: 'Ajustar angulação defensiva nas bolas nas costas da zaga',
  ),
  _TrainingSessionView(
    id: '4',
    date: DateTime(2026, 6, 1),
    category: 'Defesa Baixa',
    intensity: TrainingIntensity.maxima,
    durationMinutes: 100,
    objective: 'Treino de raspões, espaladas e rebotes',
  ),
  _TrainingSessionView(
    id: '5',
    date: DateTime(2026, 5, 29),
    category: 'Saída',
    intensity: TrainingIntensity.media,
    durationMinutes: 80,
    objective: 'Saídas de gol e comando da área em bolas aéreas',
  ),
  _TrainingSessionView(
    id: '6',
    date: DateTime(2026, 5, 26),
    category: 'Jogo com os Pés',
    intensity: TrainingIntensity.baixa,
    durationMinutes: 60,
    objective: 'Construção pelo goleiro — passe curto e longo',
  ),
];

final trainingSessionsProvider =
    Provider<List<_TrainingSessionView>>((_) => _mockSessions);

final _selectedCategoryProvider = StateProvider<String?>((ref) => null);

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
    'Saída',
    'Interceptação',
    'Jogo com os Pés',
    'Distribuição',
    'Decisão',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(trainingSessionsProvider);
    final selectedCategory = ref.watch(_selectedCategoryProvider);

    final filtered = selectedCategory == null
        ? sessions
        : sessions.where((s) => s.category == selectedCategory).toList();

    // Stats
    final totalSessions = sessions.length;
    final totalHours = sessions.isEmpty
        ? 0.0
        : sessions.map((s) => s.durationMinutes).reduce((a, b) => a + b) / 60.0;

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Treinos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: AppColors.textSecondary),
            onPressed: () {},
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
      body: Column(
        children: [
          // Stats summary bar
          _StatsSummaryBar(
            totalSessions: totalSessions,
            totalHours: totalHours,
          ),
          // Category filter chips
          _CategoryFilterRow(
            categories: _categories,
            selected: selectedCategory,
            onSelect: (c) =>
                ref.read(_selectedCategoryProvider.notifier).state = c,
          ),
          // Sessions list
          Expanded(
            child: filtered.isEmpty
                ? _EmptyState(hasFilter: selectedCategory != null)
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final s = filtered[i];
                      return TrainingCard(
                        id: s.id,
                        date: s.date,
                        category: s.category,
                        intensity: s.intensity,
                        durationMinutes: s.durationMinutes,
                        objective: s.objective,
                        onTap: () => context.go('/training/${s.id}'),
                      );
                    },
                  ),
          ),
        ],
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
          // "Todos" chip
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
