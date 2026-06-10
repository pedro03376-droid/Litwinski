import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/repositories/match_repository.dart';
import '../../domain/entities/match.dart';
import '../widgets/match_card.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/loading_widget.dart';
import '../../../../core/theme/app_theme.dart';

final _filterProvider = StateProvider<String?>((ref) => null);
final _goalkeepersMatchesProvider =
    FutureProvider.family<List<GKMatch>, String?>((ref, gkId) async {
  final filter = ref.watch(_filterProvider);
  return ref.read(matchRepositoryProvider).getAll(
        goalkeeperId: gkId,
        result: filter,
      );
});

class MatchesListScreen extends ConsumerWidget {
  const MatchesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(_filterProvider);
    final matchesAsync = ref.watch(_goalkeepersMatchesProvider(null));

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Jogos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/matches/new'),
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        icon: const Icon(Icons.add),
        label: const Text('Novo Jogo', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          _FilterRow(current: filter),
          Expanded(
            child: matchesAsync.when(
              loading: () => const LoadingWidget(),
              error: (e, _) => Center(
                child: Text('Erro: $e',
                    style: const TextStyle(color: AppColors.error)),
              ),
              data: (matches) {
                if (matches.isEmpty) {
                  return const EmptyState(
                    icon: Icons.sports_soccer,
                    title: 'Nenhum jogo registrado',
                    subtitle: 'Toque em + para registrar uma partida',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () =>
                      ref.refresh(_goalkeepersMatchesProvider(null).future),
                  color: AppColors.cyan,
                  backgroundColor: AppColors.darkCard,
                  child: ListView.builder(
                    padding: const EdgeInsets.only(top: 8, bottom: 100),
                    itemCount: matches.length,
                    itemBuilder: (_, i) => MatchCard(
                      match: matches[i],
                      onTap: () => context.go('/matches/${matches[i].id}'),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterRow extends ConsumerWidget {
  final String? current;
  const _FilterRow({required this.current});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = [
      (null, 'Todos'),
      ('win', 'Vitórias'),
      ('draw', 'Empates'),
      ('loss', 'Derrotas'),
    ];
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (val, label) = filters[i];
          final selected = current == val;
          return FilterChip(
            label: Text(label),
            selected: selected,
            onSelected: (_) =>
                ref.read(_filterProvider.notifier).state = val,
            selectedColor: AppColors.cyan.withOpacity(0.2),
            labelStyle: TextStyle(
              color: selected ? AppColors.cyan : AppColors.textSecondary,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
            ),
            side: BorderSide(
              color: selected
                  ? AppColors.cyan
                  : AppColors.textMuted.withOpacity(0.3),
            ),
            backgroundColor: AppColors.darkCard,
            checkmarkColor: AppColors.cyan,
          );
        },
      ),
    );
  }
}
