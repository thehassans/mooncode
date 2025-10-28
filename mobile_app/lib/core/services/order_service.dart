import '../config/api_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class OrderService {
  // Create order from mobile app
  static Future<Map<String, dynamic>> createMobileOrder({
    required List<Map<String, dynamic>> items,
    required Map<String, dynamic> shippingAddress,
    required double subtotal,
    required double tax,
    required double shipping,
    required double total,
    required String paymentMethod,
    String currency = 'AED',
  }) async {
    final token = await AuthService.getToken();

    if (token == null) {
      throw ApiException(
        message: 'Authentication required',
        statusCode: 401,
      );
    }

    final response = await ApiService.post(
      ApiConfig.createMobileOrder,
      headers: ApiConfig.getHeaders(token: token),
      body: {
        'items': items,
        'shippingAddress': shippingAddress,
        'subtotal': subtotal,
        'tax': tax,
        'shipping': shipping,
        'total': total,
        'currency': currency,
        'paymentMethod': paymentMethod,
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
