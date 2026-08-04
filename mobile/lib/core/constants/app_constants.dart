class AppConstants {
  static const String appName = 'GKHUB';
  static const String appVersion = '1.0.0';

  // API
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://litwinski-production.up.railway.app/api/v1',
  );

  // Storage keys
  static const String tokenKey = 'gkhub_access_token';
  static const String refreshTokenKey = 'gkhub_refresh_token';
  static const String userKey = 'gkhub_user';

  // Pagination
  static const int defaultPageSize = 20;

  // Performance thresholds
  static const double eliteThreshold = 9.0;
  static const double excellentThreshold = 8.0;
  static const double goodThreshold = 7.0;
  static const double regularThreshold = 5.0;

  // Training categories (pt-BR labels)
  static const Map<String, String> trainingCategoryLabels = {
    'reflex': 'Reflexo',
    'high_save': 'Defesa Alta',
    'low_save': 'Defesa Baixa',
    'positioning': 'Posicionamento',
    'goal_exit': 'Saída do Gol',
    'one_on_one': '1x1',
    'distribution': 'Distribuição',
    'footwork': 'Jogo com os Pés',
    'coordination': 'Coordenação',
    'agility': 'Agilidade',
    'reaction_time': 'Tempo de Reação',
    'mixed': 'Misto',
  };

  // Intensity labels (pt-BR)
  static const Map<String, String> intensityLabels = {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'max': 'Máxima',
  };

  // Match result labels
  static const Map<String, String> matchResultLabels = {
    'win': 'Vitória',
    'draw': 'Empate',
    'loss': 'Derrota',
  };

  // Classification labels (pt-BR)
  static const Map<String, String> classificationLabels = {
    'elite': 'Elite',
    'excellent': 'Excelente',
    'good': 'Boa',
    'regular': 'Regular',
    'developing': 'Em Desenvolvimento',
  };
}
