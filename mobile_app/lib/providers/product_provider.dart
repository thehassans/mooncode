import 'package:flutter/material.dart';
import '../core/services/product_service.dart';
import '../models/product_model.dart';

class ProductProvider with ChangeNotifier {
  List<ProductModel> _products = [];
  List<ProductModel> _filteredProducts = [];
  List<String> _categories = [];
  bool _isLoading = false;
  String? _error;
  String? _selectedCategory;
  String _searchQuery = '';

  List<ProductModel> get products => _filteredProducts.isNotEmpty ? _filteredProducts : _products;
  List<String> get categories => _categories;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get selectedCategory => _selectedCategory;
  String get searchQuery => _searchQuery;

  // Load products
  Future<void> loadProducts({bool refresh = false}) async {
    if (_isLoading) return;
    
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ProductService.getMobileProducts();
      
      // Handle the response (always a List from the service)
      final List<dynamic> productList = response;
      
      // Filter out invalid entries and parse valid products
      final validProducts = <ProductModel>[];
      for (final item in productList) {
        try {
          // Only parse if item is a Map (valid product object)
          if (item is Map<String, dynamic>) {
            final product = ProductModel.fromJson(item);
            validProducts.add(product);
          } else {
            debugPrint('⚠️ Skipping invalid product data: ${item.runtimeType}');
          }
        } catch (e) {
          debugPrint('⚠️ Failed to parse product: $e');
          // Continue with other products even if one fails
        }
      }
      
      _products = validProducts;
      _filteredProducts = List.from(_products);
      _error = null;
      
      debugPrint('✅ Loaded ${_products.length} products from backend');
    } catch (e) {
      // No fallback - only show real products from database
      debugPrint('❌ API Error: $e');
      _products = [];
      _filteredProducts = [];
      _error = 'Unable to load products. Please check your connection or contact support.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Load categories
  Future<void> loadCategories() async {
    try {
      final response = await ProductService.getCategories();
      _categories = response.map<String>((cat) => cat.toString()).toList();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  // Filter by category
  void filterByCategory(String? category) {
    _selectedCategory = category;
    _applyFilters();
  }

  // Search products
  void searchProducts(String query) {
    _searchQuery = query;
    _applyFilters();
  }

  // Apply all filters
  void _applyFilters() {
    _filteredProducts = _products.where((product) {
      final matchesCategory = _selectedCategory == null || 
          product.category == _selectedCategory;
      
      final matchesSearch = _searchQuery.isEmpty ||
          product.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          product.description.toLowerCase().contains(_searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    }).toList();
    
    notifyListeners();
  }

  // Clear filters
  void clearFilters() {
    _selectedCategory = null;
    _searchQuery = '';
    _filteredProducts = List.from(_products);
    notifyListeners();
  }

  // Get product by ID
  ProductModel? getProductById(String id) {
    try {
      return _products.firstWhere((product) => product.id == id);
    } catch (e) {
      return null;
    }
  }

  // Load product details
  Future<ProductModel?> loadProductDetails(String productId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ProductService.getProductDetails(productId);
      final product = ProductModel.fromJson(response);
      _error = null;
      _isLoading = false;
      notifyListeners();
      return product;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
