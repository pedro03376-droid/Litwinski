import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import 'package:gkhub/core/providers/auth_provider.dart';
import '../../domain/entities/goalkeeper.dart';
import '../../data/repositories/goalkeeper_repository.dart';
import '../../../matches/data/repositories/match_repository.dart';
import '../../../matches/domain/entities/match.dart';
import '../../../training/data/repositories/training_repository.dart';
import '../../../training/domain/entities/training_session.dart';
import '../../../ai_analysis/data/repositories/ai_analysis_repository.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final _matchesProvider =
    FutureProvider.family<List<GKMatch>, String>((ref, goalkeeperId) async {
  return ref.read(matchRepositoryProvider).getAll(goalkeeperId: goalkeeperId);
});

final _trainingsProvider =
    FutureProvider.family<List<TrainingSession>, String>((ref, goalkeeperId) async {
  return ref.read(trainingRepositoryProvider).getAll(goalkeeperId: goalkeeperId);
});

final _aiAnalysesProvider =
    FutureProvider.family<List<AiAnalysis>, String>((ref, goalkeeperId) async {
  return ref.read(aiAnalysisRepositoryProvider).getForGoalkeeper(goalkeeperId, limit: 10);
});

final _goalkeeperDetailProvider =
    FutureProvider.family<Goalkeeper, String>((ref, id) async {
  return ref.read(goalkeeperRepositoryProvider).getById(id);
});

final _goalkeeperStatsProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.read(goalkeeperRepositoryProvider).getStats(id);
});

final _goalkeeperEvolutionProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.read(goalkeeperRepositoryProvider).getEvolution(id, 'semester');
});

// ─── Screen ──────────────────────────────────────────────────────────────────

class GoalkeeperDetailScreen extends ConsumerStatefulWidget {
  final String id;

  const GoalkeeperDetailScreen({super.key, required this.id});

  @override
  ConsumerState<GoalkeeperDetailScreen> createState() =>
      _GoalkeeperDetailScreenState();
}

class _GoalkeeperDetailScreenState
    extends ConsumerState<GoalkeeperDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  static const _tabs = ['Perfil', 'Jogos', 'Treinos', 'Performance', 'IA'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gkAsync = ref.watch(_goalkeeperDetailProvider(widget.id));
    final isTechnicalStaff =
        ref.watch(authStateProvider.select((s) => s.user?['role'] == 'technical_staff' || s.user?['role'] == 'admin'));

    return gkAsync.when(
      loading: () => const Scaffold(
        backgroundColor: AppColors.darkBackground,
        body: Center(child: CircularProgressIndicator(color: AppColors.cyan)),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: AppColors.darkBackground,
        appBar: AppBar(title: const Text('Goleira')),
        body: Center(
          child: Text('Erro ao carregar: $e',
              style: const TextStyle(color: AppColors.error)),
        ),
      ),
      data: (goalkeeper) => _buildScaffold(goalkeeper, isTechnicalStaff),
    );
  }

  Widget _buildScaffold(Goalkeeper goalkeeper, bool isTechnicalStaff) {
    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          _buildSliverAppBar(goalkeeper, isTechnicalStaff, innerBoxIsScrolled),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _ProfileTab(goalkeeper: goalkeeper),
            _MatchesTab(goalkeeperId: widget.id),
            _TrainingTab(goalkeeperId: widget.id),
            _PerformanceTab(goalkeeperName: goalkeeper.name, goalkeeperStatsAsync: ref.watch(_goalkeeperStatsProvider(widget.id)), goalkeeperEvolutionAsync: ref.watch(_goalkeeperEvolutionProvider(widget.id))),
            _AITab(goalkeeperId: widget.id),
          ],
        ),
      ),
    );
  }

  SliverAppBar _buildSliverAppBar(
      Goalkeeper goalkeeper, bool isTechnicalStaff, bool innerBoxIsScrolled) {
    return SliverAppBar(
      expandedHeight: 280,
      pinned: true,
      backgroundColor: AppColors.darkBackground,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios, color: AppColors.textPrimary),
        onPressed: () => context.pop(),
      ),
      actions: [
        if (isTechnicalStaff)
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: AppColors.cyan),
            onPressed: () => context.go('/goalkeepers/${widget.id}/edit'),
            tooltip: 'Editar',
          ),
        const SizedBox(width: 4),
      ],
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.parallax,
        background: _HeroHeader(goalkeeper: goalkeeper),
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: Container(
          color: AppColors.darkBackground,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            labelColor: AppColors.cyan,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.cyan,
            indicatorWeight: 2,
            labelStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              fontFamily: 'Inter',
            ),
            unselectedLabelStyle: const TextStyle(
              fontWeight: FontWeight.w500,
              fontSize: 13,
              fontFamily: 'Inter',
            ),
            tabs: _tabs.map((t) => Tab(text: t)).toList(),
          ),
        ),
      ),
    );
  }
}

