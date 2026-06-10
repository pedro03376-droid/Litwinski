import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  static const _tabs = [
    _TabItem(path: '/home', icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
    _TabItem(path: '/matches', icon: Icons.sports_soccer_outlined, activeIcon: Icons.sports_soccer, label: 'Jogos'),
    _TabItem(path: '/training', icon: Icons.fitness_center_outlined, activeIcon: Icons.fitness_center, label: 'Treinos'),
    _TabItem(path: '/performance', icon: Icons.bar_chart_outlined, activeIcon: Icons.bar_chart, label: 'Performance'),
    _TabItem(path: '/videos', icon: Icons.videocam_outlined, activeIcon: Icons.videocam, label: 'Vídeos'),
    _TabItem(path: '/reports', icon: Icons.description_outlined, activeIcon: Icons.description, label: 'Relatórios'),
  ];

  int _getCurrentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (int i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _getCurrentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: AppColors.textMuted.withOpacity(0.15),
              width: 1,
            ),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) => context.go(_tabs[index].path),
          items: _tabs
              .asMap()
              .entries
              .map(
                (e) => BottomNavigationBarItem(
                  icon: Icon(e.value.icon),
                  activeIcon: Icon(e.value.activeIcon),
                  label: e.value.label,
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class _TabItem {
  final String path;
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _TabItem({
    required this.path,
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
