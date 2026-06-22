import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:gkhub/core/theme/app_theme.dart';
import '../../domain/entities/goalkeeper.dart';
import '../../data/repositories/goalkeeper_repository.dart';

// ─── Form state ──────────────────────────────────────────────────────────────

class _GoalkeeperFormState {
  final bool isLoading;
  final bool isSaving;
  final Goalkeeper? goalkeeper;
  final String? error;

  const _GoalkeeperFormState({
    this.isLoading = false,
    this.isSaving = false,
    this.goalkeeper,
    this.error,
  });

  _GoalkeeperFormState copyWith({
    bool? isLoading,
    bool? isSaving,
    Goalkeeper? goalkeeper,
    String? error,
    bool clearError = false,
  }) =>
      _GoalkeeperFormState(
        isLoading: isLoading ?? this.isLoading,
        isSaving: isSaving ?? this.isSaving,
        goalkeeper: goalkeeper ?? this.goalkeeper,
        error: clearError ? null : (error ?? this.error),
      );
}

class _GoalkeeperFormNotifier extends StateNotifier<_GoalkeeperFormState> {
  final GoalkeeperRepository _repository;
  final String? id;

  _GoalkeeperFormNotifier(this._repository, {this.id})
      : super(const _GoalkeeperFormState()) {
    if (id != null) _load();
  }

