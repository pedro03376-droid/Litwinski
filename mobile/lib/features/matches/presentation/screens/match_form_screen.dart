import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import 'package:gkhub/core/constants/app_constants.dart';
import '../../data/repositories/match_repository.dart';
import '../../../goalkeepers/data/repositories/goalkeeper_repository.dart';
import '../../../goalkeepers/domain/entities/goalkeeper.dart';

// ─── State ───────────────────────────────────────────────────────────────────

class _MatchFormState {
  final bool isSaving;
  final String? error;

  const _MatchFormState({this.isSaving = false, this.error});

  _MatchFormState copyWith({bool? isSaving, String? error, bool clearError = false}) =>
      _MatchFormState(
        isSaving: isSaving ?? this.isSaving,
        error: clearError ? null : (error ?? this.error),
      );
}

class _MatchFormNotifier extends StateNotifier<_MatchFormState> {
  final MatchRepository _repository;

  _MatchFormNotifier(this._repository) : super(const _MatchFormState());

  Future<bool> save(Map<String, dynamic> data) async {
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      await _repository.create(data);
      state = state.copyWith(isSaving: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        error: 'Erro ao salvar. Verifique os dados e tente novamente.',
      );
      return false;
    }
  }
}

final _matchFormProvider =
    StateNotifierProvider.autoDispose<_MatchFormNotifier, _MatchFormState>(
  (ref) => _MatchFormNotifier(ref.read(matchRepositoryProvider)),
);

final _goalkeepersProvider = FutureProvider.autoDispose<List<Goalkeeper>>((ref) {
  return ref.read(goalkeeperRepositoryProvider).getAll(isActive: true, perPage: 100);
});

// ─── Screen ──────────────────────────────────────────────────────────────────

class MatchFormScreen extends ConsumerStatefulWidget {
  const MatchFormScreen({super.key});

  @override
  ConsumerState<MatchFormScreen> createState() => _MatchFormScreenState();
}

class _MatchFormScreenState extends ConsumerState<MatchFormScreen> {
  final _formKey = GlobalKey<FormState>();

  final _competitionCtrl = TextEditingController();
  final _opponentCtrl = TextEditingController();
  final _venueCtrl = TextEditingController();
  final _observationsCtrl = TextEditingController();

  DateTime _date = DateTime.now();
  String _location = 'home';
  String? _category;
  String? _result;
  int _goalsScored = 0;
  int _goalsConceded = 0;
  String? _goalkeeperId;

  @override
  void dispose() {
    _competitionCtrl.dispose();
    _opponentCtrl.dispose();
    _venueCtrl.dispose();
    _observationsCtrl.dispose();
    super.dispose();
  }

