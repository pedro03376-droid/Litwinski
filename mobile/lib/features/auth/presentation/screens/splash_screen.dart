import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/providers/auth_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _hasNavigated = false;

  @override
  void initState() {
    super.initState();
    _scheduledNavigation();
  }

  Future<void> _scheduledNavigation() async {
    await Future.delayed(const Duration(milliseconds: 2200));
    if (!mounted || _hasNavigated) return;
    _navigate();
  }

  void _navigate() {
    if (_hasNavigated) return;
    final authState = ref.read(authStateProvider);
    if (authState.isLoading) {
      // still checking auth, try again shortly
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _navigate();
      });
      return;
    }
    _hasNavigated = true;
    if (authState.isAuthenticated) {
      context.go('/home');
    } else {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Watch auth state changes so we can navigate when loading finishes
    ref.listen<AuthState>(authStateProvider, (previous, next) {
      if (!next.isLoading) {
        _navigate();
      }
    });

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo icon
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.cyan.withOpacity(0.3),
                    AppColors.cyan.withOpacity(0.05),
                  ],
                ),
                border: Border.all(
                  color: AppColors.cyan.withOpacity(0.6),
                  width: 2,
                ),
              ),
              child: const Icon(
                Icons.sports_soccer,
                color: AppColors.cyan,
                size: 40,
              ),
            )
                .animate()
                .scale(
                  duration: 600.ms,
                  curve: Curves.easeOutBack,
                  begin: const Offset(0.4, 0.4),
                  end: const Offset(1.0, 1.0),
                )
                .fade(duration: 400.ms),

            const SizedBox(height: 28),

            // GKHUB logo text
            Text(
              'GKHUB',
              style: const TextStyle(
                color: AppColors.cyan,
                fontSize: 48,
                fontWeight: FontWeight.w800,
                fontFamily: 'Inter',
                letterSpacing: 8,
              ),
            )
                .animate()
                .fade(delay: 300.ms, duration: 600.ms)
                .slideY(
                  begin: 0.3,
                  end: 0,
                  delay: 300.ms,
                  duration: 600.ms,
                  curve: Curves.easeOut,
                ),

            const SizedBox(height: 10),

            // Subtitle
            Text(
              'Goalkeeper Performance Platform',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                fontWeight: FontWeight.w400,
                fontFamily: 'Inter',
                letterSpacing: 1.5,
              ),
            )
                .animate()
                .fade(delay: 500.ms, duration: 600.ms)
                .slideY(
                  begin: 0.3,
                  end: 0,
                  delay: 500.ms,
                  duration: 600.ms,
                  curve: Curves.easeOut,
                ),

            const SizedBox(height: 64),

            // Loading indicator
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor:
                    AlwaysStoppedAnimation<Color>(AppColors.cyan.withOpacity(0.7)),
              ),
            )
                .animate()
                .fade(delay: 800.ms, duration: 400.ms),
          ],
        ),
      ),
    );
  }
}
