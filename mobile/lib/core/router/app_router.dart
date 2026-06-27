import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/goalkeepers/presentation/screens/goalkeepers_list_screen.dart';
import '../../features/goalkeepers/presentation/screens/goalkeeper_detail_screen.dart';
import '../../features/goalkeepers/presentation/screens/goalkeeper_form_screen.dart';
import '../../features/matches/presentation/screens/matches_list_screen.dart';
import '../../features/matches/presentation/screens/match_detail_screen.dart';
import '../../features/matches/presentation/screens/match_form_screen.dart';
import '../../features/matches/presentation/screens/match_scout_screen.dart';
import '../../features/training/presentation/screens/training_list_screen.dart';
import '../../features/training/presentation/screens/training_detail_screen.dart';
import '../../features/training/presentation/screens/training_form_screen.dart';
import '../../features/performance/presentation/screens/performance_screen.dart';
import '../../features/videos/presentation/screens/videos_screen.dart';
import '../../features/reports/presentation/screens/reports_screen.dart';
import '../../features/dashboard/presentation/screens/executive_dashboard_screen.dart';
import '../shell/main_shell.dart';
import '../providers/auth_provider.dart';


final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isLoggedIn = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
          state.matchedLocation.startsWith('/splash');

      if (!isLoggedIn && !isAuthRoute) return '/login';
      if (isLoggedIn && state.matchedLocation == '/login') return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, __) => const HomeScreen(),
          ),
          GoRoute(
            path: '/goalkeepers',
            builder: (_, __) => const GoalkeepersListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                builder: (_, state) =>
                    GoalkeeperDetailScreen(id: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'new',
                builder: (_, __) => const GoalkeeperFormScreen(),
              ),
              GoRoute(
                path: ':id/edit',
                builder: (_, state) =>
                    GoalkeeperFormScreen(id: state.pathParameters['id']),
              ),
            ],
          ),
          GoRoute(
            path: '/matches',
            builder: (_, __) => const MatchesListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                builder: (_, __) => const MatchFormScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (_, state) =>
                    MatchDetailScreen(id: state.pathParameters['id']!),
              ),
              GoRoute(
                path: ':id/scout',
                builder: (_, state) =>
                    MatchScoutScreen(matchId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/training',
            builder: (_, __) => const TrainingListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                builder: (_, __) => const TrainingFormScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (_, state) =>
                    TrainingDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/performance',
            builder: (_, __) => const PerformanceScreen(),
          ),
          GoRoute(
            path: '/videos',
            builder: (_, __) => const VideosScreen(),
          ),
          GoRoute(
            path: '/reports',
            builder: (_, __) => const ReportsScreen(),
          ),
          GoRoute(
            path: '/dashboard',
            builder: (_, __) => const ExecutiveDashboardScreen(),
          ),
        ],
      ),
    ],
  );
});
