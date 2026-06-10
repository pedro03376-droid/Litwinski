import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/loading_widget.dart';

final _videoTypeProvider = StateProvider<String>((ref) => 'video');
final _videosProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, type) async {
    final data = await ref
        .read(apiClientProvider)
        .get<Map<String, dynamic>>('/videos', queryParameters: {'type': type});
    return data['data'] as List? ?? [];
  },
);

class VideosScreen extends ConsumerWidget {
  const VideosScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = ref.watch(_videoTypeProvider);
    final videosAsync = ref.watch(_videosProvider(type));

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      appBar: AppBar(
        title: const Text('Vídeos e Fotos'),
        bottom: TabBar(
          tabs: const [Tab(text: 'Vídeos'), Tab(text: 'Fotos')],
          onTap: (i) =>
              ref.read(_videoTypeProvider.notifier).state =
                  i == 0 ? 'video' : 'photo',
          indicatorColor: AppColors.cyan,
          labelColor: AppColors.cyan,
          unselectedLabelColor: AppColors.textMuted,
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showUploadSheet(context),
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        icon: const Icon(Icons.upload),
        label: const Text('Upload', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: TabBarView(
        children: [
          _VideoList(async: videosAsync),
          _PhotoGrid(async: videosAsync),
        ],
      ),
    );
  }

  void _showUploadSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.darkCard,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.textMuted,
                  borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          Text('Fazer Upload',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.videocam, color: AppColors.cyan),
            title: const Text('Selecionar Vídeo'),
            onTap: () => Navigator.pop(context),
          ),
          ListTile(
            leading: const Icon(Icons.photo, color: AppColors.purple),
            title: const Text('Selecionar Foto'),
            onTap: () => Navigator.pop(context),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}

class _VideoList extends StatelessWidget {
  final AsyncValue<List<dynamic>> async;
  const _VideoList({required this.async});

  @override
  Widget build(BuildContext context) {
    return async.when(
      loading: () => const LoadingWidget(),
      error: (e, _) => Center(child: Text('Erro: $e')),
      data: (videos) {
        if (videos.isEmpty) {
          return const EmptyState(
            icon: Icons.videocam_off,
            title: 'Nenhum vídeo cadastrado',
            subtitle: 'Faça upload de vídeos de jogos e treinos',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: videos.length,
          itemBuilder: (_, i) {
            final v = videos[i] as Map<String, dynamic>;
            return _VideoCard(video: v);
          },
        );
      },
    );
  }
}

class _PhotoGrid extends StatelessWidget {
  final AsyncValue<List<dynamic>> async;
  const _PhotoGrid({required this.async});

  @override
  Widget build(BuildContext context) {
    return async.when(
      loading: () => const LoadingWidget(),
      error: (e, _) => Center(child: Text('Erro: $e')),
      data: (photos) {
        if (photos.isEmpty) {
          return const EmptyState(
            icon: Icons.photo_library_outlined,
            title: 'Nenhuma foto cadastrada',
            subtitle: 'Faça upload de fotos de jogos e treinos',
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(8),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
          ),
          itemCount: photos.length,
          itemBuilder: (_, i) {
            final p = photos[i] as Map<String, dynamic>;
            return ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                p['url'] ?? '',
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.darkCard,
                  child: const Icon(Icons.broken_image, color: AppColors.textMuted),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _VideoCard extends StatelessWidget {
  final Map<String, dynamic> video;
  const _VideoCard({required this.video});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        leading: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.darkElevated,
            borderRadius: BorderRadius.circular(8),
          ),
          child: video['thumbnailUrl'] != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(video['thumbnailUrl'], fit: BoxFit.cover),
                )
              : const Icon(Icons.play_circle_filled, color: AppColors.cyan, size: 30),
        ),
        title: Text(video['title'] ?? 'Vídeo',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w600)),
        subtitle: Text(
          _contextLabel(video['context']),
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        trailing: const Icon(Icons.play_arrow, color: AppColors.cyan),
        onTap: () {},
      ),
    );
  }

  String _contextLabel(String? ctx) {
    switch (ctx) {
      case 'match': return 'Jogo';
      case 'training': return 'Treino';
      case 'exercise': return 'Exercício';
      default: return 'Geral';
    }
  }
}
