import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/theme/app_theme.dart';

/// Shimmer loading placeholder that resembles a list of stat cards.
class LoadingWidget extends StatelessWidget {
  final int cardCount;
  final bool showHeader;

  const LoadingWidget({
    super.key,
    this.cardCount = 4,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.darkCard,
      highlightColor: AppColors.darkElevated,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showHeader) ...[
            _ShimmerBox(width: 160, height: 20, borderRadius: 6),
            const SizedBox(height: 16),
          ],
          ...List.generate(cardCount, (index) => _ShimmerCard()),
        ],
      ),
    );
  }
}

/// A shimmer placeholder for a single stat/list card.
class ShimmerCard extends StatelessWidget {
  const ShimmerCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.darkCard,
      highlightColor: AppColors.darkElevated,
      child: _ShimmerCard(),
    );
  }
}

/// Shimmer placeholder for a horizontal row of summary cards.
class ShimmerSummaryRow extends StatelessWidget {
  final int count;

  const ShimmerSummaryRow({super.key, this.count = 4});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.darkCard,
      highlightColor: AppColors.darkElevated,
      child: SizedBox(
        height: 130,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: count,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          itemBuilder: (_, __) => const _ShimmerSummaryCard(),
        ),
      ),
    );
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

class _ShimmerCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _ShimmerBox(width: 38, height: 38, borderRadius: 19),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ShimmerBox(width: 120, height: 14, borderRadius: 4),
                  const SizedBox(height: 6),
                  _ShimmerBox(width: 80, height: 12, borderRadius: 4),
                ],
              ),
              const Spacer(),
              _ShimmerBox(width: 50, height: 22, borderRadius: 4),
            ],
          ),
          const SizedBox(height: 14),
          _ShimmerBox(width: double.infinity, height: 10, borderRadius: 4),
          const SizedBox(height: 6),
          _ShimmerBox(width: 200, height: 10, borderRadius: 4),
        ],
      ),
    );
  }
}

class _ShimmerSummaryCard extends StatelessWidget {
  const _ShimmerSummaryCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ShimmerBox(width: 36, height: 36, borderRadius: 18),
          const SizedBox(height: 12),
          _ShimmerBox(width: 56, height: 22, borderRadius: 4),
          const SizedBox(height: 6),
          _ShimmerBox(width: 90, height: 11, borderRadius: 4),
        ],
      ),
    );
  }
}

class _ShimmerBox extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const _ShimmerBox({
    required this.width,
    required this.height,
    required this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}
