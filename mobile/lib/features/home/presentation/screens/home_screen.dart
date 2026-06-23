import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/error_widget.dart';
import '../../../../shared/widgets/gk_avatar.dart';
import '../../../../shared/widgets/loading_widget.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/stat_card.dart';
import '../../../matches/data/repositories/match_repository.dart';
import '../widgets/evolution_chart.dart';
import '../widgets/match_result_card.dart';

// ─── Data models ─────────────────────────────────────────────────────────────

class HomeSummary {
  final int gamesPlayed;
  final int totalSaves;
  final double savePercentage;
  final double evolutionScore;

  const HomeSummary({
    required this.gamesPlayed,
    required this.totalSaves,
    required this.savePercentage,
    required this.evolutionScore,
  });
}

class RecentMatch {
  final DateTime date;
  final String competition;
  final String teamName;
  final String opponentName;
  final int teamScore;
  final int opponentScore;
  final int saves;
  final bool cleanSheet;

  const RecentMatch({
    required this.date,
    required this.competition,
    this.teamName = 'Meu Time',
    required this.opponentName,
    required this.teamScore,
    required this.opponentScore,
    required this.saves,
    this.cleanSheet = false,
  });
}

// ─── Helper: extract goalkeeper ID from auth user map ────────────────────────

String _gkIdFromAuth(Map<String, dynamic>? user) =>
    user?['goalkeeperId'] as String? ??
    user?['goalkeeper']?['id'] as String? ??
    user?['id'] as String? ??
    '';

// ─── Providers ────────────────────────────────────────────────────────────────

final homeSummaryProvider = FutureProvider<HomeSummary>((ref) async {
  final matchRepo = ref.read(matchRepositoryProvider);
  final authState = ref.read(authStateProvider);
  final gkId = _gkIdFromAuth(authState.user);

  try {
    // Try dedicated stats endpoint
    final stats = await matchRepo.getStats(gkId);
    return HomeSummary(
      gamesPlayed: (stats['totalMatches'] ?? stats['gamesPlayed'] ?? 0) as int,
      totalSaves: (stats['totalSaves'] ?? 0) as int,
      savePercentage:
          double.tryParse(stats['savePercentage']?.toString() ?? '0') ?? 0,
      evolutionScore:
          double.tryParse(stats['evolutionScore']?.toString() ??
                  stats['overallScore']?.toString() ??
                  '0') ??
              0,
    );
  } catch (_) {
    // Fallback: compute from match list
    final matches = await matchRepo.getAll(goalkeeperId: gkId, limit: 100);
    var totalSaves = 0;
    var totalShots = 0;
    for (final m in matches) {
      if (m.scout != null) {
        totalSaves += m.scout!.totalSaves;
        totalShots += m.scout!.totalShots;
      }
    }
    final savePct =
        totalShots == 0 ? 0.0 : (totalSaves / totalShots) * 100;
    return HomeSummary(
      gamesPlayed: matches.length,
      totalSaves: totalSaves,
      savePercentage: savePct,
      evolutionScore: 0,
    );
  }
});

final recentMatchProvider = FutureProvider<RecentMatch?>((ref) async {
  final matchRepo = ref.read(matchRepositoryProvider);
  final authState = ref.read(authStateProvider);
  final gkId = _gkIdFromAuth(authState.user);

  try {
    // Try /matches/recent/{gkId} first
    final recent = await matchRepo.getRecent(gkId, limit: 1);
    if (recent.isEmpty) return null;
    final m = recent.first;
    return RecentMatch(
      date: m.date,
      competition: m.competition,
      opponentName: m.opponent,
      teamScore: m.goalsScored,
      opponentScore: m.goalsConceded,
      saves: m.scout?.totalSaves ?? 0,
      cleanSheet: m.isCleanSheet,
    );
  } catch (_) {
    // Fallback: regular list endpoint
    try {
      final matches = await matchRepo.getAll(goalkeeperId: gkId, limit: 1);
      if (matches.isEmpty) return null;
      final m = matches.first;
      return RecentMatch(
        date: m.date,
        competition: m.competition,
        opponentName: m.opponent,
        teamScore: m.goalsScored,
        opponentScore: m.goalsConceded,
        saves: m.scout?.totalSaves ?? 0,
        cleanSheet: m.isCleanSheet,
      );
    } catch (_) {
      return null;
    }
  }

});

final weeklyChartDataProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiClientProvider);
  final authState = ref.read(authStateProvider);
  final gkId = _gkIdFromAuth(authState.user);
  if (gkId.isEmpty) return [];

  try {
    final data = await api.get<Map<String, dynamic>>(
      '/performance/evolution/$gkId',
      queryParameters: {'period': 'month'},
    );
    final raw = (data['dataPoints'] ??
            data['points'] ??
            data['evolution'] ??
            []) as List;
    if (raw.isEmpty) return [];
    final last7 = raw.length > 7 ? raw.sublist(raw.length - 7) : raw;
    return last7.map<Map<String, dynamic>>((p) {
      final m = p as Map<String, dynamic>;
      return {
        'label': m['label'] ?? m['date'] ?? '',
        'overallScore':
            double.tryParse(m['overallScore']?.toString() ?? '0') ?? 0,
        'reflexScore':
            double.tryParse(m['reflexScore']?.toString() ?? '0') ?? 0,
        'highSaveScore':
            double.tryParse(m['highSaveScore']?.toString() ?? '0') ?? 0,
      };
    }).toList();
  } catch (_) {
    return [];
  }
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final userName = authState.user?['name'] as String? ?? 'Goleiro';

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.cyan,
          backgroundColor: AppColors.darkCard,
          onRefresh: () async {
            ref.invalidate(homeSummaryProvider);
            ref.invalidate(recentMatchProvider);
            ref.invalidate(weeklyChartDataProvider);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // ── AppBar ────────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: _HomeAppBar(userName: userName),
              ),

              // ── Summary cards ─────────────────────────────────────────────
              SliverToBoxAdapter(
                child: _SummarySection(),
              ),

              // ── Última partida ────────────────────────────────────────────
              SliverToBoxAdapter(
                child: _RecentMatchSection(),
              ),

              // ── Evolução semanal ──────────────────────────────────────────
              SliverToBoxAdapter(
                child: _WeeklyChartSection(),
              ),

              // ── Quick actions ─────────────────────────────────────────────
              SliverToBoxAdapter(
                child: _QuickActionsSection(),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── AppBar ───────────────────────────────────────────────────────────────────

class _HomeAppBar extends ConsumerWidget {
  final String userName;

  const _HomeAppBar({required this.userName});

  String get _formattedDate {
    final now = DateTime.now();
    return DateFormat("EEEE, d 'de' MMMM", 'pt_BR').format(now);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 8),
      child: Row(
        children: [
          // Logo + greeting
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // GKHUB logo
                const Text(
                  'GKHUB',
                  style: TextStyle(
                    color: AppColors.cyan,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    fontFamily: 'Inter',
                    letterSpacing: 3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Olá, ${userName.split(' ').first}!',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Inter',
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  _formattedDate,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontFamily: 'Inter',
                  ),
                ),
              ],
            ),
          ),

          // Notification bell
          IconButton(
            onPressed: () {},
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(
                  Icons.notifications_outlined,
                  color: AppColors.textSecondary,
                  size: 26,
                ),
                // Unread badge
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    width: 9,
                    height: 9,
                    decoration: const BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Avatar
          GKAvatar(
            imageUrl: authState.user?['avatar'] as String?,
            name: userName,
            size: 38,
            borderColor: AppColors.cyan.withOpacity(0.4),
            borderWidth: 1.5,
          ),

          const SizedBox(width: 4),
        ],
      ),
    ).animate().fade(duration: 400.ms).slideY(begin: -0.1, end: 0, duration: 400.ms);
  }
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

class _SummarySection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(homeSummaryProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        summaryAsync.when(
          loading: () => const ShimmerSummaryRow(),
          error: (err, _) => const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: GKErrorWidget(
              title: 'Erro ao carregar resumo',
              message: 'Puxe para baixo para tentar novamente.',
            ),
          ),
          data: (summary) => _SummaryCards(summary: summary),
        ),
      ],
    );
  }
}

class _SummaryCards extends StatelessWidget {
  final HomeSummary summary;

  const _SummaryCards({required this.summary});

