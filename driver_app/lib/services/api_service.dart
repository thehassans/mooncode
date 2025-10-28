import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Update this to your production API URL
  static const String baseUrl = 'https://hassanscode.com/api';
  // For local testing: 'http://10.0.2.2:4000/api' (Android emulator)
  // For local testing: 'http://localhost:4000/api' (iOS simulator)
  
  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // GET request
  static Future<dynamic> get(String endpoint) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl$endpoint'),
        headers: headers,
      );
      
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // POST request
  static Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl$endpoint'),
        headers: headers,
        body: jsonEncode(body),
      );
      
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // PATCH request
  static Future<dynamic> patch(String endpoint, Map<String, dynamic> body) async {
    try {
      final headers = await _getHeaders();
      final response = await http.patch(
        Uri.parse('$baseUrl$endpoint'),
        headers: headers,
        body: jsonEncode(body),
      );
      
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // DELETE request
  static Future<dynamic> delete(String endpoint) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl$endpoint'),
        headers: headers,
      );
      
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Response handler
  static dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    } else if (response.statusCode == 401) {
      // Handle unauthorized - clear token and redirect to login
      _clearAuth();
      throw Exception('Session expired. Please login again.');
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['message'] ?? error['error'] ?? 'Request failed');
    }
  }

  static Future<void> _clearAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
  }

  // Auth APIs
  static Future<Map<String, dynamic>> login(String email, String password) async {
    return await post('/auth/login', {'email': email, 'password': password});
  }

  // Driver APIs
  static Future<Map<String, dynamic>> getDriverMetrics() async {
    return await get('/orders/driver/metrics');
  }

  static Future<List<dynamic>> getDriverOrders(String status) async {
    final response = await get('/orders/driver/list?status=$status');
    return response['orders'] ?? [];
  }

  static Future<Map<String, dynamic>> getOrderDetails(String orderId) async {
    return await get('/orders/$orderId');
  }

  static Future<Map<String, dynamic>> updateOrderStatus(
    String orderId,
    String status, {
    Map<String, dynamic>? additionalData,
  }) async {
    return await patch('/orders/$orderId/status', {
      'status': status,
      ...?additionalData,
    });
  }

  static Future<Map<String, dynamic>> pickupOrder(String orderId) async {
    return await patch('/orders/$orderId/pickup', {});
  }

  static Future<Map<String, dynamic>> deliverOrder(
    String orderId, {
    String? deliveryNote,
    String? recipientName,
  }) async {
    return await patch('/orders/$orderId/deliver', {
      if (deliveryNote != null) 'deliveryNote': deliveryNote,
      if (recipientName != null) 'recipientName': recipientName,
    });
  }

  // User/Profile APIs
  static Future<Map<String, dynamic>> getProfile() async {
    return await get('/users/me');
  }

  static Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    return await patch('/users/me', data);
  }

  static Future<Map<String, dynamic>> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    return await patch('/users/me/password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  // Finance APIs
  static Future<Map<String, dynamic>> getDriverPayoutSummary() async {
    return await get('/finance/drivers/me/payout-summary');
  }

  static Future<List<dynamic>> getDriverRemittances() async {
    final response = await get('/finance/drivers/me/remittances');
    return response['remittances'] ?? [];
  }

  // Notifications
  static Future<List<dynamic>> getNotifications() async {
    final response = await get('/notifications/me');
    return response['notifications'] ?? [];
  }

  static Future<void> markNotificationRead(String notificationId) async {
    await patch('/notifications/$notificationId/read', {});
  }
}
