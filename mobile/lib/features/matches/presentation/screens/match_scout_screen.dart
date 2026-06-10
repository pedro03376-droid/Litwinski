import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/repositories/match_repository.dart';
import '../../domain/entities/match.dart';
import '../../../../core/theme/app_theme.dart';

class _ScoutState {
  final Map<String, int> counts;
  const _ScoutState(this.counts);

  _ScoutState copyWith(String key, int value) {
    final next = Map<String, int>.from(counts);
    next[key] = value;
    return _ScoutState(next);
  }

  int get(String key) => counts[key] ?? 0;
}

final _scoutStateProvider =
    StateNotifierProvider<_ScoutNotifier, _ScoutState>((ref) {
  return _ScoutNotifier();
});

class _ScoutNotifier extends StateNotifier<_ScoutState> {
  _ScoutNotifier()
      : super(_ScoutState(const {
          'highSaveRight': 0,
          'highSaveLeft': 0,
          'lowSaveRight': 0,
          'lowSaveLeft': 0,
          'centralSave': 0,
          'launchRightFoot': 0,
          'launchLeftFoot': 0,
          'launchRightHand': 0,
          'interceptions': 0,
          'clearances': 0,
          'positionBaseLeft': 0,
          'positionBaseRight': 0,
          'goalOutsideArea': 0,
          'goalInsideArea': 0,
        }));

  void increment(String key) =>
      state = state.copyWith(key, state.get(key) + 1);

  void decrement(String key) {
    final v = state.get(key);
    if (v > 0) state = state.copyWith(key, v - 1);
  }

  void loadFromScout(MatchScout scout) {
    state = _ScoutState({
      'highSaveRight': scout.highSaveRight,
      'highSaveLeft': scout.highSaveLeft,
      'lowSaveRight': scout.lowSaveRight,
      'lowSaveLeft': scout.lowSaveLeft,
      'centralSave': scout.centralSave,
      'launchRightFoot': scout.launchRightFoot,
      'launchLeftFoot': scout.launchLeftFoot,
      'launchRightHand': scout.launchRightHand,
      'interceptions': scout.interceptions,
      'clearances': scout.clearances,
      'positionBaseLeft': scout.positionBaseLeft,
      'positionBaseRight': scout.positionBaseRight,
      'goalOutsideArea': scout.goalOutsideArea,
      'goalInsideArea': scout.goalInsideArea,
    });
  }
}

class MatchScoutScreen extends ConsumerStatefulWidget {
  final String matchId;
  const MatchScoutScreen({super.key, required this.matchId});

  @override
  ConsumerState<MatchScoutScreen> createState() => _MatchScoutScreenState();
}

class _MatchScoutScreenState extends ConsumerState<MatchScoutScreen> {
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final counts = ref.read(_scoutStateProvider).counts;
      await ref.read(matchRepositoryProvider).saveScout(widget.matchId, counts);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Scout salvo com sucesso!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao salvar: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scoutState = ref.watch(_scoutStateProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Scout de Jogo'),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: AppColors.cyan)),
            )
          else
            TextButton(
              onPressed: _save,
              child: const Text('Salvar',
                  style: TextStyle(
                      color: AppColors.cyan, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        children: [
          _ScoutSection(
            title: 'DEFESAS',
            color: AppColors.cyan,
            items: [
              ('Alta – Direita', 'highSaveRight'),
              ('Alta – Esquerda', 'highSaveLeft'),
              ('Baixa – Direita', 'lowSaveRight'),
              ('Baixa – Esquerda', 'lowSaveLeft'),
              ('Central', 'centralSave'),
            ],
            state: scoutState,
          ),
          _ScoutSection(
            title: 'DISTRIBUIÇÃO',
            color: AppColors.purple,
            items: [
              ('Pé Certo', 'launchRightFoot'),
              ('Pé Errado', 'launchLeftFoot'),
              ('Mão Certa', 'launchRightHand'),
            ],
            state: scoutState,
          ),
          _ScoutSection(
            title: 'AÇÕES DEFENSIVAS',
            color: AppColors.success,
            items: [
              ('Interceptação', 'interceptions'),
              ('Esquadro', 'clearances'),
            ],
            state: scoutState,
          ),
          _ScoutSection(
            title: 'POSICIONAMENTO',
            color: AppColors.warning,
            items: [
              ('Base Esquerda', 'positionBaseLeft'),
              ('Base Direita', 'positionBaseRight'),
            ],
            state: scoutState,
          ),
          _ScoutSection(
            title: 'GOLS SOFRIDOS',
            color: AppColors.error,
            items: [
              ('Fora da Área', 'goalOutsideArea'),
              ('Dentro da Área', 'goalInsideArea'),
            ],
            state: scoutState,
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.black))
                : const Text('Salvar Scout'),
          ),
        ),
      ),
    );
  }
}

class _ScoutSection extends ConsumerWidget {
  final String title;
  final Color color;
  final List<(String, String)> items;
  final _ScoutState state;

  const _ScoutSection({
    required this.title,
    required this.color,
    required this.items,
    required this.state,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(title,
              style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  fontSize: 12)),
        ),
        Container(
          decoration: BoxDecoration(
              color: AppColors.darkCard,
              borderRadius: BorderRadius.circular(14)),
          child: Column(
            children: items.map((item) {
              final (label, key) = item;
              final value = state.get(key);
              return Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(children: [
                  Expanded(
                      child: Text(label,
                          style: Theme.of(context).textTheme.bodyLarge)),
                  _Counter(
                    value: value,
                    color: color,
                    onDecrement: () =>
                        ref.read(_scoutStateProvider.notifier).decrement(key),
                    onIncrement: () =>
                        ref.read(_scoutStateProvider.notifier).increment(key),
                  ),
                ]),
              );
            }).toList(),
          ),
        ),
      ]),
    );
  }
}

class _Counter extends StatelessWidget {
  final int value;
  final Color color;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  const _Counter({
    required this.value,
    required this.color,
    required this.onDecrement,
    required this.onIncrement,
  });

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      GestureDetector(
        onTap: onDecrement,
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.darkElevated,
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.remove, size: 18, color: AppColors.textSecondary),
        ),
      ),
      SizedBox(
        width: 48,
        child: Text(
          '$value',
          textAlign: TextAlign.center,
          style: TextStyle(
              color: color, fontWeight: FontWeight.w800, fontSize: 22),
        ),
      ),
      GestureDetector(
        onTap: onIncrement,
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Icon(Icons.add, size: 18, color: color),
        ),
      ),
    ]);
  }
}
