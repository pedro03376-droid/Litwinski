import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.addAll([
      _AuthInterceptor(_storage),
      LogInterceptor(
        requestBody: false,
        responseBody: false,
        logPrint: (o) => print('[DIO] $o'),
      ),
    ]);
  }

  Dio get dio => _dio;

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters}) async {
    final res = await _dio.get(path, queryParameters: queryParameters);
    return res.data['data'] as T;
  }

  Future<T> post<T>(String path, {dynamic data}) async {
    final res = await _dio.post(path, data: data);
    return res.data['data'] as T;
  }

  Future<T> patch<T>(String path, {dynamic data}) async {
    final res = await _dio.patch(path, data: data);
    return res.data['data'] as T;
  }

  Future<void> delete(String path) async {
    await _dio.delete(path);
  }

  Future<T> upload<T>(
    String path,
    FormData formData, {
    void Function(int, int)? onProgress,
  }) async {
    final res = await _dio.post(
      path,
      data: formData,
      onSendProgress: onProgress,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
    return res.data['data'] as T;
  }
}

class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  _AuthInterceptor(this._storage);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: AppConstants.tokenKey);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Token expired – could trigger refresh here
    }
    handler.next(err);
  }
}