  void _autoResult() {
    String? r;
    if (_goalsScored > _goalsConceded) r = 'win';
    else if (_goalsScored < _goalsConceded) r = 'loss';
    else r = 'draw';
    if (_result != r) setState(() => _result = r);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.dark(
            primary: AppColors.cyan,
            surface: AppColors.darkCard,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_goalkeeperId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Selecione a goleira'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final data = <String, dynamic>{
      'date': _date.toIso8601String().split('T').first,
      'competition': _competitionCtrl.text.trim(),
      'opponent': _opponentCtrl.text.trim(),
      'location': _location,
      'goalsScored': _goalsScored,
      'goalsConceded': _goalsConceded,
      'result': _result,
      'goalkeeperId': _goalkeeperId,
      if (_venueCtrl.text.trim().isNotEmpty) 'venue': _venueCtrl.text.trim(),
      if (_category != null) 'category': _category,
      if (_observationsCtrl.text.trim().isNotEmpty)
        'observations': _observationsCtrl.text.trim(),
    };

    final ok = await ref.read(_matchFormProvider.notifier).save(data);
    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Partida registrada com sucesso!'),
          backgroundColor: AppColors.success,
        ),
      );
      context.go('/matches');
    }
  }

  @override
  Widget build(BuildContext context) {
    final formState = ref.watch(_matchFormProvider);
    final goalkeepersAsync = ref.watch(_goalkeepersProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Nova Partida'),
        backgroundColor: AppColors.darkBackground,
        foregroundColor: AppColors.textPrimary,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new),
          onPressed: () => context.go('/matches'),
        ),
        actions: [
          if (formState.isSaving)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.cyan,
                ),
              ),
            )
          else
            TextButton(
              onPressed: _save,
              child: const Text(
                'Salvar',
                style: TextStyle(
                  color: AppColors.cyan,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (formState.error != null)
              _ErrorBanner(message: formState.error!)
                  .animate()
                  .fadeIn()
                  .slideY(begin: -0.2),

            // Goleira
            _SectionHeader(title: 'Goleira', icon: Icons.sports),
            const SizedBox(height: 12),
            goalkeepersAsync.when(
              loading: () => const _LoadingField(),
              error: (e, _) => _ErrorField(label: 'Goleira', message: e.toString()),
              data: (goalkeepers) => _DropdownField<String>(
                label: 'Goleira *',
                value: _goalkeeperId,
                hint: 'Selecione a goleira',
                items: goalkeepers
                    .map((g) => DropdownMenuItem(value: g.id, child: Text(g.name)))
                    .toList(),
                onChanged: (v) => setState(() => _goalkeeperId = v),
              ),
            ),
            const SizedBox(height: 24),

            // Data & Local
            _SectionHeader(title: 'Data e Local', icon: Icons.calendar_today),
            const SizedBox(height: 12),
            _DateField(
              date: _date,
              onTap: _pickDate,
            ),
            const SizedBox(height: 12),
            _LocationSelector(
              value: _location,
              onChanged: (v) => setState(() => _location = v),
            ),
            const SizedBox(height: 12),
            _TextField(
              controller: _venueCtrl,
              label: 'Ginásio / Estádio (opcional)',
              hint: 'Ex: Arena Morumbi',
              icon: Icons.stadium_outlined,
            ),
            const SizedBox(height: 24),

            // Partida
            _SectionHeader(title: 'Partida', icon: Icons.sports_soccer),
            const SizedBox(height: 12),
            _TextField(
              controller: _competitionCtrl,
              label: 'Campeonato / Competição *',
              hint: 'Ex: Campeonato Paulista Sub-17',
              icon: Icons.emoji_events_outlined,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Campo obrigatório' : null,
            ),
            const SizedBox(height: 12),
            _TextField(
              controller: _opponentCtrl,
              label: 'Adversário *',
              hint: 'Ex: Santos FC',
              icon: Icons.group_outlined,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Campo obrigatório' : null,
            ),
            const SizedBox(height: 12),
            _DropdownField<String>(
              label: 'Categoria',
              value: _category,
              hint: 'Selecione a categoria',
              items: const [
                DropdownMenuItem(value: 'adulto', child: Text('Adulto')),
                DropdownMenuItem(value: 'juvenil', child: Text('Juvenil')),
                DropdownMenuItem(value: 'infantojuvenil', child: Text('Infantojuvenil')),
                DropdownMenuItem(value: 'infantil', child: Text('Infantil')),
                DropdownMenuItem(value: 'sub17', child: Text('Sub-17')),
                DropdownMenuItem(value: 'sub15', child: Text('Sub-15')),
                DropdownMenuItem(value: 'sub13', child: Text('Sub-13')),
                DropdownMenuItem(value: 'sub11', child: Text('Sub-11')),
                DropdownMenuItem(value: 'sub09', child: Text('Sub-09')),
              ],
              onChanged: (v) => setState(() => _category = v),
            ),
            const SizedBox(height: 24),

            // Placar
            _SectionHeader(title: 'Placar', icon: Icons.scoreboard_outlined),
            const SizedBox(height: 12),
            _ScoreRow(
              goalsScored: _goalsScored,
              goalsConceded: _goalsConceded,
              onScoredChanged: (v) {
                setState(() => _goalsScored = v);
                _autoResult();
              },
              onConcededChanged: (v) {
                setState(() => _goalsConceded = v);
                _autoResult();
              },
            ),
            const SizedBox(height: 12),
            _ResultSelector(
              value: _result,
              onChanged: (v) => setState(() => _result = v),
            ),
            const SizedBox(height: 24),

            // Observações
            _SectionHeader(title: 'Observações', icon: Icons.notes_outlined),
            const SizedBox(height: 12),
            _TextField(
              controller: _observationsCtrl,
              label: 'Observações (opcional)',
              hint: 'Anotações sobre o desempenho, clima, condições do jogo...',
              icon: Icons.edit_note_outlined,
              maxLines: 4,
            ),
            const SizedBox(height: 32),

            // Botão salvar
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: formState.isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.cyan,
                  foregroundColor: Colors.black,
                  disabledBackgroundColor: AppColors.cyan.withOpacity(0.4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: formState.isSaving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.black,
                        ),
                      )
                    : const Text(
                        'Registrar Partida',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ).animate().fadeIn(delay: 200.ms),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ─── Widgets auxiliares ───────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  const _SectionHeader({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.cyan),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            color: AppColors.cyan,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Divider(color: AppColors.darkElevated, thickness: 1)),
      ],
    );
  }
}

