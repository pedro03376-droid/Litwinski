import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import 'package:gkhub/features/goalkeepers/data/repositories/goalkeeper_repository.dart';
import 'package:gkhub/features/goalkeepers/domain/entities/goalkeeper.dart';
import 'package:gkhub/features/training/data/repositories/training_repository.dart';
import 'package:gkhub/features/training/presentation/widgets/training_card.dart';
import 'package:intl/intl.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _trainingFormProvider =
    StateNotifierProvider.autoDispose<_TrainingFormNotifier, _TrainingFormState>(
  (ref) => _TrainingFormNotifier(ref.read(trainingRepositoryProvider)),
);

final _activeGoalkeepersProvider =
    FutureProvider.autoDispose<List<Goalkeeper>>((ref) async {
  return ref.read(goalkeeperRepositoryProvider).getAll(isActive: true, perPage: 100);
});

class _TrainingFormState {
  final bool isLoading;
  final String? error;
  final bool success;

  const _TrainingFormState({
    this.isLoading = false,
    this.error,
    this.success = false,
  });

  _TrainingFormState copyWith({bool? isLoading, String? error, bool? success}) {
    return _TrainingFormState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      success: success ?? this.success,
    );
  }
}

class _TrainingFormNotifier extends StateNotifier<_TrainingFormState> {
  final TrainingRepository _repo;

  _TrainingFormNotifier(this._repo) : super(const _TrainingFormState());

  Future<void> save(Map<String, dynamic> data) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repo.create(data);
      state = state.copyWith(isLoading: false, success: true);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class TrainingFormScreen extends ConsumerStatefulWidget {
  const TrainingFormScreen({super.key});

  @override
  ConsumerState<TrainingFormScreen> createState() => _TrainingFormScreenState();
}

class _TrainingFormScreenState extends ConsumerState<TrainingFormScreen> {
  final _formKey = GlobalKey<FormState>();

  // Form fields
  String? _selectedGoalkeeperId;
  DateTime _date = DateTime.now();
  String _category = 'Reflexo';
  TrainingIntensity _intensity = TrainingIntensity.media;
  int _durationMinutes = 60;
  final _objectiveCtrl = TextEditingController();
  final _observationsCtrl = TextEditingController();
  final _seasonCtrl = TextEditingController();

  static const _categories = [
    'Reflexo',
    'Defesa Alta',
    'Defesa Baixa',
    'Posicionamento',
    'Saída',
    'Interceptação',
    'Jogo com os Pés',
    'Distribuição',
    'Decisão',
  ];

