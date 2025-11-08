import '../config/api_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class ProductService {
  // Get all mobile products (public endpoint - no auth required)
  static Future<List<dynamic>> getMobileProducts({
    int page = 1,
    int limit = 50,
    String? category,
    String? search,
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (category != null && category != 'all') 'category': category,
      if (search != null) 'search': search,
    };

    final response = await ApiService.get(
      ApiConfig.mobileProducts,
      headers: ApiConfig.getHeaders(), // No token needed for public endpoint
      queryParams: queryParams,
    );

    final data = response['products'] ?? response['data'] ?? [];
    if (data is List) return data;
    return [];
  }

  // Get product details
  static Future<Map<String, dynamic>> getProductDetails(String productId) async {
    final token = await AuthService.getToken();

    final response = await ApiService.get(
      ApiConfig.productDetails(productId),
      headers: ApiConfig.getHeaders(token: token),
    );

    return response['product'] ?? response['data'] ?? response;
  }

  // Get products by category
  static Future<List<dynamic>> getProductsByCategory(
    String category, {
    int page = 1,
    int limit = 20,
  }) async {
    final token = await AuthService.getToken();

    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
    };

    final response = await ApiService.get(
      ApiConfig.productsByCategory(category),
      headers: ApiConfig.getHeaders(token: token),
      queryParams: queryParams,
    );

    final data = response['products'] ?? response['data'] ?? [];
    if (data is List) return data;
    return [];
  }

  // Get categories
  static Future<List<dynamic>> getCategories() async {
    final token = await AuthService.getToken();

    final response = await ApiService.get(
      ApiConfig.categories,
      headers: ApiConfig.getHeaders(token: token),
    );

    final data = response['categories'] ?? response['data'] ?? [];
    if (data is List) return data;
    return [];
  }

  // Search products
  static Future<List<dynamic>> searchProducts(
    String query, {
    int page = 1,
    int limit = 20,
  }) async {
    return getMobileProducts(
      page: page,
      limit: limit,
      search: query,
    );
  }
}