class _TextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final int maxLines;
  final String? Function(String?)? validator;

  const _TextField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.maxLines = 1,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      validator: validator,
      style: const TextStyle(color: AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.textMuted, size: 20),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        hintStyle: const TextStyle(color: AppColors.textMuted),
        filled: true,
        fillColor: AppColors.darkCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.cyan, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  final String label;
  final T? value;
  final String hint;
  final List<DropdownMenuItem<T>> items;
  final void Function(T?) onChanged;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      value: value,
      hint: Text(hint, style: const TextStyle(color: AppColors.textMuted)),
      items: items,
      onChanged: onChanged,
      dropdownColor: AppColors.darkCard,
      style: const TextStyle(color: AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        filled: true,
        fillColor: AppColors.darkCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.cyan, width: 1.5),
        ),
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  final DateTime date;
  final VoidCallback onTap;

  const _DateField({required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined,
                color: AppColors.textMuted, size: 20),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Data da Partida *',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 2),
                Text(
                  DateFormat('dd/MM/yyyy').format(date),
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 16),
                ),
              ],
            ),
            const Spacer(),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _LocationSelector extends StatelessWidget {
  final String value;
  final void Function(String) onChanged;

  const _LocationSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final options = [
      ('home', 'Casa', Icons.home_outlined),
      ('away', 'Fora', Icons.flight_takeoff_outlined),
      ('neutral', 'Neutro', Icons.sports_outlined),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Local da Partida *',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        const SizedBox(height: 8),
        Row(
          children: options.map((opt) {
            final selected = value == opt.$1;
            return Expanded(
              child: GestureDetector(
                onTap: () => onChanged(opt.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.cyan.withOpacity(0.15) : AppColors.darkCard,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected ? AppColors.cyan : Colors.transparent,
                      width: 1.5,
                    ),
                  ),
                  child: Column(
                    children: [
                      Icon(opt.$3,
                          color: selected ? AppColors.cyan : AppColors.textMuted,
                          size: 20),
                      const SizedBox(height: 4),
                      Text(opt.$2,
                          style: TextStyle(
                            color: selected ? AppColors.cyan : AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                          )),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _ScoreRow extends StatelessWidget {
  final int goalsScored;
  final int goalsConceded;
  final void Function(int) onScoredChanged;
  final void Function(int) onConcededChanged;

  const _ScoreRow({
    required this.goalsScored,
    required this.goalsConceded,
    required this.onScoredChanged,
    required this.onConcededChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ScoreStepper(
              label: 'Gols Marcados',
              value: goalsScored,
              onChanged: onScoredChanged,
              color: AppColors.success,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'x',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Expanded(
            child: _ScoreStepper(
              label: 'Gols Sofridos',
              value: goalsConceded,
              onChanged: onConcededChanged,
              color: AppColors.error,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScoreStepper extends StatelessWidget {
  final String label;
  final int value;
  final void Function(int) onChanged;
  final Color color;

  const _ScoreStepper({
    required this.label,
    required this.value,
    required this.onChanged,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label,
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 11),
            textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _StepButton(
              icon: Icons.remove,
              onTap: value > 0 ? () => onChanged(value - 1) : null,
            ),
            const SizedBox(width: 12),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 150),
              transitionBuilder: (child, anim) =>
                  ScaleTransition(scale: anim, child: child),
              child: Text(
                '$value',
                key: ValueKey(value),
                style: TextStyle(
                  color: color,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 12),
            _StepButton(
              icon: Icons.add,
              onTap: () => onChanged(value + 1),
            ),
          ],
        ),
      ],
    );
  }
}

class _StepButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _StepButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: onTap != null ? AppColors.darkElevated : AppColors.darkElevated.withOpacity(0.4),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          color: onTap != null ? AppColors.textPrimary : AppColors.textMuted,
          size: 18,
        ),
      ),
    );
  }
}

class _ResultSelector extends StatelessWidget {
  final String? value;
  final void Function(String?) onChanged;

  const _ResultSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final options = [
      ('win', 'Vitória', AppColors.success),
      ('draw', 'Empate', AppColors.warning),
      ('loss', 'Derrota', AppColors.error),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Resultado',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        const SizedBox(height: 8),
        Row(
          children: options.map((opt) {
            final selected = value == opt.$1;
            return Expanded(
              child: GestureDetector(
                onTap: () => onChanged(opt.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? opt.$3.withOpacity(0.15) : AppColors.darkCard,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected ? opt.$3 : Colors.transparent,
                      width: 1.5,
                    ),
                  ),
                  child: Text(
                    opt.$2,
                    style: TextStyle(
                      color: selected ? opt.$3 : AppColors.textSecondary,
                      fontSize: 13,
                      fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.error.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 18),
          const SizedBox(width: 8),
          Expanded(
              child: Text(message,
                  style: const TextStyle(color: AppColors.error, fontSize: 13))),
        ],
      ),
    );
  }
}

class _LoadingField extends StatelessWidget {
  const _LoadingField();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.cyan),
        ),
      ),
    );
  }
}

class _ErrorField extends StatelessWidget {
  final String label;
  final String message;
  const _ErrorField({required this.label, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_outlined, color: AppColors.warning, size: 18),
          const SizedBox(width: 8),
          Text('Erro ao carregar goleiras',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
        ],
      ),
    );
  }
}
