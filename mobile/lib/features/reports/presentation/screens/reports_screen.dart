import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/loading_widget.dart';
import '../../../goalkeepers/data/repositories/goalkeeper_repository.dart';
import '../../../goalkeepers/domain/entities/goalkeeper.dart';
import '../../data/repositories/reports_repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _reportsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.read(reportsRepositoryProvider).getAll();
});

final _goalkeepersForReportProvider =
    FutureProvider<List<Goalkeeper>>((ref) async {
  return ref.read(goalkeeperRepositoryProvider).getAll(isActive: true, perPage: 100);
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(_reportsProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Relatórios'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: AppColors.textSecondary),
            onPressed: () => ref.invalidate(_reportsProvider),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showGenerateSheet(context, ref),
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        icon: const Icon(Icons.add),
        label: const Text('Gerar', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: reportsAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text('Erro: $e',
                  style: const TextStyle(color: AppColors.textMuted),
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(_reportsProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar novamente'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.cyan, foregroundColor: Colors.black),
              ),
            ],
          ),
        ),
        data: (reports) {
          if (reports.isEmpty) {
            return const EmptyState(
              icon: Icons.description_outlined,
              title: 'Nenhum relatório gerado',
              subtitle: 'Toque em + para gerar um relatório em PDF',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            itemCount: reports.length,
            itemBuilder: (_, i) => _ReportCard(
              report: reports[i],
              onDeleted: () => ref.invalidate(_reportsProvider),
            ),
          );
        },
      ),
    );
  }

  void _showGenerateSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.darkCard,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _GenerateReportSheet(
        onGenerated: () => ref.invalidate(_reportsProvider),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

class _ReportCard extends ConsumerWidget {
  final Map<String, dynamic> report;
  final VoidCallback onDeleted;

  const _ReportCard({required this.report, required this.onDeleted});

  String _typeLabel(String? type) {
    switch (type) {
      case 'match':
        return 'Jogo';
      case 'period':
        return 'Período';
      case 'training':
        return 'Treino';
      case 'season':
        return 'Temporada';
      default:
        return 'Relatório';
    }
  }

  Color _typeColor(String? type) {
    switch (type) {
      case 'match':
        return AppColors.cyan;
      case 'period':
        return AppColors.purple;
      case 'training':
        return AppColors.success;
      default:
        return AppColors.warning;
    }
  }

  String _formattedDate(String? iso) {
    if (iso == null) return '';
    try {
      return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(iso));
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = _typeColor(report['type'] as String?);
    final pdfPath = report['pdfUrl'] as String?;
    final fullUrl = pdfPath != null
        ? ref
            .read(reportsRepositoryProvider)
            .downloadUrl(pdfPath, AppConstants.baseUrl)
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              report['title'] ?? 'Relatório',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _typeLabel(report['type'] as String?),
                  style: TextStyle(
                      color: color, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _formattedDate(report['createdAt'] as String?),
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
            ]),
          ]),
        ),
        Column(mainAxisSize: MainAxisSize.min, children: [
          if (fullUrl != null)
            IconButton(
              icon: const Icon(Icons.download, color: AppColors.cyan),
              tooltip: 'Baixar PDF',
              onPressed: () async {
                final uri = Uri.parse(fullUrl);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
            ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppColors.error),
            tooltip: 'Excluir',
            onPressed: () async {
              final id = report['id'] as String?;
              if (id == null) return;
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (_) => AlertDialog(
                  backgroundColor: AppColors.darkCard,
                  title: const Text('Excluir relatório'),
                  content: const Text(
                      'Esta ação não pode ser desfeita.',
                      style: TextStyle(color: AppColors.textSecondary)),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancelar')),
                    TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Excluir',
                            style: TextStyle(color: AppColors.error))),
                  ],
                ),
              );
              if (confirmed == true) {
                await ref.read(reportsRepositoryProvider).delete(id);
                onDeleted();
              }
            },
          ),
        ]),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Generate report sheet
// ---------------------------------------------------------------------------

class _GenerateReportSheet extends ConsumerStatefulWidget {
  final VoidCallback onGenerated;
  const _GenerateReportSheet({required this.onGenerated});

  @override
  ConsumerState<_GenerateReportSheet> createState() =>
      _GenerateReportSheetState();
}

class _GenerateReportSheetState extends ConsumerState<_GenerateReportSheet> {
  String _type = 'period';
  String? _selectedGoalkeeperId;
  DateTime _dateFrom = DateTime.now().subtract(const Duration(days: 30));
  DateTime _dateTo = DateTime.now();
  bool _loading = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final goalkeepersAsync = ref.watch(_goalkeepersForReportProvider);

