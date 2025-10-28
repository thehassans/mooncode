import '../config/api_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class ProductService {
  // Get all mobile products
  static Future<List<dynamic>> getMobileProducts({
    int page = 1,
    int limit = 20,
    String? category,
    String? search,
  }) async {
    final token = await AuthService.getToken();
    
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (category != null) 'category': category,
      if (search != null) 'search': search,
    };

    final response = await ApiService.get(
      ApiConfig.mobileProducts,
      headers: ApiConfig.getHeaders(token: token),
      queryParams: queryParams,
    );

    return response['products'] ?? response['data'] ?? [];
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

    return response['products'] ?? response['data'] ?? [];
  }

  // Get categories
  static Future<List<dynamic>> getCategories() async {
    final token = await AuthService.getToken();

    final response = await ApiService.get(
      ApiConfig.categories,
      headers: ApiConfig.getHeaders(token: token),
    );

    return response['categories'] ?? response['data'] ?? [];
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
