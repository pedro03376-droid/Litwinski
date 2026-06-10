import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import '../../domain/entities/goalkeeper.dart';
import '../../data/repositories/goalkeeper_repository.dart';
import '../widgets/goalkeeper_card.dart';
import 'package:gkhub/shared/widgets/empty_state.dart';

// ─── State ───────────────────────────────────────────────────────────────────

class GoalkeepersFilter {
  final String search;
  final String? category;
  final int page;

  const GoalkeepersFilter({
    this.search = '',
    this.category,
    this.page = 1,
  });

  GoalkeepersFilter copyWith({
    String? search,
    String? category,
    bool clearCategory = false,
    int? page,
  }) =>
      GoalkeepersFilter(
        search: search ?? this.search,
        category: clearCategory ? null : (category ?? this.category),
        page: page ?? this.page,
      );
}

class GoalkeepersState {
  final List<Goalkeeper> goalkeepers;
  final bool isLoading;
  final String? error;
  final GoalkeepersFilter filter;

  const GoalkeepersState({
    this.goalkeepers = const [],
    this.isLoading = false,
    this.error,
    this.filter = const GoalkeepersFilter(),
  });

  GoalkeepersState copyWith({
    List<Goalkeeper>? goalkeepers,
    bool? isLoading,
    String? error,
    GoalkeepersFilter? filter,
    bool clearError = false,
  }) =>
      GoalkeepersState(
        goalkeepers: goalkeepers ?? this.goalkeepers,
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : (error ?? this.error),
        filter: filter ?? this.filter,
      );
}

class GoalkeepersNotifier extends StateNotifier<GoalkeepersState> {
  final GoalkeeperRepository _repository;

  GoalkeepersNotifier(this._repository) : super(const GoalkeepersState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final filter = state.filter;
      final data = await _repository.getAll(
        search: filter.search.isEmpty ? null : filter.search,
        category: filter.category,
        page: filter.page,
      );
      state = state.copyWith(goalkeepers: data, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Erro ao carregar goleiras. Tente novamente.',
      );
    }
  }

  Future<void> refresh() => load();

  void setSearch(String query) {
    state = state.copyWith(filter: state.filter.copyWith(search: query, page: 1));
    load();
  }

  void setCategory(String? category) {
    state = state.copyWith(
      filter: state.filter.copyWith(
        category: category,
        clearCategory: category == null,
        page: 1,
      ),
    );
    load();
  }
}

final goalkeepersProvider =
    StateNotifierProvider<GoalkeepersNotifier, GoalkeepersState>((ref) {
  return GoalkeepersNotifier(ref.read(goalkeeperRepositoryProvider));
});

// ─── Categories ──────────────────────────────────────────────────────────────

const _categories = [
  null, // "Todas"
  'adulto',
  'juvenil',
  'infantojuvenil',
  'infantil',
  'sub17',
  'sub15',
  'sub13',
];

const _categoryLabels = <String, String>{
  'adulto': 'Adulto',
  'juvenil': 'Juvenil',
  'infantojuvenil': 'Infantojuvenil',
  'infantil': 'Infantil',
  'sub17': 'Sub-17',
  'sub15': 'Sub-15',
  'sub13': 'Sub-13',
};

// ─── Screen ──────────────────────────────────────────────────────────────────

class GoalkeepersListScreen extends ConsumerStatefulWidget {
  const GoalkeepersListScreen({super.key});

  @override
  ConsumerState<GoalkeepersListScreen> createState() =>
      _GoalkeepersListScreenState();
}

