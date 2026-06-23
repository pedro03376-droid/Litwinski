import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/loading_widget.dart';

final _reportsProvider = FutureProvider<List<dynamic>>((ref) async {
  final data = await ref
      .read(apiClientProvider)
      .get<List<dynamic>>('/reports');
  return data ?? [];
});

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(_reportsProvider);

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(title: const Text('Relatórios')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showGenerateSheet(context, ref),
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        icon: const Icon(Icons.add),
        label: const Text('Gerar', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: reportsAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) =>
            Center(child: Text('Erro: $e', style: const TextStyle(color: AppColors.error))),
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
            itemBuilder: (_, i) {
              final r = reports[i] as Map<String, dynamic>;
              return _ReportCard(report: r);
            },
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
      builder: (_) => _GenerateReportSheet(onGenerated: () {
        ref.invalidate(_reportsProvider);
      }),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final Map<String, dynamic> report;
  const _ReportCard({required this.report});

  String _typeLabel(String? type) {
    switch (type) {
      case 'match': return 'Jogo';
      case 'period': return 'Período';
      case 'season': return 'Temporada';
      case 'comparison': return 'Comparativo';
      default: return 'Relatório';
    }
  }

  Color _typeColor(String? type) {
    switch (type) {
      case 'match': return AppColors.cyan;
      case 'period': return AppColors.purple;
      case 'season': return AppColors.success;
      default: return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _typeColor(report['type']);

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
            Text(report['title'] ?? 'Relatório',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
                maxLines: 2),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(_typeLabel(report['type']),
                  style: TextStyle(
                      color: color, fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          ]),
        ),
        Column(children: [
          IconButton(
            icon: const Icon(Icons.download, color: AppColors.cyan),
            onPressed: () async {
              final url = report['pdfUrl'];
              if (url != null && await canLaunchUrl(Uri.parse(url))) {
                await launchUrl(Uri.parse(url));
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.share, color: AppColors.textMuted),
            onPressed: () {
              final url = report['pdfUrl'] ?? '';
              final title = report['title'] ?? 'Relatório';
              if (url.isNotEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Link: $url')),
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('"$title" ainda não tem PDF disponível')),
                );
              }
            },
          ),
        ]),
      ]),
    );
  }
}

class _GenerateReportSheet extends StatefulWidget {
  final VoidCallback onGenerated;
  const _GenerateReportSheet({required this.onGenerated});

  @override
  State<_GenerateReportSheet> createState() => _GenerateReportSheetState();
}

class _GenerateReportSheetState extends State<_GenerateReportSheet> {
  String _type = 'period';
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
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
            DropdownMenuItem(value: 'match', child: Text('Relatório de Jogo')),
            DropdownMenuItem(value: 'period', child: Text('Relatório de Período')),
            DropdownMenuItem(value: 'season', child: Text('Relatório de Temporada')),
          ],
          onChanged: (v) => setState(() => _type = v!),
          dropdownColor: AppColors.darkCard,
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading
                ? null
                : () {
                    Navigator.pop(context);
                    widget.onGenerated();
                  },
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
}
