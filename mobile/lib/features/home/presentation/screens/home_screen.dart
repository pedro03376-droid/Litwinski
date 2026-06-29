import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:gkhub/main.dart' show RestartWidget;
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/error_widget.dart';
import '../../../../shared/widgets/gk_avatar.dart';
import '../../../../shared/widgets/loading_widget.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/stat_card.dart';
import '../../../goalkeepers/data/repositories/goalkeeper_repository.dart';
import '../../../matches/data/repositories/match_repository.dart';
import '../../../notifications/data/repositories/notifications_repository.dart';
import '../../../performance/data/repositories/performance_repository.dart';
import '../widgets/evolution_chart.dart';
import '../widgets/match_result_card.dart';

// ─── Notification providers ───────────────────────────────────────────────────

final _notificationsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.read(notificationsRepositoryProvider).getAll();
});

final _unreadCountProvider = FutureProvider<int>((ref) async {
  return ref.read(notificationsRepositoryProvider).getUnreadCount();
});

// ─── Domain models ────────────────────────────────────────────────────────────

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
    required this.teamName,
    required this.opponentName,
    required this.teamScore,
    required this.opponentScore,
    required this.saves,
    this.cleanSheet = false,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

String _dayLabel(String isoDate) {
  try {
    final d = DateTime.parse(isoDate);
    return _dayLabels[d.weekday % 7];
  } catch (_) {
    return '—';
  }
}

double _toPercent(dynamic v) =>
    ((double.tryParse(v?.toString() ?? '0') ?? 0) * 10).clamp(0, 100);

// ─── Providers ────────────────────────────────────────────────────────────────

/// First goalkeeper ID available in the team (used as context for all dashboard data).
final _firstGoalkeeperIdProvider = FutureProvider<String?>((ref) async {
  final list = await ref.read(goalkeeperRepositoryProvider).getAll(perPage: 1);
  return list.isEmpty ? null : list.first.id;
});

final homeSummaryProvider = FutureProvider<HomeSummary>((ref) async {
  final gkId = await ref.watch(_firstGoalkeeperIdProvider.future);
  if (gkId == null) {
    return const HomeSummary(
        gamesPlayed: 0, totalSaves: 0, savePercentage: 0, evolutionScore: 0);
  }

  final stats =
      await ref.read(goalkeeperRepositoryProvider).getStats(gkId);

  final gamesPlayed = (stats['totalMatches'] as num?)?.toInt() ?? 0;
  final totalSaves = (stats['totalSaves'] as num?)?.toInt() ??
      (stats['savesTotal'] as num?)?.toInt() ??
      0;
  final savePercentage =
      (stats['savePercentage'] as num?)?.toDouble() ??
          (stats['avgSavePercentage'] as num?)?.toDouble() ??
          0.0;
  final evolutionScore =
      (stats['avgOverallScore'] as num?)?.toDouble() ??
          (stats['overallScore'] as num?)?.toDouble() ??
          0.0;

  return HomeSummary(
    gamesPlayed: gamesPlayed,
    totalSaves: totalSaves,
    savePercentage: savePercentage,
    evolutionScore: evolutionScore,
  );
});

final recentMatchProvider = FutureProvider<RecentMatch?>((ref) async {
  final matches =
      await ref.read(matchRepositoryProvider).getAll(limit: 1, page: 1);
  if (matches.isEmpty) return null;
  final m = matches.first;

  final scout = await ref.read(matchRepositoryProvider).getScout(m.id);
  final saves = scout?.totalSaves ?? 0;

  return RecentMatch(
    date: m.date,
    competition: m.competition,
    teamName: 'Meu Time',
    opponentName: m.opponent,
    teamScore: m.goalsScored,
    opponentScore: m.goalsConceded,
    saves: saves,
    cleanSheet: m.isCleanSheet,
  );
});

final weeklyChartDataProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final gkId = await ref.watch(_firstGoalkeeperIdProvider.future);
  if (gkId == null) return [];

  final points =
      await ref.read(performanceRepositoryProvider).getEvolution(gkId, period: 'weekly');

  if (points.isEmpty) return [];

  return points.map((p) {
    final date = p['date']?.toString() ?? '';
    return <String, dynamic>{
      'label': _dayLabel(date),
      'overallScore': _toPercent(p['overallScore']),
      'reflexScore': _toPercent(p['reflexScore']),
      'highSaveScore': _toPercent(p['highSaveScore']),
    };
  }).toList();
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
            ref.invalidate(_firstGoalkeeperIdProvider);
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

// ─── Notification bell ────────────────────────────────────────────────────────

class _NotificationBell extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadAsync = ref.watch(_unreadCountProvider);
    final unread = unreadAsync.valueOrNull ?? 0;

    return IconButton(
      onPressed: () async {
        await showModalBottomSheet<void>(
          context: context,
          backgroundColor: AppColors.darkCard,
          isScrollControlled: true,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          builder: (_) => _NotificationsSheet(
            onAllRead: () {
              ref.invalidate(_notificationsProvider);
              ref.invalidate(_unreadCountProvider);
            },
          ),
        );
        ref.invalidate(_unreadCountProvider);
      },
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.notifications_outlined,
              color: AppColors.textSecondary, size: 26),
          if (unread > 0)
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                width: unread > 9 ? 16 : 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(6),
                ),
                alignment: Alignment.center,
                child: unread > 9
                    ? const Text('9+',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 7,
                            fontWeight: FontWeight.w800))
                    : null,
              ),
            ),
        ],
      ),
    );
  }
}

