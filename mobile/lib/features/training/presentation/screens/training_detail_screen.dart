import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/constants/app_constants.dart';
import '../../data/repositories/training_repository.dart';
import '../../domain/entities/training_session.dart';
import '../../../ai_analysis/data/repositories/ai_analysis_repository.dart';

final _trainingDetailProvider =
    FutureProvider.family<TrainingSession, String>((ref, id) async {
  return ref.read(trainingRepositoryProvider).getById(id);
});

class TrainingDetailScreen extends ConsumerWidget {
  final String id;
  const TrainingDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_trainingDetailProvider(id));

    return async.when(
      loading: () => const Scaffold(
        backgroundColor: AppColors.darkBackground,
        body: Center(child: CircularProgressIndicator(color: AppColors.cyan)),
      ),
      error: (e, _) => Scaffold(body: Center(child: Text('Erro: $e'))),
      data: (session) => _TrainingDetailView(session: session),
    );
  }
}

class _TrainingDetailView extends StatelessWidget {
  final TrainingSession session;
  const _TrainingDetailView({required this.session});

  @override
  Widget build(BuildContext context) {
    final categoryLabel =
        AppConstants.trainingCategoryLabels[session.category] ??
            session.category;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.darkBackground,
        appBar: AppBar(
          title: Text(categoryLabel),
          bottom: const TabBar(
            indicatorColor: AppColors.cyan,
            labelColor: AppColors.cyan,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              Tab(text: 'Exercícios'),
              Tab(text: 'IA'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ExercisesTab(session: session),
            _TrainingAiTab(session: session),
          ],
        ),
      ),
    );
  }
}

class _ExercisesTab extends StatelessWidget {
  final TrainingSession session;
  const _ExercisesTab({required this.session});

  @override
  Widget build(BuildContext context) {
    final categoryLabel =
        AppConstants.trainingCategoryLabels[session.category] ??
            session.category;
    final intensityLabel =
        AppConstants.intensityLabels[session.intensity] ?? session.intensity;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.darkCard,
            borderRadius: BorderRadius.circular(16),
          ),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(session.objective,
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _Chip(label: categoryLabel, color: AppColors.cyan),
              _Chip(
                  label: intensityLabel,
                  color: _intensityColor(session.intensity)),
              if (session.durationMinutes != null)
                _Chip(
                  label: '${session.durationMinutes} min',
                  color: AppColors.textSecondary,
                ),
            ]),
            if (session.observations != null &&
                session.observations!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(session.observations!,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppColors.textSecondary)),
            ],
          ]),
        ),
        const SizedBox(height: 20),
        if (session.exercises.isNotEmpty) ...[
          Text('Exercícios (${session.exercises.length})',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          ...session.exercises.map((ex) => _ExerciseDetailCard(exercise: ex)),
        ] else
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text('Nenhum exercício registrado.',
                  style: TextStyle(color: AppColors.textMuted)),
            ),
          ),
      ],
    );
  }

  Color _intensityColor(String i) {
    switch (i) {
      case 'low':
        return AppColors.success;
      case 'medium':
        return AppColors.warning;
      case 'high':
        return AppColors.error;
      case 'max':
        return const Color(0xFFFF00FF);
      default:
        return AppColors.textMuted;
    }
  }
}

// ── AI Analysis tab ─────────────────────────────────────────────────────────

final _trainingAiProvider =
    FutureProvider.family<List<AiAnalysis>, String>((ref, sessionId) {
  return ref.read(aiAnalysisRepositoryProvider).getForTraining(sessionId);
});

class _TrainingAiTab extends ConsumerStatefulWidget {
  final TrainingSession session;
  const _TrainingAiTab({required this.session});

  @override
  ConsumerState<_TrainingAiTab> createState() => _TrainingAiTabState();
}

class _TrainingAiTabState extends ConsumerState<_TrainingAiTab> {
  bool _generating = false;
  String? _error;