  @override
  Widget build(BuildContext context) {
    final cards = [
      _CardData(
        title: 'Jogos Realizados',
        value: '${summary.gamesPlayed}',
        subtitle: 'nesta temporada',
        icon: Icons.sports_soccer,
        color: const Color(0xFF4A90D9),
      ),
      _CardData(
        title: 'Defesas Totais',
        value: '${summary.totalSaves}',
        subtitle: 'acumuladas',
        icon: Icons.pan_tool_outlined,
        color: AppColors.cyan,
      ),
      _CardData(
        title: 'Média Defesas %',
        value: '${summary.savePercentage.toStringAsFixed(1)}%',
        subtitle: 'aproveitamento',
        icon: Icons.percent_rounded,
        color: AppColors.success,
      ),
      _CardData(
        title: 'Evolução',
        value: '${summary.evolutionScore.toStringAsFixed(0)}',
        subtitle: 'pontuação geral',
        icon: Icons.trending_up_rounded,
        color: AppColors.purple,
      ),
    ];

    return SizedBox(
      height: 140,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: cards.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final card = cards[index];
          return SizedBox(
            width: 148,
            child: StatCard(
              title: card.title,
              value: card.value,
              subtitle: card.subtitle,
              icon: card.icon,
              color: card.color,
            )
                .animate(delay: Duration(milliseconds: 80 * index))
                .fade(duration: 400.ms)
                .slideY(begin: 0.15, end: 0, duration: 400.ms, curve: Curves.easeOut),
          );
        },
      ),
    );
  }
}

class _CardData {
  final String title;
  final String value;
  final String? subtitle;
  final IconData icon;
  final Color color;

  const _CardData({
    required this.title,
    required this.value,
    this.subtitle,
    required this.icon,
    required this.color,
  });
}

// ─── Recent Match ─────────────────────────────────────────────────────────────

class _RecentMatchSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchAsync = ref.watch(recentMatchProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Última Partida',
            onViewAll: () => context.go('/matches'),
          ),
          const SizedBox(height: 14),
          matchAsync.when(
            loading: () => const ShimmerCard(),
            error: (err, _) => GKErrorWidget(
              title: 'Erro ao carregar partida',
              onRetry: () => ref.invalidate(recentMatchProvider),
            ),
            data: (match) {
              if (match == null) {
                return const EmptyState(
                  icon: Icons.sports_soccer,
                  title: 'Nenhuma partida registrada',
                  subtitle: 'Adicione sua primeira partida para\nver os resultados aqui.',
                  actionLabel: '+ Novo Jogo',
                );
              }
              return MatchResultCard(
                date: match.date,
                competition: match.competition,
                teamName: match.teamName,
                opponentName: match.opponentName,
                teamScore: match.teamScore,
                opponentScore: match.opponentScore,
                saves: match.saves,
                cleanSheet: match.cleanSheet,
                onTap: () => context.go('/matches'),
              )
                  .animate()
                  .fade(duration: 400.ms)
                  .slideY(begin: 0.1, end: 0, duration: 400.ms, curve: Curves.easeOut);
            },
          ),
        ],
      ),
    );
  }
}

// ─── Weekly Evolution Chart ───────────────────────────────────────────────────

class _WeeklyChartSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chartAsync = ref.watch(weeklyChartDataProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Evolução Semanal',
            subtitle: 'últimos 7 dias',
            onViewAll: () => context.go('/performance'),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.fromLTRB(8, 16, 16, 12),
            decoration: BoxDecoration(
              color: AppColors.darkCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.textMuted.withOpacity(0.1),
                width: 1,
              ),
            ),
            child: chartAsync.when(
              loading: () => const SizedBox(
                height: 220,
                child: Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.cyan),
                  ),
                ),
              ),
              error: (err, _) => GKErrorWidget(
                title: 'Erro ao carregar gráfico',
                onRetry: () => ref.invalidate(weeklyChartDataProvider),
              ),
              data: (data) => EvolutionChart(
                chartData: data,
                height: 220,
              ).animate().fade(duration: 500.ms),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

class _QuickActionsSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Ações Rápidas'),
          const SizedBox(height: 14),
          Row(
            children: [
              _ActionButton(
                icon: Icons.add_circle_outline,
                label: '+ Jogo',
                color: AppColors.cyan,
                onTap: () => context.go('/matches'),
              ),
              const SizedBox(width: 10),
              _ActionButton(
                icon: Icons.fitness_center_outlined,
                label: '+ Treino',
                color: AppColors.purple,
                onTap: () => context.go('/training'),
              ),
              const SizedBox(width: 10),
              _ActionButton(
                icon: Icons.description_outlined,
                label: 'Relatório',
                color: AppColors.success,
                onTap: () => context.go('/reports'),
              ),
              const SizedBox(width: 10),
              _ActionButton(
                icon: Icons.bar_chart_rounded,
                label: 'Dashboard',
                color: AppColors.warning,
                onTap: () => context.go('/dashboard'),
              ),
            ],
          ),
        ],
      ),
    ).animate().fade(delay: 200.ms, duration: 400.ms);
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: color.withOpacity(0.25),
              width: 1,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'Inter',
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