  @override
  void dispose() {
    _objectiveCtrl.dispose();
    _observationsCtrl.dispose();
    _seasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 7)),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.cyan,
            onPrimary: Colors.black,
            surface: AppColors.darkCard,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedGoalkeeperId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione um goleiro')),
      );
      return;
    }

    final data = {
      'goalkeeperId': _selectedGoalkeeperId,
      'date': DateFormat('yyyy-MM-dd').format(_date),
      'category': _category,
      'intensity': _intensity.name,
      'durationMinutes': _durationMinutes,
      'objective': _objectiveCtrl.text.trim(),
      if (_observationsCtrl.text.trim().isNotEmpty)
        'observations': _observationsCtrl.text.trim(),
      if (_seasonCtrl.text.trim().isNotEmpty)
        'season': _seasonCtrl.text.trim(),
    };

    ref.read(_trainingFormProvider.notifier).save(data);
  }

  @override
  Widget build(BuildContext context) {
    final formState = ref.watch(_trainingFormProvider);
    final goalkeepersAsync = ref.watch(_activeGoalkeepersProvider);

    // Navigate away on success
    ref.listen(_trainingFormProvider, (_, next) {
      if (next.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Treino registrado com sucesso!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.go('/training');
      }
    });

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Novo Treino'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/training'),
        ),
        actions: [
          if (formState.isLoading)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.cyan,
                  ),
                ),
              ),
            )
          else
            TextButton(
              onPressed: _submit,
              child: const Text(
                'Salvar',
                style: TextStyle(
                  color: AppColors.cyan,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
          children: [
            if (formState.error != null)
              _ErrorBanner(message: formState.error!),

            // Goalkeeper picker
            _SectionLabel('Goleiro *'),
            goalkeepersAsync.when(
              loading: () => const _SkeletonField(),
              error: (e, _) => _ErrorField(message: 'Erro ao carregar goleiros'),
              data: (goalkeepers) => _GoalkeeperDropdown(
                goalkeepers: goalkeepers,
                selected: _selectedGoalkeeperId,
                onChanged: (v) => setState(() => _selectedGoalkeeperId = v),
              ),
            ),
            const SizedBox(height: 16),

            // Date picker
            _SectionLabel('Data *'),
            _DatePickerField(date: _date, onTap: _pickDate),
            const SizedBox(height: 16),

            // Category
            _SectionLabel('Categoria *'),
            _CategoryGrid(
              categories: _categories,
              selected: _category,
              onSelect: (c) => setState(() => _category = c),
            ),
            const SizedBox(height: 16),

            // Intensity
            _SectionLabel('Intensidade *'),
            _IntensitySelector(
              selected: _intensity,
              onSelect: (i) => setState(() => _intensity = i),
            ),
            const SizedBox(height: 16),

            // Duration stepper
            _SectionLabel('Duração (minutos) *'),
            _DurationStepper(
              value: _durationMinutes,
              onChanged: (v) => setState(() => _durationMinutes = v),
            ),
            const SizedBox(height: 16),

            // Objective
            _SectionLabel('Objetivo *'),
            _StyledTextField(
              controller: _objectiveCtrl,
              hintText: 'Descreva o objetivo do treino',
              maxLines: 3,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Campo obrigatório' : null,
            ),
            const SizedBox(height: 16),

            // Season (optional)
            _SectionLabel('Temporada'),
            _StyledTextField(
              controller: _seasonCtrl,
              hintText: 'Ex: 2026/1',
            ),
            const SizedBox(height: 16),

            // Observations (optional)
            _SectionLabel('Observações'),
            _StyledTextField(
              controller: _observationsCtrl,
              hintText: 'Notas adicionais sobre o treino',
              maxLines: 3,
            ),
            const SizedBox(height: 32),

            // Submit button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: formState.isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.cyan,
                  foregroundColor: Colors.black,
                  disabledBackgroundColor: AppColors.cyan.withOpacity(0.4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: formState.isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.black,
                        ),
                      )
                    : const Text(
                        'Registrar Treino',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sub-widgets
// ---------------------------------------------------------------------------

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
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
            child: Text(
              message,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorField extends StatelessWidget {
  final String message;
  const _ErrorField({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withOpacity(0.4)),
      ),
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Text(message, style: const TextStyle(color: AppColors.error, fontSize: 13)),
    );
  }
}

class _SkeletonField extends StatelessWidget {
  const _SkeletonField();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }
}

class _GoalkeeperDropdown extends StatelessWidget {
  final List<Goalkeeper> goalkeepers;
  final String? selected;
  final ValueChanged<String?> onChanged;

  const _GoalkeeperDropdown({
    required this.goalkeepers,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.textMuted.withOpacity(0.2)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: selected,
          isExpanded: true,
          dropdownColor: AppColors.darkElevated,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          borderRadius: BorderRadius.circular(12),
          hint: const Text(
            'Selecione um goleiro',
            style: TextStyle(color: AppColors.textMuted, fontSize: 14),
          ),
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
          icon: const Icon(Icons.expand_more, color: AppColors.textSecondary),
          items: goalkeepers
              .map((g) => DropdownMenuItem(
                    value: g.id,
                    child: Text(g.name),
                  ))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _DatePickerField extends StatelessWidget {
  final DateTime date;
  final VoidCallback onTap;

  const _DatePickerField({required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: AppColors.darkCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.textMuted.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined,
                size: 18, color: AppColors.textSecondary),
            const SizedBox(width: 10),
            Text(
              DateFormat('dd/MM/yyyy', 'pt_BR').format(date),
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            const Icon(Icons.expand_more, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}

class _CategoryGrid extends StatelessWidget {
  final List<String> categories;
  final String selected;
  final ValueChanged<String> onSelect;

  const _CategoryGrid({
    required this.categories,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: categories.map((c) {
        final isSelected = c == selected;
        final color = categoryColor(c);
        return GestureDetector(
          onTap: () => onSelect(c),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: isSelected ? color.withOpacity(0.2) : AppColors.darkCard,
              border: Border.all(
                color: isSelected ? color : AppColors.textMuted.withOpacity(0.2),
                width: isSelected ? 1.5 : 1,
              ),
            ),
            child: Text(
              c,
              style: TextStyle(
                color: isSelected ? color : AppColors.textSecondary,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _IntensitySelector extends StatelessWidget {
  final TrainingIntensity selected;
  final ValueChanged<TrainingIntensity> onSelect;

  const _IntensitySelector({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: TrainingIntensity.values.map((intensity) {
        final isSelected = intensity == selected;
        return Expanded(
          child: GestureDetector(
            onTap: () => onSelect(intensity),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: EdgeInsets.only(
                right: intensity != TrainingIntensity.maxima ? 8 : 0,
              ),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: isSelected
                    ? intensity.color.withOpacity(0.2)
                    : AppColors.darkCard,
                border: Border.all(
                  color: isSelected
                      ? intensity.color
                      : AppColors.textMuted.withOpacity(0.2),
                  width: isSelected ? 1.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(intensity.filledBars, (_) {
                      return Container(
                        width: 4,
                        height: 12,
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          color: intensity.color,
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    intensity.label,
                    style: TextStyle(
                      color: isSelected ? intensity.color : AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight:
                          isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _DurationStepper extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChanged;

  const _DurationStepper({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.textMuted.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          _StepperBtn(
            icon: Icons.remove,
            onTap: value > 10 ? () => onChanged(value - 10) : null,
          ),
          Expanded(
            child: Text(
              '${value}min',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          _StepperBtn(
            icon: Icons.add,
            onTap: value < 300 ? () => onChanged(value + 10) : null,
          ),
        ],
      ),
    );
  }
}

class _StepperBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _StepperBtn({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 36,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: enabled
              ? AppColors.darkElevated
              : AppColors.darkElevated.withOpacity(0.4),
        ),
        child: Icon(
          icon,
          size: 18,
          color: enabled ? AppColors.textPrimary : AppColors.textMuted,
        ),
      ),
    );
  }
}

class _StyledTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final int maxLines;
  final String? Function(String?)? validator;

  const _StyledTextField({
    required this.controller,
    required this.hintText,
    this.maxLines = 1,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      validator: validator,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 14,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 14,
        ),
        filled: true,
        fillColor: AppColors.darkCard,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.textMuted.withOpacity(0.2)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.textMuted.withOpacity(0.2)),
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
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
      ),
    );
  }
}