  Future<void> _generate() async {
    final session = widget.session;
    setState(() {
      _generating = true;
      _error = null;
    });

    try {
      final exercises = session.exercises;
      final totalExercises = exercises.length;
      final successRates = exercises
          .where((e) => e.result?.successPercentage != null)
          .map((e) => e.result!.successPercentage!)
          .toList();
      final avgSuccess = successRates.isEmpty
          ? 0.0
          : successRates.reduce((a, b) => a + b) / successRates.length;
      final reactionTimes = exercises
          .where((e) => e.result?.reactionTimeSeconds != null)
          .map((e) => e.result!.reactionTimeSeconds!)
          .toList();
      final avgReaction = reactionTimes.isEmpty
          ? 0.0
          : reactionTimes.reduce((a, b) => a + b) / reactionTimes.length;

      final categoryBreakdown = <String, int>{
        session.category: totalExercises,
      };

      await ref.read(aiAnalysisRepositoryProvider).generateForTraining(
        goalkeeperId: session.goalkeeperId,
        trainingSessionId: session.id,
        metrics: {
          'totalExercises': totalExercises,
          'successRate': avgSuccess,
          'avgReactionTime': avgReaction,
          'categoryBreakdown': categoryBreakdown,
        },
      );
      ref.invalidate(_trainingAiProvider(session.id));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_trainingAiProvider(widget.session.id));

    return async.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.cyan)),
      error: (e, _) => Center(
        child: Text('Erro: $e', style: const TextStyle(color: AppColors.error)),
      ),
      data: (analyses) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (analyses.isEmpty) ...[
            const SizedBox(height: 32),
            const Icon(Icons.psychology_outlined,
                size: 64, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'Nenhuma análise de IA ainda.',
              textAlign: TextAlign.center,
              style:
                  TextStyle(color: AppColors.textSecondary, fontSize: 16),
            ),
            const SizedBox(height: 8),
            const Text(
              'Gere uma análise para receber insights sobre o desempenho neste treino.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 13),
            ),
          ] else ...[
            ...analyses.map((a) => _TrainingAnalysisCard(analysis: a)),
          ],
          const SizedBox(height: 16),
          if (_error != null) ...[
            Text(_error!,
                style: const TextStyle(color: AppColors.error, fontSize: 12),
                textAlign: TextAlign.center),
            const SizedBox(height: 8),
          ],
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _generating ? null : _generate,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.cyan,
                foregroundColor: AppColors.darkBackground,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              icon: _generating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.darkBackground),
                    )
                  : const Icon(Icons.auto_awesome, size: 18),
              label: Text(
                analyses.isEmpty
                    ? 'Gerar Análise IA'
                    : 'Gerar Nova Análise',
                style:
                    const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TrainingAnalysisCard extends StatelessWidget {
  final AiAnalysis analysis;
  const _TrainingAnalysisCard({required this.analysis});

  @override
  Widget build(BuildContext context) {
    final score = analysis.overallScore;
    final scoreColor = score == null
        ? AppColors.textMuted
        : score >= 8
            ? AppColors.success
            : score >= 6
                ? AppColors.warning
                : AppColors.error;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cyan.withOpacity(0.15)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.psychology, color: AppColors.cyan, size: 18),
          const SizedBox(width: 8),
          Text('Análise IA',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.cyan,
                    fontWeight: FontWeight.w700,
                  )),
          const Spacer(),
          if (score != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: scoreColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                score.toStringAsFixed(1),
                style: TextStyle(
                    color: scoreColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 15),
              ),
            ),
        ]),
        Text(
          DateFormat('dd/MM/yyyy HH:mm').format(analysis.createdAt.toLocal()),
          style:
              const TextStyle(color: AppColors.textMuted, fontSize: 11),
        ),
        if (analysis.strengths.isNotEmpty) ...[
          const SizedBox(height: 14),
          _AiSection(
              title: 'Pontos Fortes',
              items: analysis.strengths,
              icon: Icons.thumb_up_outlined,
              color: AppColors.success),
        ],
        if (analysis.attentionPoints.isNotEmpty) ...[
          const SizedBox(height: 12),
          _AiSection(
              title: 'Pontos de Atenção',
              items: analysis.attentionPoints,
              icon: Icons.warning_amber_outlined,
              color: AppColors.warning),
        ],
        if (analysis.trainingSuggestions.isNotEmpty) ...[
          const SizedBox(height: 12),
          _AiSection(
              title: 'Sugestões',
              items: analysis.trainingSuggestions,
              icon: Icons.fitness_center,
              color: const Color(0xFFBB86FC)),
        ],
      ]),
    );
  }
}