class _GoalkeepersListScreenState extends ConsumerState<GoalkeepersListScreen> {
  bool _searchExpanded = false;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _toggleSearch() {
    setState(() => _searchExpanded = !_searchExpanded);
    if (_searchExpanded) {
      Future.delayed(const Duration(milliseconds: 150), () {
        _searchFocus.requestFocus();
      });
    } else {
      _searchController.clear();
      ref.read(goalkeepersProvider.notifier).setSearch('');
      _searchFocus.unfocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(goalkeepersProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: _buildAppBar(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/goalkeepers/new'),
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          // Animated search bar
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            height: _searchExpanded ? 64 : 0,
            color: AppColors.darkBackground,
            child: _searchExpanded
                ? Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocus,
                      onChanged: (v) =>
                          ref.read(goalkeepersProvider.notifier).setSearch(v),
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Buscar goleira...',
                        prefixIcon: const Icon(Icons.search,
                            color: AppColors.textMuted, size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? GestureDetector(
                                onTap: () {
                                  _searchController.clear();
                                  ref
                                      .read(goalkeepersProvider.notifier)
                                      .setSearch('');
                                },
                                child: const Icon(Icons.close,
                                    color: AppColors.textMuted, size: 18),
                              )
                            : null,
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),

          // Category filter chips
          _CategoryFilterRow(
            selectedCategory: state.filter.category,
            onChanged: (cat) =>
                ref.read(goalkeepersProvider.notifier).setCategory(cat),
          ),

          // Content
          Expanded(
            child: _buildContent(state),
          ),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      title: const Text('Goleiras'),
      actions: [
        IconButton(
          icon: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: Icon(
              _searchExpanded ? Icons.search_off : Icons.search,
              key: ValueKey(_searchExpanded),
              color: _searchExpanded ? AppColors.cyan : AppColors.textPrimary,
            ),
          ),
          onPressed: _toggleSearch,
          tooltip: 'Buscar',
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  Widget _buildContent(GoalkeepersState state) {
    if (state.isLoading && state.goalkeepers.isEmpty) {
      return _buildShimmer();
    }

    if (state.error != null && state.goalkeepers.isEmpty) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Erro ao carregar',
        subtitle: state.error!,
        actionLabel: 'Tentar novamente',
        onAction: () => ref.read(goalkeepersProvider.notifier).refresh(),
      );
    }

    if (state.goalkeepers.isEmpty) {
      return EmptyState(
        icon: Icons.sports_handball_outlined,
        title: 'Nenhuma goleira encontrada',
        subtitle: state.filter.search.isNotEmpty
            ? 'Tente uma busca diferente.'
            : 'Adicione a primeira goleira tocando no botão +',
        actionLabel: 'Adicionar goleira',
        onAction: () => context.go('/goalkeepers/new'),
      );
    }

    return RefreshIndicator(
      color: AppColors.cyan,
      backgroundColor: AppColors.darkCard,
      onRefresh: () => ref.read(goalkeepersProvider.notifier).refresh(),
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.82,
        ),
        itemCount: state.goalkeepers.length,
        itemBuilder: (context, index) {
          final gk = state.goalkeepers[index];
          return GoalkeeperCard(
            goalkeeper: gk,
            onTap: () => context.go('/goalkeepers/${gk.id}'),
          )
              .animate(delay: Duration(milliseconds: index * 40))
              .fade(duration: 300.ms)
              .slideY(begin: 0.15, end: 0, duration: 300.ms);
        },
      ),
    );
  }

  Widget _buildShimmer() {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.82,
      ),
      itemCount: 6,
      itemBuilder: (_, __) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: AppColors.darkCard,
        ),
      )
          .animate(onPlay: (c) => c.repeat())
          .shimmer(
            duration: 1200.ms,
            color: AppColors.darkElevated,
          ),
    );
  }
}

// ─── Category filter row ─────────────────────────────────────────────────────

class _CategoryFilterRow extends StatelessWidget {
  final String? selectedCategory;
  final ValueChanged<String?> onChanged;

  const _CategoryFilterRow({
    required this.selectedCategory,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final label = cat == null ? 'Todas' : (_categoryLabels[cat] ?? cat);
          final selected = selectedCategory == cat;
          return FilterChip(
            label: Text(
              label,
              style: TextStyle(
                color: selected ? Colors.black : AppColors.textSecondary,
                fontWeight:
                    selected ? FontWeight.w700 : FontWeight.w500,
                fontSize: 12,
              ),
            ),
            selected: selected,
            onSelected: (_) => onChanged(cat),
            backgroundColor: AppColors.darkCard,
            selectedColor: AppColors.cyan,
            checkmarkColor: Colors.black,
            side: BorderSide(
              color: selected
                  ? AppColors.cyan
                  : AppColors.textMuted.withOpacity(0.3),
              width: 1,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 4),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          );
        },
      ),
    );
  }
}
