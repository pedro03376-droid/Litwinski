import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class GKAvatar extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double size;
  final Color? borderColor;
  final double borderWidth;

  const GKAvatar({
    super.key,
    this.imageUrl,
    required this.name,
    this.size = 40,
    this.borderColor,
    this.borderWidth = 0,
  });

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts[0].isNotEmpty ? parts[0][0].toUpperCase() : '?';
    }
    final first = parts.first.isNotEmpty ? parts.first[0] : '';
    final last = parts.last.isNotEmpty ? parts.last[0] : '';
    return (first + last).toUpperCase();
  }

  Color get _initialsBackgroundColor {
    final colors = [
      AppColors.cyan,
      AppColors.purple,
      AppColors.success,
      AppColors.warning,
      const Color(0xFF4A90D9),
      const Color(0xFFE55A4F),
    ];
    final index = name.isNotEmpty
        ? name.codeUnits.reduce((a, b) => a + b) % colors.length
        : 0;
    return colors[index];
  }

  @override
  Widget build(BuildContext context) {
    Widget avatar;

    if (imageUrl != null && imageUrl!.isNotEmpty) {
      avatar = CachedNetworkImage(
        imageUrl: imageUrl!,
        imageBuilder: (context, imageProvider) => Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            image: DecorationImage(
              image: imageProvider,
              fit: BoxFit.cover,
            ),
          ),
        ),
        placeholder: (context, url) => _buildInitialsAvatar(),
        errorWidget: (context, url, error) => _buildInitialsAvatar(),
      );
    } else {
      avatar = _buildInitialsAvatar();
    }

    if (borderWidth > 0 && borderColor != null) {
      return Container(
        width: size + borderWidth * 2,
        height: size + borderWidth * 2,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: borderColor!,
            width: borderWidth,
          ),
        ),
        child: avatar,
      );
    }

    return avatar;
  }

  Widget _buildInitialsAvatar() {
    final bg = _initialsBackgroundColor;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: bg.withOpacity(0.2),
        border: Border.all(
          color: bg.withOpacity(0.5),
          width: 1.5,
        ),
      ),
      child: Center(
        child: Text(
          _initials,
          style: TextStyle(
            color: bg,
            fontSize: size * 0.35,
            fontWeight: FontWeight.w700,
            fontFamily: 'Inter',
          ),
        ),
      ),
    );
  }
}
