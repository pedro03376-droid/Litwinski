import 'package:intl/intl.dart';

class AppDateUtils {
  static final _dateFormatter = DateFormat('dd/MM/yyyy', 'pt_BR');
  static final _dateTimeFormatter = DateFormat('dd/MM/yyyy HH:mm', 'pt_BR');
  static final _monthYearFormatter = DateFormat('MMMM yyyy', 'pt_BR');
  static final _shortMonthFormatter = DateFormat('MMM/yy', 'pt_BR');

  static String formatDate(DateTime? date) {
    if (date == null) return '--';
    return _dateFormatter.format(date);
  }

  static String formatDateTime(DateTime? date) {
    if (date == null) return '--';
    return _dateTimeFormatter.format(date);
  }

  static String formatMonthYear(DateTime date) => _monthYearFormatter.format(date);

  static String formatShortMonth(DateTime date) => _shortMonthFormatter.format(date);

  static String relativeTime(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inDays == 0) return 'Hoje';
    if (diff.inDays == 1) return 'Ontem';
    if (diff.inDays < 7) return 'Há ${diff.inDays} dias';
    if (diff.inDays < 30) return 'Há ${(diff.inDays / 7).floor()} semanas';
    if (diff.inDays < 365) return 'Há ${(diff.inDays / 30).floor()} meses';
    return 'Há ${(diff.inDays / 365).floor()} anos';
  }

  static String formatAge(DateTime birthDate) {
    final today = DateTime.now();
    int age = today.year - birthDate.year;
    if (today.month < birthDate.month ||
        (today.month == birthDate.month && today.day < birthDate.day)) {
      age--;
    }
    return '$age anos';
  }
}
