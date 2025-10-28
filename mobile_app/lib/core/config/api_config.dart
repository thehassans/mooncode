class ApiConfig {
  // Base URL for API - change this to your backend URL
  static const String baseUrl = 'https://hassanscode.com';
  
  // API Endpoints
  static const String apiPrefix = '/api';
  
  // Auth Endpoints
  static const String login = '$apiPrefix/auth/login';
  static const String register = '$apiPrefix/auth/register';
  static const String me = '$apiPrefix/users/me';
  
  // Product Endpoints
  static const String mobileProducts = '$apiPrefix/products/mobile';
  static String productDetails(String id) => '$apiPrefix/products/mobile/$id';
  static String productsByCategory(String category) => '$apiPrefix/products/mobile/category/$category';
  static const String categories = '$apiPrefix/products/categories';
  
  // Order Endpoints
  static const String createMobileOrder = '$apiPrefix/orders/create/mobile';
  static String userOrders(String userId) => '$apiPrefix/orders/mobile/user/$userId';
  static String orderDetails(String orderId) => '$apiPrefix/orders/mobile/$orderId';
  
  // Cart Endpoints (if backend supports)
  static const String cart = '$apiPrefix/cart';
  
  // User Endpoints
  static const String updateProfile = '$apiPrefix/users/me';
  static const String addresses = '$apiPrefix/users/me/addresses';
  
  // Timeout
  static const Duration timeout = Duration(seconds: 30);
  
  // Pagination
  static const int defaultPageSize = 20;
  
  // Headers
  static Map<String, String> getHeaders({String? token}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    
    return headers;
  }
}
