import '../config/api_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class OrderService {
  // Create order from mobile app (no authentication required)
  static Future<Map<String, dynamic>> createMobileOrder(Map<String, dynamic> orderData) async {
    final response = await ApiService.post(
      ApiConfig.createMobileOrder,
      headers: ApiConfig.getHeaders(), // No token required for mobile orders
      body: {
        ...orderData,
        'source': 'mobile',
      },
    );

    return response;
  }

  // Get user's orders
  static Future<List<dynamic>> getUserOrders(String userId) async {
    final token = await AuthService.getToken();

    if (token == null) {
      throw ApiException(
        message: 'Authentication required',
        statusCode: 401,
      );
    }

    final response = await ApiService.get(
      ApiConfig.userOrders(userId),
      headers: ApiConfig.getHeaders(token: token),
    );

    return response['orders'] ?? response['data'] ?? [];
  }

  // Get order details
  static Future<Map<String, dynamic>> getOrderDetails(String orderId) async {
    final token = await AuthService.getToken();

    if (token == null) {
      throw ApiException(
        message: 'Authentication required',
        statusCode: 401,
      );
    }

    final response = await ApiService.get(
      ApiConfig.orderDetails(orderId),
      headers: ApiConfig.getHeaders(token: token),
    );

    return response['order'] ?? response['data'] ?? response;
  }
}