// ─── Hero header ─────────────────────────────────────────────────────────────

class _HeroHeader extends StatelessWidget {
  final Goalkeeper goalkeeper;

  const _HeroHeader({required this.goalkeeper});

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Background photo or gradient
        if (goalkeeper.photo != null && goalkeeper.photo!.isNotEmpty)
          CachedNetworkImage(
            imageUrl: goalkeeper.photo!,
            fit: BoxFit.cover,
            placeholder: (_, __) => _gradientBg(),
            errorWidget: (_, __, ___) => _gradientBg(),
          )
        else
          _gradientBg(),

        // Dark overlay gradient
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0.0, 0.4, 1.0],
              colors: [
                Colors.transparent,
                Colors.transparent,
                AppColors.darkBackground,
              ],
            ),
          ),
        ),

        // Overlay info
        Positioned(
          bottom: 60,
          left: 20,
          right: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (goalkeeper.jerseyNumber != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.cyan.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.cyan.withOpacity(0.5),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    '#${goalkeeper.jerseyNumber}',
                    style: const TextStyle(
                      color: AppColors.cyan,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                goalkeeper.name,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  shadows: [
                    Shadow(
                      blurRadius: 12,
                      color: Colors.black87,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  _InfoChip(
                    label: '${goalkeeper.age} anos',
                    icon: Icons.cake_outlined,
                  ),
                  const SizedBox(width: 8),
                  _InfoChip(
                    label: goalkeeper.categoryLabel,
                    icon: Icons.category_outlined,
                  ),
                  if (goalkeeper.teamName != null) ...[
                    const SizedBox(width: 8),
                    _InfoChip(
                      label: goalkeeper.teamName!,
                      icon: Icons.shield_outlined,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _gradientBg() => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.darkSurface,
              AppColors.darkBackground,
            ],
          ),
        ),
      );
}

class _InfoChip extends StatelessWidget {
  final String label;
  final IconData icon;

  const _InfoChip({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.textSecondary, size: 12),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Tab 1: Perfil ────────────────────────────────────────────────────────────

class _ProfileTab extends StatelessWidget {
  final Goalkeeper goalkeeper;

  const _ProfileTab({required this.goalkeeper});

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd/MM/yyyy');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionCard(
          title: 'Dados Físicos',
          icon: Icons.fitness_center_outlined,
          children: [
            _DataRow('Altura', goalkeeper.height != null
                ? '${goalkeeper.height!.toStringAsFixed(2)} m'
                : '—'),
            _DataRow('Peso', goalkeeper.weight != null
                ? '${goalkeeper.weight!.toStringAsFixed(1)} kg'
                : '—'),
            _DataRow('Data de Nascimento', fmt.format(goalkeeper.birthDate)),
            _DataRow('Idade', '${goalkeeper.age} anos'),
          ],
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Lateralidade',
          icon: Icons.sports_handball_outlined,
          children: [
            _DataRow('Mão Dominante', goalkeeper.dominantHandLabel),
            _DataRow('Pé Dominante', goalkeeper.dominantFootLabel),
          ],
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Categoria & Equipe',
          icon: Icons.shield_outlined,
          children: [
            _DataRow('Categoria', goalkeeper.categoryLabel),
            _DataRow('Equipe', goalkeeper.teamName ?? '—'),
            _DataRow('Número', goalkeeper.jerseyNumber?.toString() ?? '—'),
            _DataRow(
              'Status',
              goalkeeper.isActive ? 'Ativa' : 'Inativa',
              valueColor:
                  goalkeeper.isActive ? AppColors.success : AppColors.error,
            ),
          ],
        ),
        if (goalkeeper.observations != null &&
            goalkeeper.observations!.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Observações',
            icon: Icons.notes_outlined,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  goalkeeper.observations!,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 80),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.textMuted.withOpacity(0.1),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.cyan, size: 18),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _DataRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _DataRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: TextStyle(
                color: valueColor ?? AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Tab 2: Jogos ────────────────────────────────────────────────────────────

class _MatchesTab extends ConsumerWidget {
  final String goalkeeperId;

  const _MatchesTab({required this.goalkeeperId});

  Color _resultColor(String? result) {
    switch (result) {
      case 'win':
        return const Color(0xFF22C55E);
      case 'draw':
        return const Color(0xFFF59E0B);
      case 'loss':
        return const Color(0xFFEF4444);
      default:
        return AppColors.textMuted;
    }
  }

  String _resultLabel(String? result) {
    switch (result) {
      case 'win':
        return 'Vitória';
      case 'draw':
        return 'Empate';
      case 'loss':
        return 'Derrota';
      default:
        return '—';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchesAsync = ref.watch(_matchesProvider(goalkeeperId));
    final fmt = DateFormat('dd/MM/yyyy');

    return matchesAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: AppColors.cyan),
      ),
      error: (e, _) => Center(
        child: Text(
          'Erro ao carregar jogos: $e',
          style: const TextStyle(color: AppColors.error),
        ),
      ),
      data: (matches) {
        if (matches.isEmpty) {
          return const Center(
            child: Text(
              'Nenhum jogo registrado',
              style: TextStyle(color: AppColors.textMuted),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: matches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final match = matches[index];
            final color = _resultColor(match.result);
            return Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.darkCard,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: color.withOpacity(0.2), width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          match.competition,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _resultLabel(match.result),
                          style: TextStyle(
                            color: color,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'vs ${match.opponent}',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.sports_soccer, color: AppColors.textMuted, size: 13),
                      const SizedBox(width: 4),
                      Text(
                        '${match.goalsScored} × ${match.goalsConceded}',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 14),
                      const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        fmt.format(match.date),
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      if (match.category != null) ...[
                        const SizedBox(width: 14),
                        const Icon(Icons.category_outlined, color: AppColors.textMuted, size: 12),
                        const SizedBox(width: 4),
                        Text(
                          match.category!,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Tab 3: Treinos ───────────────────────────────────────────────────────────

class _TrainingTab extends ConsumerWidget {
  final String goalkeeperId;

  const _TrainingTab({required this.goalkeeperId});

  Color _intensityColor(String intensity) {
    switch (intensity.toLowerCase()) {
      case 'high':
        return const Color(0xFFEF4444);
      case 'medium':
        return const Color(0xFFF59E0B);
      case 'low':
        return const Color(0xFF22C55E);
      default:
        return AppColors.textMuted;
    }
  }

  String _intensityLabel(String intensity) {
    switch (intensity.toLowerCase()) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
      default:
        return intensity;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trainingsAsync = ref.watch(_trainingsProvider(goalkeeperId));

    return trainingsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: AppColors.cyan),
      ),
      error: (e, _) => Center(
        child: Text(
          'Erro ao carregar treinos: $e',
          style: const TextStyle(color: AppColors.error),
        ),
      ),
      data: (sessions) {
        if (sessions.isEmpty) {
          return const Center(
            child: Text(
              'Nenhum treino registrado',
              style: TextStyle(color: AppColors.textMuted),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: sessions.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final session = sessions[index];
            final color = _intensityColor(session.intensity);
            return Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.darkCard,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.cyan.withOpacity(0.1), width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          session.category,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _intensityLabel(session.intensity),
                          style: TextStyle(
                            color: color,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    session.objective,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        session.date,
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      if (session.durationMinutes != null) ...[
                        const SizedBox(width: 14),
                        const Icon(Icons.timer_outlined, color: AppColors.textMuted, size: 12),
                        const SizedBox(width: 4),
                        Text(
                          '${session.durationMinutes} min',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                      if (session.exercises.isNotEmpty) ...[
                        const SizedBox(width: 14),
                        const Icon(Icons.fitness_center_outlined, color: AppColors.textMuted, size: 12),
                        const SizedBox(width: 4),
                        Text(
                          '${session.exercises.length} exercício${session.exercises.length == 1 ? '' : 's'}',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Tab 4: Performance ───────────────────────────────────────────────────────

class _PerformanceTab extends StatelessWidget {
  final String goalkeeperName;
  final AsyncValue<Map<String, dynamic>> goalkeeperStatsAsync;
  final AsyncValue<Map<String, dynamic>> goalkeeperEvolutionAsync;

  const _PerformanceTab({
    required this.goalkeeperName,
    required this.goalkeeperStatsAsync,
    required this.goalkeeperEvolutionAsync,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Radar de Habilidades',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        goalkeeperStatsAsync.when(
          loading: () => const SizedBox(
            height: 280,
            child: Center(
                child: CircularProgressIndicator(color: AppColors.cyan)),
          ),
          error: (e, _) => Container(
            height: 280,
            alignment: Alignment.center,
            child: Text('Sem dados: $e',
                style: const TextStyle(color: AppColors.textMuted)),
          ),
          data: (stats) => _RadarChart(stats: stats),
        ),
        const SizedBox(height: 24),
        const Text(
          'Evolução',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        goalkeeperEvolutionAsync.when(
          loading: () => const SizedBox(
            height: 200,
            child: Center(
                child: CircularProgressIndicator(color: AppColors.cyan)),
          ),
          error: (e, _) => Container(
            height: 200,
            alignment: Alignment.center,
            child: Text('Sem dados',
                style: const TextStyle(color: AppColors.textMuted)),
          ),
          data: (evolution) => _EvolutionLineChart(evolution: evolution),
        ),
        const SizedBox(height: 80),
      ],
    );
  }
}

// Radar chart using a CustomPainter (fl_chart RadarChart wrapper)
class _RadarChart extends StatelessWidget {
  final Map<String, dynamic> stats;

  const _RadarChart({required this.stats});

  @override
  Widget build(BuildContext context) {
    // Fallback sample labels and values if backend data is not yet typed
    final labels = [
      'Defesas', 'Posicionamento', 'Distribuição',
      'Saídas', 'Pés', 'Mental'
    ];
    final rawValues = stats['skills'] as List<dynamic>? ??
        List.generate(labels.length, (_) => 7.0);
    final values = rawValues
        .map((v) => (v is num) ? v.toDouble().clamp(0.0, 10.0) : 7.0)
        .toList();

    return Container(
      height: 280,
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.textMuted.withOpacity(0.1)),
      ),
      padding: const EdgeInsets.all(16),
      child: CustomPaint(
        painter: _SpiderChartPainter(
          labels: labels,
          values: values,
          maxValue: 10.0,
        ),
        child: Container(),
      ),
    );
  }
}

class _SpiderChartPainter extends CustomPainter {
  final List<String> labels;
  final List<double> values;
  final double maxValue;

  _SpiderChartPainter({
    required this.labels,
    required this.values,
    required this.maxValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 28;
    final n = labels.length;
    if (n < 3) return;

    final gridPaint = Paint()
      ..color = AppColors.textMuted.withOpacity(0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final axisPaint = Paint()
      ..color = AppColors.textMuted.withOpacity(0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final fillPaint = Paint()
      ..color = AppColors.cyan.withOpacity(0.15)
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = AppColors.cyan
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    final dotPaint = Paint()
      ..color = AppColors.cyan
      ..style = PaintingStyle.fill;

    // Draw grid rings
    for (int ring = 1; ring <= 5; ring++) {
      final r = radius * ring / 5;
      final path = Path();
      for (int i = 0; i < n; i++) {
        final angle = 2 * math.pi * i / n - math.pi / 2;
        final x = center.dx + r * math.cos(angle);
        final y = center.dy + r * math.sin(angle);
        if (i == 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.close();
      canvas.drawPath(path, gridPaint);
    }

    // Draw axes
    for (int i = 0; i < n; i++) {
      final angle = 2 * math.pi * i / n - math.pi / 2;
      final x = center.dx + radius * math.cos(angle);
      final y = center.dy + radius * math.sin(angle);
      canvas.drawLine(center, Offset(x, y), axisPaint);
    }

    // Draw filled polygon
    final valuePath = Path();
    for (int i = 0; i < n; i++) {
      final angle = 2 * math.pi * i / n - math.pi / 2;
      final r = radius * (values[i] / maxValue);
      final x = center.dx + r * math.cos(angle);
      final y = center.dy + r * math.sin(angle);
      if (i == 0) valuePath.moveTo(x, y);
      else valuePath.lineTo(x, y);
    }
    valuePath.close();
    canvas.drawPath(valuePath, fillPaint);
    canvas.drawPath(valuePath, strokePaint);

    // Draw dots and labels
    final textStyle = const TextStyle(
      color: AppColors.textSecondary,
      fontSize: 10,
      fontFamily: 'Inter',
    );

    for (int i = 0; i < n; i++) {
      final angle = 2 * math.pi * i / n - math.pi / 2;
      final r = radius * (values[i] / maxValue);
      final vx = center.dx + r * math.cos(angle);
      final vy = center.dy + r * math.sin(angle);
      canvas.drawCircle(Offset(vx, vy), 4, dotPaint);

      // Labels
      final lx = center.dx + (radius + 18) * math.cos(angle);
      final ly = center.dy + (radius + 18) * math.sin(angle);
      final tp = TextPainter(
        text: TextSpan(text: labels[i], style: textStyle),
        textDirection: ui.TextDirection.ltr,
      )..layout();
      tp.paint(
        canvas,
        Offset(lx - tp.width / 2, ly - tp.height / 2),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SpiderChartPainter oldDelegate) =>
      oldDelegate.values != values;
}

class _EvolutionLineChart extends StatelessWidget {
  final Map<String, dynamic> evolution;

  const _EvolutionLineChart({required this.evolution});

  @override
  Widget build(BuildContext context) {
    final points = evolution['scores'] as List<dynamic>? ?? [];
    final spots = points.asMap().entries.map((e) {
      final v = e.value is num ? (e.value as num).toDouble() : 7.0;
      return FlSpot(e.key.toDouble(), v);
    }).toList();

    if (spots.isEmpty) {
      spots.addAll([
        const FlSpot(0, 6.5),
        const FlSpot(1, 7.2),
        const FlSpot(2, 6.8),
        const FlSpot(3, 7.5),
        const FlSpot(4, 8.0),
        const FlSpot(5, 7.9),
      ]);
    }

    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.textMuted.withOpacity(0.1)),
      ),
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: 10,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: 2,
            getDrawingHorizontalLine: (_) => FlLine(
              color: AppColors.textMuted.withOpacity(0.1),
              strokeWidth: 1,
            ),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 2,
                reservedSize: 32,
                getTitlesWidget: (v, _) => Text(
                  v.toInt().toString(),
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10,
                  ),
                ),
              ),
            ),
            bottomTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: AppColors.cyan,
              barWidth: 2.5,
              dotData: const FlDotData(show: true),
              belowBarData: BarAreaData(
                show: true,
                color: AppColors.cyan.withOpacity(0.08),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Tab 5: IA ───────────────────────────────────────────────────────────────

class _AITab extends ConsumerStatefulWidget {
  final String goalkeeperId;

  const _AITab({required this.goalkeeperId});

  @override
  ConsumerState<_AITab> createState() => _AITabState();
}

class _AITabState extends ConsumerState<_AITab> {
  @override
  Widget build(BuildContext context) {
    final analysesAsync = ref.watch(_aiAnalysesProvider(widget.goalkeeperId));
    final fmt = DateFormat('dd/MM/yyyy HH:mm');

    return analysesAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: AppColors.cyan),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 40),
              const SizedBox(height: 12),
              Text(
                'Erro ao carregar análises: $e',
                style: const TextStyle(color: AppColors.error),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(_aiAnalysesProvider(widget.goalkeeperId)),
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar novamente'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.cyan,
                  foregroundColor: AppColors.darkBackground,
                ),
              ),
            ],
          ),
        ),
      ),
      data: (analyses) {
        if (analyses.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.darkCard,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.auto_awesome,
                        color: AppColors.purple, size: 40),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Nenhuma análise disponível',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use a tab de Partidas ou Treinos para gerar uma análise',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 13,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    onPressed: () => ref.invalidate(_aiAnalysesProvider(widget.goalkeeperId)),
                    icon: const Icon(Icons.refresh, color: AppColors.cyan),
                    label: const Text('Atualizar',
                        style: TextStyle(color: AppColors.cyan)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.cyan),
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
          itemCount: analyses.length + 1,
          itemBuilder: (context, index) {
            if (index == analyses.length) {
              return Padding(
                padding: const EdgeInsets.only(top: 8),
                child: OutlinedButton.icon(
                  onPressed: () => ref.invalidate(_aiAnalysesProvider(widget.goalkeeperId)),
                  icon: const Icon(Icons.refresh, color: AppColors.cyan),
                  label: const Text('Atualizar Análises',
                      style: TextStyle(color: AppColors.cyan)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.cyan),
                    minimumSize: const Size(double.infinity, 48),
                  ),
                ),
              );
            }

            final analysis = analyses[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header row: date + score
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome,
                          color: AppColors.purple, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        'Análise • ${fmt.format(analysis.createdAt)}',
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                      const Spacer(),
                      if (analysis.overallScore != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.purple.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${analysis.overallScore!.toStringAsFixed(1)} / 10',
                            style: const TextStyle(
                              color: AppColors.purple,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (analysis.strengths.isNotEmpty) ...[
                    _AICard(
                      title: 'Pontos Fortes',
                      icon: Icons.trending_up_rounded,
                      color: AppColors.success,
                      items: analysis.strengths,
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (analysis.attentionPoints.isNotEmpty) ...[
                    _AICard(
                      title: 'Pontos de Atenção',
                      icon: Icons.warning_amber_rounded,
                      color: AppColors.warning,
                      items: analysis.attentionPoints,
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (analysis.evolutionNotes.isNotEmpty) ...[
                    _AICard(
                      title: 'Notas de Evolução',
                      icon: Icons.show_chart_rounded,
                      color: AppColors.cyan,
                      items: analysis.evolutionNotes,
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (analysis.trainingSuggestions.isNotEmpty) ...[
                    _AICard(
                      title: 'Sugestões de Treino',
                      icon: Icons.lightbulb_outline_rounded,
                      color: AppColors.purple,
                      items: analysis.trainingSuggestions,
                    ),
                    const SizedBox(height: 10),
                  ],
                  Divider(
                    color: AppColors.textMuted.withOpacity(0.1),
                    height: 1,
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _AICard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<String> items;

  const _AICard({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  color: color,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 5),
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color.withOpacity(0.7),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().fade(duration: 300.ms).slideY(begin: 0.1, end: 0);
  }
}