class _AiSection extends StatelessWidget {
  final String title;
  final List<String> items;
  final IconData icon;
  final Color color;
  const _AiSection(
      {required this.title,
      required this.items,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 6),
        Text(title.toUpperCase(),
            style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.1)),
      ]),
      const SizedBox(height: 8),
      ...items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 5,
                  height: 5,
                  margin: const EdgeInsets.only(top: 6, right: 8),
                  decoration:
                      BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                Expanded(
                  child: Text(item,
                      style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                          height: 1.4)),
                ),
              ],
            ),
          )),
    ]);
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _ExerciseDetailCard extends StatelessWidget {
  final Exercise exercise;
  const _ExerciseDetailCard({required this.exercise});

  @override
  Widget build(BuildContext context) {
    final result = exercise.result;
    final successPct = result?.successPercentage;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(exercise.name,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
          ),
          if (exercise.sets != null || exercise.repetitions != null)
            Text(
              [
                if (exercise.sets != null) '${exercise.sets}x',
                if (exercise.repetitions != null) '${exercise.repetitions} rep',
              ].join(' '),
              style: const TextStyle(
                  color: AppColors.cyan, fontWeight: FontWeight.w600),
            ),
        ]),
        if (exercise.objective != null) ...[
          const SizedBox(height: 4),
          Text(exercise.objective!,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textMuted)),
        ],
        if (result != null) ...[
          const SizedBox(height: 14),
          Row(children: [
            _ResultStat(label: 'Tentativas', value: '${result.attempts}', color: AppColors.textSecondary),
            const SizedBox(width: 16),
            _ResultStat(label: 'Acertos', value: '${result.successes}', color: AppColors.success),
            const SizedBox(width: 16),
            _ResultStat(label: 'Erros', value: '${result.errors}', color: AppColors.error),
            const Spacer(),
            if (successPct != null)
              _CircularScore(pct: successPct),
          ]),
          if (result.reactionTimeSeconds != null) ...[
            const SizedBox(height: 8),
            Text(
              'Tempo de reação: ${result.reactionTimeSeconds!.toStringAsFixed(3)}s',
              style: const TextStyle(
                  color: AppColors.warning, fontSize: 12),
            ),
          ],
        ],
      ]),
    );
  }
}

class _ResultStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _ResultStat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value,
          style: TextStyle(
              color: color, fontWeight: FontWeight.w800, fontSize: 20)),
      Text(label,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
    ]);
  }
}

class _CircularScore extends StatelessWidget {
  final double pct;
  const _CircularScore({required this.pct});

  @override
  Widget build(BuildContext context) {
    final color = pct >= 80
        ? AppColors.success
        : pct >= 60
            ? AppColors.warning
            : AppColors.error;
    return SizedBox(
      width: 48,
      height: 48,
      child: Stack(alignment: Alignment.center, children: [
        CircularProgressIndicator(
          value: pct / 100,
          strokeWidth: 4,
          backgroundColor: AppColors.darkElevated,
          valueColor: AlwaysStoppedAnimation(color),
        ),
        Text('${pct.toStringAsFixed(0)}%',
            style: TextStyle(
                color: color, fontSize: 10, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
