import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../data/repositories/match_repository.dart';
import '../../domain/entities/match.dart';
import '../widgets/heatmap_widget.dart';
import '../../../../core/theme/app_theme.dart';

final _matchDetailProvider =
    FutureProvider.family<GKMatch, String>((ref, id) async {
  return ref.read(matchRepositoryProvider).getById(id);
});

class MatchDetailScreen extends ConsumerWidget {
  final String id;
  const MatchDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchAsync = ref.watch(_matchDetailProvider(id));

    return matchAsync.when(
      loading: () => const Scaffold(
        backgroundColor: AppColors.darkBackground,
        body: Center(child: CircularProgressIndicator(color: AppColors.cyan)),
      ),
      error: (e, _) => Scaffold(
        body: Center(child: Text('Erro: $e')),
      ),
      data: (match) => _MatchDetailView(match: match),
    );
  }
}

class _MatchDetailView extends StatelessWidget {
  final GKMatch match;
  const _MatchDetailView({required this.match});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: AppColors.darkBackground,
        body: NestedScrollView(
          headerSliverBuilder: (_, __) => [
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: AppColors.darkBackground,
              flexibleSpace: FlexibleSpaceBar(
                background: _MatchHeader(match: match),
              ),
              bottom: const TabBar(
                indicatorColor: AppColors.cyan,
                labelColor: AppColors.cyan,
                unselectedLabelColor: AppColors.textMuted,
                tabs: [
                  Tab(text: 'Resumo'),
                  Tab(text: 'Scout'),
                  Tab(text: 'Heatmap'),
                  Tab(text: 'IA'),
                ],
              ),
            ),
          ],
          body: TabBarView(
            children: [
              _SummaryTab(match: match),
              _ScoutTab(scout: match.scout),
              _HeatmapTab(scout: match.scout),
              _AiTab(matchId: match.id),
            ],
          ),
        ),
      ),
    );
  }
}

class _MatchHeader extends StatelessWidget {
  final GKMatch match;
  const _MatchHeader({required this.match});

  @override
  Widget build(BuildContext context) {
    Color resultColor;
    String resultLabel;
    switch (match.result) {
      case 'win':
        resultColor = AppColors.success;
        resultLabel = 'VITÓRIA';
        break;
      case 'draw':
        resultColor = AppColors.warning;
        resultLabel = 'EMPATE';
        break;
      case 'loss':
        resultColor = AppColors.error;
        resultLabel = 'DERROTA';
        break;
      default:
        resultColor = AppColors.textMuted;
        resultLabel = '-';
    }

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            resultColor.withOpacity(0.3),
            AppColors.darkBackground,
          ],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 56, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(match.competition,
                  style: Theme.of(context)
                      .textTheme
                      .labelMedium
                      ?.copyWith(color: AppColors.textMuted)),
              const SizedBox(height: 6),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Expanded(
                  child: Text('Minha Equipe',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  decoration: BoxDecoration(
                    color: resultColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: resultColor.withOpacity(0.4)),
                  ),
                  child: Column(children: [
                    Text(
                      '${match.goalsScored} × ${match.goalsConceded}',
                      style: Theme.of(context)
                          .textTheme
                          .headlineLarge
                          ?.copyWith(color: resultColor, fontWeight: FontWeight.w900),
                    ),
                    Text(resultLabel,
                        style: TextStyle(
                            color: resultColor,
                            fontSize: 10,
                            fontWeight: FontWeight.w700)),
                  ]),
                ),
                Expanded(
                  child: Text(match.opponent,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge),
                ),
              ]),
              const SizedBox(height: 8),
              Text(
                DateFormat('dd/MM/yyyy').format(match.date),
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryTab extends StatelessWidget {
  final GKMatch match;
  const _SummaryTab({required this.match});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _InfoCard(items: [
          ('Campeonato', match.competition),
          ('Adversário', match.opponent),
          ('Local', match.location == 'home' ? 'Casa' : match.location == 'away' ? 'Fora' : 'Neutro'),
          if (match.venue != null) ('Ginásio', match.venue!),
          if (match.category != null) ('Categoria', match.category!),
        ]),
        if (match.scout != null) ...[
          const SizedBox(height: 16),
          _StatRow(label: 'Defesas Totais', value: '${match.scout!.totalSaves}'),
          _StatRow(
              label: 'Taxa de Defesas',
              value: '${match.scout!.savePercentage.toStringAsFixed(1)}%'),
          _StatRow(
              label: 'Interceptações', value: '${match.scout!.interceptions}'),
        ],
        if (match.observations != null) ...[
          const SizedBox(height: 16),
          Text('Observações',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Text(match.observations!,
              style: Theme.of(context).textTheme.bodyMedium),
        ],
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<(String, String)> items;
  const _InfoCard({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: items
            .map((item) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(children: [
                    Text(item.$1,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: AppColors.textMuted)),
                    const Spacer(),
                    Text(item.$2,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            )),
                  ]),
                ))
            .toList(),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;
  const _StatRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text(label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.textSecondary)),
        const Spacer(),
        Text(value,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(color: AppColors.cyan)),
      ]),
    );
  }
}