    return Padding(
      padding: EdgeInsets.fromLTRB(
          24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
                color: AppColors.textMuted,
                borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 20),
        Text('Gerar Relatório',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 20),

        // Goalkeeper selector
        goalkeepersAsync.when(
          loading: () => const LinearProgressIndicator(color: AppColors.cyan),
          error: (_, __) => const SizedBox.shrink(),
          data: (gks) => DropdownButtonFormField<String>(
            value: _selectedGoalkeeperId,
            decoration: InputDecoration(
              labelText: 'Goleira',
              filled: true,
              fillColor: AppColors.darkElevated,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none),
            ),
            items: gks
                .map((g) => DropdownMenuItem(value: g.id, child: Text(g.name)))
                .toList(),
            onChanged: (v) => setState(() => _selectedGoalkeeperId = v),
            dropdownColor: AppColors.darkCard,
            hint: const Text('Selecione',
                style: TextStyle(color: AppColors.textMuted)),
          ),
        ),

        const SizedBox(height: 14),

        // Report type
        DropdownButtonFormField<String>(
          value: _type,
          decoration: InputDecoration(
            labelText: 'Tipo de Relatório',
            filled: true,
            fillColor: AppColors.darkElevated,
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none),
          ),
          items: const [
            DropdownMenuItem(value: 'period', child: Text('Relatório de Período')),
            DropdownMenuItem(value: 'match', child: Text('Relatório de Jogo (última partida)')),
            DropdownMenuItem(value: 'training', child: Text('Relatório de Treino (última sessão)')),
          ],
          onChanged: (v) => setState(() => _type = v!),
          dropdownColor: AppColors.darkCard,
        ),

        // Date range (only for period)
        if (_type == 'period') ...[
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _DateField(
              label: 'De',
              date: _dateFrom,
              onPicked: (d) => setState(() => _dateFrom = d),
            )),
            const SizedBox(width: 12),
            Expanded(child: _DateField(
              label: 'Até',
              date: _dateTo,
              onPicked: (d) => setState(() => _dateTo = d),
            )),
          ]),
        ],

        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
        ],

        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _generate,
            child: _loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.black))
                : const Text('Gerar PDF'),
          ),
        ),
      ]),
    );
  }

  Future<void> _generate() async {
    if (_selectedGoalkeeperId == null) {
      setState(() => _error = 'Selecione uma goleira');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(reportsRepositoryProvider);
      switch (_type) {
        case 'period':
          await repo.generatePeriod(
            goalkeeperId: _selectedGoalkeeperId!,
            dateFrom: _dateFrom,
            dateTo: _dateTo,
          );
          break;
        case 'match':
          // Fetch most recent match for this goalkeeper
          final matches = await ref
              .read(apiClientProvider)
              .get<List<dynamic>>('/matches',
                  queryParameters: {'goalkeeperId': _selectedGoalkeeperId, 'limit': 1});
          final matchId = (matches?.isNotEmpty == true)
              ? (matches!.first as Map)['id'] as String?
              : null;
          if (matchId == null) throw Exception('Nenhuma partida encontrada');
          await repo.generateMatch(
              goalkeeperId: _selectedGoalkeeperId!, matchId: matchId);
          break;
        case 'training':
          final sessions = await ref
              .read(apiClientProvider)
              .get<List<dynamic>>('/training',
                  queryParameters: {'goalkeeperId': _selectedGoalkeeperId, 'limit': 1});
          final sessionId = (sessions?.isNotEmpty == true)
              ? (sessions!.first as Map)['id'] as String?
              : null;
          if (sessionId == null) throw Exception('Nenhum treino encontrado');
          await repo.generateTraining(
              goalkeeperId: _selectedGoalkeeperId!, trainingSessionId: sessionId);
          break;
      }
      if (mounted) {
        Navigator.pop(context);
        widget.onGenerated();
      }
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime date;
  final void Function(DateTime) onPicked;

  const _DateField({
    required this.label,
    required this.date,
    required this.onPicked,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date,
          firstDate: DateTime(2020),
          lastDate: DateTime.now(),
          builder: (ctx, child) => Theme(
            data: Theme.of(ctx).copyWith(
              colorScheme: const ColorScheme.dark(primary: AppColors.cyan),
            ),
            child: child!,
          ),
        );
        if (picked != null) onPicked(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.darkElevated,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          const Icon(Icons.calendar_today, size: 14, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
            Text(
              DateFormat('dd/MM/yyyy').format(date),
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13),
            ),
          ]),
        ]),
      ),
    );
  }
}
