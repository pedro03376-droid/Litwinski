class AppNumberUtils {
  static String formatScore(double? score) {
    if (score == null) return '--';
    return score.toStringAsFixed(1);
  }

  static String formatPercentage(double? value) {
    if (value == null) return '--';
    return '${value.toStringAsFixed(1)}%';
  }

  static String formatHeight(double? height) {
    if (height == null) return '--';
    return '${height.toStringAsFixed(2)}m';
  }

  static String formatWeight(double? weight) {
    if (weight == null) return '--';
    return '${weight.toStringAsFixed(1)}kg';
  }
}