class _ScoutTab extends StatelessWidget {
  final MatchScout? scout;
  const _ScoutTab({this.scout});

  @override
  Widget build(BuildContext context) {
    if (scout == null) {
      return const Center(
        child: Text('Scout não registrado para esta partida.',
            style: TextStyle(color: AppColors.textMuted)),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ScoutSection(title: 'DEFESAS', items: [
          ('Alta – Direita', scout!.highSaveRight),
          ('Alta – Esquerda', scout!.highSaveLeft),
          ('Baixa – Direita', scout!.lowSaveRight),
          ('Baixa – Esquerda', scout!.lowSaveLeft),
          ('Central', scout!.centralSave),
        ]),
        _ScoutSection(title: 'DISTRIBUIÇÃO', items: [
          ('Pé Certo', scout!.launchRightFoot),
          ('Pé Errado', scout!.launchLeftFoot),
          ('Mão Certa', scout!.launchRightHand),
        ]),
        _ScoutSection(title: 'AÇÕES DEFENSIVAS', items: [
          ('Interceptação', scout!.interceptions),
          ('Esquadro', scout!.clearances),
        ]),
        _ScoutSection(title: 'POSICIONAMENTO', items: [
          ('Base Esquerda', scout!.positionBaseLeft),
          ('Base Direita', scout!.positionBaseRight),
        ]),
        _ScoutSection(title: 'GOLS SOFRIDOS', items: [
          ('Fora da Área', scout!.goalOutsideArea),
          ('Dentro da Área', scout!.goalInsideArea),
        ], accent: AppColors.error),
      ],
    );
  }
}

class _ScoutSection extends StatelessWidget {
  final String title;
  final List<(String, int)> items;
  final Color accent;
  const _ScoutSection({
    required this.title,
    required this.items,
    this.accent = AppColors.cyan,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: accent,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w700,
                )),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.darkCard,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: items
                .map((item) => Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(children: [
                        Text(item.$1,
                            style: Theme.of(context).textTheme.bodyMedium),
                        const Spacer(),
                        Container(
                          width: 40,
                          height: 28,
                          decoration: BoxDecoration(
                            color: accent.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          alignment: Alignment.center,
                          child: Text('${item.$2}',
                              style: TextStyle(
                                  color: accent,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15)),
                        ),
                      ]),
                    ))
                .toList(),
          ),
        ),
      ]),
    );
  }
}

class _HeatmapTab extends StatelessWidget {
  final MatchScout? scout;
  const _HeatmapTab({this.scout});

  @override
  Widget build(BuildContext context) {
    final points = HeatmapWidget.fromMatchScoutJson(scout?.heatmapData);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Text('Mapa de Calor',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        HeatmapWidget(points: points),
        if (points.isEmpty) ...[
          const SizedBox(height: 24),
          const Text(
            'Nenhum dado de heatmap registrado para esta partida.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted),
          ),
        ],
      ]),
    );
  }
}

class _AiTab extends StatelessWidget {
  final String matchId;
  const _AiTab({required this.matchId});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('Análise de IA será exibida aqui após o processamento.',
          style: TextStyle(color: AppColors.textMuted),
          textAlign: TextAlign.center),
    );
  }
}