class _NotificationsSheet extends ConsumerWidget {
  final VoidCallback onAllRead;
  const _NotificationsSheet({required this.onAllRead});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_notificationsProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.3,
      maxChildSize: 0.88,
      expand: false,
      builder: (_, controller) => Column(children: [
        Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
              color: AppColors.textMuted,
              borderRadius: BorderRadius.circular(2)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 12, 12),
          child: Row(children: [
            const Expanded(
              child: Text('Notificações',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
            ),
            TextButton(
              onPressed: () async {
                await ref.read(notificationsRepositoryProvider).markAllAsRead();
                ref.invalidate(_notificationsProvider);
                onAllRead();
              },
              child: const Text('Marcar todas como lidas',
                  style: TextStyle(color: AppColors.cyan, fontSize: 12)),
            ),
          ]),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.cyan)),
            error: (_, __) => const Center(
                child: Text('Erro ao carregar',
                    style: TextStyle(color: AppColors.textMuted))),
            data: (notifications) {
              if (notifications.isEmpty) {
                return const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_none_outlined,
                          size: 48, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text('Nenhuma notificação',
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 15)),
                    ],
                  ),
                );
              }
              return ListView.separated(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                itemCount: notifications.length,
                separatorBuilder: (_, __) =>
                    const Divider(color: Color(0xFF2A2A45), height: 1),
                itemBuilder: (_, i) {
                  final n = notifications[i];
                  final isRead = n['isRead'] == true;
                  return ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    leading: Container(
                      width: 10,
                      height: 10,
                      margin: const EdgeInsets.only(top: 4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isRead
                            ? Colors.transparent
                            : AppColors.cyan,
                        border: isRead
                            ? Border.all(
                                color: AppColors.textMuted.withOpacity(0.3))
                            : null,
                      ),
                    ),
                    title: Text(
                      n['title'] ?? '',
                      style: TextStyle(
                        color: isRead
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight:
                            isRead ? FontWeight.w400 : FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      n['body'] ?? '',
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 12),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: isRead
                        ? null
                        : () async {
                            final id = n['id'] as String?;
                            if (id == null) return;
                            await ref
                                .read(notificationsRepositoryProvider)
                                .markAsRead(id);
                            ref.invalidate(_notificationsProvider);
                            onAllRead();
                          },
                  );
                },
              );
            },
          ),
        ),
      ]),
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
                const SizedBox(height: 8),
                const _TeamSelector(),
              ],
            ),
          ),

          // Notification bell
          _NotificationBell(),

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

// ─── Team / workspace selector ──────────────────────────────────────────────

class _TeamSelector extends ConsumerWidget {
  const _TeamSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspacesAsync = ref.watch(myWorkspacesProvider);
    final currentTeamId = ref.watch(
      authStateProvider.select((s) => s.user?['teamId'] as String?),
    );

    return workspacesAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (workspaces) {
        if (workspaces.isEmpty) return const SizedBox.shrink();
        final current = workspaces.firstWhere(
          (w) => w['teamId'] == currentTeamId,
          orElse: () => workspaces.first,
        );
        final name = (current['teamName'] as String?) ?? 'Meu clube';
        final canSwitch = workspaces.length > 1;

        return InkWell(
          onTap: canSwitch
              ? () => _openSheet(context, ref, workspaces, current['teamId'] as String?)
              : null,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.cyan.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.cyan.withOpacity(0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.shield_outlined, size: 14, color: AppColors.cyan),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    name,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.cyan,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (canSwitch) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.unfold_more, size: 14, color: AppColors.cyan),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  void _openSheet(
    BuildContext context,
    WidgetRef ref,
    List<Map<String, dynamic>> workspaces,
    String? currentTeamId,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.darkCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Trocar de clube / seleção',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            ...workspaces.map((w) {
              final isCurrent = w['teamId'] == currentTeamId;
              return ListTile(
                leading: Icon(
                  isCurrent ? Icons.shield : Icons.shield_outlined,
                  color: isCurrent ? AppColors.cyan : AppColors.textMuted,
                ),
                title: Text(
                  (w['teamName'] as String?) ?? 'Clube',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
                subtitle: Text(
                  _roleLabel(w['role'] as String?),
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
                trailing: isCurrent
                    ? const Icon(Icons.check_circle, color: AppColors.cyan, size: 20)
                    : null,
                onTap: isCurrent
                    ? null
                    : () => _switch(context, sheetCtx, ref, w['teamId'] as String),
              );
            }),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  String _roleLabel(String? role) {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'coach':
        return 'Comissão técnica';
      case 'viewer':
        return 'Visualização';
      default:
        return role ?? '';
    }
  }

  Future<void> _switch(
    BuildContext context,
    BuildContext sheetCtx,
    WidgetRef ref,
    String teamId,
  ) async {
    Navigator.pop(sheetCtx);
    // Show a brief loading barrier while we swap the token.
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(color: AppColors.cyan),
      ),
    );
    final ok = await ref.read(authStateProvider.notifier).switchTeam(teamId);
    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop(); // close loader
    if (ok) {
      // Recreate the ProviderScope so every screen reloads with the new scope.
      RestartWidget.restart(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível trocar de clube.')),
      );
    }
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
