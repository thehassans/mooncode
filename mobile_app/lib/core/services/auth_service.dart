import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';
import 'api_service.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';

  // Login
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await ApiService.post(
      ApiConfig.login,
      body: {
        'email': email,
        'password': password,
      },
    );

    // Save token
    if (response['token'] != null) {
      await saveToken(response['token']);
    }

    return response;
  }

  // Register
  static Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    final response = await ApiService.post(
      ApiConfig.register,
      body: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        if (phone != null) 'phone': phone,
        'role': 'customer',
      },
    );

    // Save token
    if (response['token'] != null) {
      await saveToken(response['token']);
    }

    return response;
  }

  // Get current user
  static Future<Map<String, dynamic>> getCurrentUser() async {
    final token = await getToken();
    
    if (token == null) {
      throw ApiException(
        message: 'Not authenticated',
        statusCode: 401,
      );
    }

    final response = await ApiService.get(
      ApiConfig.me,
      headers: ApiConfig.getHeaders(token: token),
    );

    return response;
  }

  // Save token
  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  // Get token
  static Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  // Delete token (logout)
  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }

  // Check if user is authenticated
  static Future<bool> isAuthenticated() async {
    final token = await getToken();
    return token != null;
  }

  // Save user data locally
  static Future<void> saveUserData(Map<String, dynamic> userData) async {
    await _storage.write(key: _userKey, value: userData.toString());
  }

  // Logout
  static Future<void> logout() async {
    await deleteToken();
  }
}