  Future<void> _load() async {
    state = state.copyWith(isLoading: true);
    try {
      final gk = await _repository.getById(id!);
      state = state.copyWith(isLoading: false, goalkeeper: gk);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Erro ao carregar dados da goleira.',
      );
    }
  }

  Future<bool> save(Map<String, dynamic> data) async {
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      if (id != null) {
        await _repository.update(id!, data);
      } else {
        await _repository.create(data);
      }
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

// We use a family-based approach so each screen has its own provider instance.
final _formProvider = StateNotifierProvider.autoDispose
    .family<_GoalkeeperFormNotifier, _GoalkeeperFormState, String?>(
  (ref, id) => _GoalkeeperFormNotifier(
    ref.read(goalkeeperRepositoryProvider),
    id: id,
  ),
);

// ─── Categories ──────────────────────────────────────────────────────────────

const _kCategories = [
  'adulto',
  'juvenil',
  'infantojuvenil',
  'infantil',
  'sub17',
  'sub15',
  'sub13',
  'sub11',
  'sub09',
];

const _kCategoryLabels = <String, String>{
  'adulto': 'Adulto',
  'juvenil': 'Juvenil',
  'infantojuvenil': 'Infantojuvenil',
  'infantil': 'Infantil',
  'sub17': 'Sub-17',
  'sub15': 'Sub-15',
  'sub13': 'Sub-13',
  'sub11': 'Sub-11',
  'sub09': 'Sub-09',
};

// ─── Screen ──────────────────────────────────────────────────────────────────

class GoalkeeperFormScreen extends ConsumerStatefulWidget {
  final String? id;

  const GoalkeeperFormScreen({super.key, this.id});

  @override
  ConsumerState<GoalkeeperFormScreen> createState() =>
      _GoalkeeperFormScreenState();
}

class _GoalkeeperFormScreenState extends ConsumerState<GoalkeeperFormScreen> {
  final _formKey = GlobalKey<FormState>();

  // Controllers
  late final TextEditingController _nameCtrl;
  late final TextEditingController _heightCtrl;
  late final TextEditingController _weightCtrl;
  late final TextEditingController _jerseyCtrl;
  late final TextEditingController _obsCtrl;

  DateTime? _birthDate;
  String _category = 'adulto';
  String _dominantHand = 'right';
  String _dominantFoot = 'right';
  String? _photoPath;
  bool _initialized = false;

  final _dateFmt = DateFormat('dd/MM/yyyy');

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _heightCtrl = TextEditingController();
    _weightCtrl = TextEditingController();
    _jerseyCtrl = TextEditingController();
    _obsCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _heightCtrl.dispose();
    _weightCtrl.dispose();
    _jerseyCtrl.dispose();
    _obsCtrl.dispose();
    super.dispose();
  }

  void _initFromGoalkeeper(Goalkeeper gk) {
    if (_initialized) return;
    _initialized = true;
    _nameCtrl.text = gk.name;
    _heightCtrl.text = gk.height?.toStringAsFixed(2) ?? '';
    _weightCtrl.text = gk.weight?.toStringAsFixed(1) ?? '';
    _jerseyCtrl.text = gk.jerseyNumber?.toString() ?? '';
    _obsCtrl.text = gk.observations ?? '';
    _birthDate = gk.birthDate;
    _category = gk.category;
    _dominantHand = gk.dominantHand;
    _dominantFoot = gk.dominantFoot;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(2005),
      firstDate: DateTime(1980),
      lastDate: DateTime.now(),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
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
    if (picked != null) setState(() => _birthDate = picked);
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 800,
    );
    if (picked != null) setState(() => _photoPath = picked.path);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_birthDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Informe a data de nascimento.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final data = <String, dynamic>{
      'name': _nameCtrl.text.trim(),
      'birth_date': _birthDate!.toIso8601String().split('T')[0],
      'category': _category,
      'dominant_hand': _dominantHand,
      'dominant_foot': _dominantFoot,
      if (_heightCtrl.text.isNotEmpty)
        'height': double.tryParse(_heightCtrl.text.replaceAll(',', '.')),
      if (_weightCtrl.text.isNotEmpty)
        'weight': double.tryParse(_weightCtrl.text.replaceAll(',', '.')),
      if (_jerseyCtrl.text.isNotEmpty)
        'jersey_number': int.tryParse(_jerseyCtrl.text),
      if (_obsCtrl.text.isNotEmpty) 'observations': _obsCtrl.text.trim(),
    };

    final ok =
        await ref.read(_formProvider(widget.id).notifier).save(data);
    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.id == null ? 'Goleira cadastrada!' : 'Dados atualizados!'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final formState = ref.watch(_formProvider(widget.id));

    // Pre-fill from existing goalkeeper data
    if (formState.goalkeeper != null && !_initialized) {
      _initFromGoalkeeper(formState.goalkeeper!);
    }

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title:
            Text(widget.id == null ? 'Nova Goleira' : 'Editar Goleira'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => context.pop(),
        ),
      ),
      body: formState.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.cyan))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  // Error banner
                  if (formState.error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.error.withOpacity(0.4),
                        ),
                      ),
                      child: Text(
                        formState.error!,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Photo picker
                  _PhotoPickerSection(
                    photoPath: _photoPath,
                    onTap: _pickPhoto,
                  ),
                  const SizedBox(height: 20),

                  _SectionHeader(label: 'Dados Pessoais'),
                  const SizedBox(height: 12),

                  // Name
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Nome completo *',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    textCapitalization: TextCapitalization.words,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Informe o nome' : null,
                  ),
                  const SizedBox(height: 12),

                  // Birth date
                  GestureDetector(
                    onTap: _pickDate,
                    child: AbsorbPointer(
                      child: TextFormField(
                        decoration: InputDecoration(
                          labelText: 'Data de nascimento *',
                          prefixIcon:
                              const Icon(Icons.calendar_today_outlined),
                          hintText: 'DD/MM/AAAA',
                        ),
                        controller: TextEditingController(
                          text: _birthDate != null
                              ? _dateFmt.format(_birthDate!)
                              : '',
                        ),
                        validator: (_) =>
                            _birthDate == null ? 'Informe a data' : null,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  _SectionHeader(label: 'Dados Físicos'),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _heightCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Altura (m)',
                            prefixIcon:
                                Icon(Icons.height_outlined),
                            hintText: '1.70',
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                                RegExp(r'[0-9.,]')),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _weightCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Peso (kg)',
                            prefixIcon:
                                Icon(Icons.monitor_weight_outlined),
                            hintText: '65.0',
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                                RegExp(r'[0-9.,]')),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  _SectionHeader(label: 'Categoria & Equipe'),
                  const SizedBox(height: 12),

                  // Category dropdown
                  DropdownButtonFormField<String>(
                    value: _category,
                    decoration: const InputDecoration(
                      labelText: 'Categoria *',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    dropdownColor: AppColors.darkCard,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 14),
                    items: _kCategories
                        .map((cat) => DropdownMenuItem(
                              value: cat,
                              child:
                                  Text(_kCategoryLabels[cat] ?? cat),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => _category = v);
                    },
                  ),
                  const SizedBox(height: 12),

                  // Jersey number
                  TextFormField(
                    controller: _jerseyCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Número da camisa',
                      prefixIcon: Icon(Icons.tag),
                    ),
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly
                    ],
                  ),
                  const SizedBox(height: 20),

                  _SectionHeader(label: 'Lateralidade'),
                  const SizedBox(height: 12),

                  _LateralityPicker(
                    label: 'Mão dominante',
                    value: _dominantHand,
                    leftLabel: 'Canhota',
                    rightLabel: 'Destro',
                    onChanged: (v) => setState(() => _dominantHand = v),
                  ),
                  const SizedBox(height: 12),

                  _LateralityPicker(
                    label: 'Pé dominante',
                    value: _dominantFoot,
                    leftLabel: 'Esquerdo',
                    rightLabel: 'Direito',
                    onChanged: (v) => setState(() => _dominantFoot = v),
                  ),
                  const SizedBox(height: 20),

                  _SectionHeader(label: 'Observações'),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _obsCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Observações',
                      alignLabelWithHint: true,
                    ),
                    maxLines: 4,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                  const SizedBox(height: 28),

                  // Save button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: formState.isSaving ? null : _save,
                      child: formState.isSaving
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                color: Colors.black,
                                strokeWidth: 2.5,
                              ),
                            )
                          : Text(
                              widget.id == null
                                  ? 'Cadastrar Goleira'
                                  : 'Salvar Alterações',
                            ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

// ─── Sub-widgets ─────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;

  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        color: AppColors.cyan,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _PhotoPickerSection extends StatelessWidget {
  final String? photoPath;
  final VoidCallback onTap;

  const _PhotoPickerSection({
    required this.photoPath,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.darkCard,
            border: Border.all(
              color: AppColors.cyan.withOpacity(0.4),
              width: 2,
            ),
          ),
          child: photoPath != null
              ? ClipOval(
                  child: Image.file(
                    File(photoPath!),
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _PhotoPlaceholder(),
                  ),
                )
              : _PhotoPlaceholder(),
        ),
      ),
    );
  }
}

