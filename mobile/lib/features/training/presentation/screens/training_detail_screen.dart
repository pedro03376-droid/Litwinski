import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/constants/app_constants.dart';
import '../../domain/entities/training_session.dart';

final _trainingDetailProvider =
    FutureProvider.family<TrainingSession, String>((ref, id) async {
  final api = ref.read(apiClientProvider);
  final data = await api.get<Map<String, dynamic>>('/training/$id');
  return TrainingSession.fromJson(data);
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
    final categoryLabel = AppConstants.trainingCategoryLabels[session.category] ?? session.category;
    final intensityLabel = AppConstants.intensityLabels[session.intensity] ?? session.intensity;

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(title: Text(categoryLabel)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.darkCard,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(session.objective,
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                _Chip(label: categoryLabel, color: AppColors.cyan),
                _Chip(label: intensityLabel, color: _intensityColor(session.intensity)),
                if (session.durationMinutes != null)
                  _Chip(
                    label: '${session.durationMinutes} min',
                    color: AppColors.textSecondary,
                  ),
              ]),
              if (session.observations != null && session.observations!.isNotEmpty) ...[
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
      ),
    );
  }

  Color _intensityColor(String i) {
    switch (i) {
      case 'low': return AppColors.success;
      case 'medium': return AppColors.warning;
      case 'high': return AppColors.error;
      case 'max': return const Color(0xFFFF00FF);
      default: return AppColors.textMuted;
    }
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