class _PhotoPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: const [
        Icon(Icons.add_a_photo_outlined,
            color: AppColors.cyan, size: 28),
        SizedBox(height: 4),
        Text(
          'Foto',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

class _LateralityPicker extends StatelessWidget {
  final String label;
  final String value;
  final String leftLabel;
  final String rightLabel;
  final ValueChanged<String> onChanged;

  const _LateralityPicker({
    required this.label,
    required this.value,
    required this.leftLabel,
    required this.rightLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _RadioTile(
              label: rightLabel,
              selected: value == 'right',
              onTap: () => onChanged('right'),
            ),
            const SizedBox(width: 12),
            _RadioTile(
              label: leftLabel,
              selected: value == 'left',
              onTap: () => onChanged('left'),
            ),
          ],
        ),
      ],
    );
  }
}

class _RadioTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _RadioTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.cyan.withOpacity(0.15)
              : AppColors.darkCard,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected
                ? AppColors.cyan
                : AppColors.textMuted.withOpacity(0.3),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppColors.cyan : AppColors.textMuted,
                  width: 1.5,
                ),
                color: selected
                    ? AppColors.cyan.withOpacity(0.3)
                    : Colors.transparent,
              ),
              child: selected
                  ? const Center(
                      child: Icon(Icons.circle,
                          color: AppColors.cyan, size: 8),
                    )
                  : null,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: selected
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
                fontSize: 13,
                fontWeight:
                    selected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
