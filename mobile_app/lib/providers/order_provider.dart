import 'package:flutter/material.dart';
import '../core/services/order_service.dart';
import '../models/order_model.dart';
import '../models/cart_model.dart';
import '../models/user_model.dart';

class OrderProvider with ChangeNotifier {
  List<OrderModel> _orders = [];
  bool _isLoading = false;
  String? _error;
  OrderModel? _currentOrder;

  List<OrderModel> get orders => _orders;
  bool get isLoading => _isLoading;
  String? get error => _error;
  OrderModel? get currentOrder => _currentOrder;

  // Load user's orders
  Future<void> loadUserOrders(String userId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await OrderService.getUserOrders(userId);
      _orders = response.map((json) => OrderModel.fromJson(json)).toList();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Create order
  Future<bool> createOrder({
    required List<CartItem> cartItems,
    required Address shippingAddress,
    required double subtotal,
    required double tax,
    required double shipping,
    required double total,
    required String paymentMethod,
    String currency = 'AED',
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Convert cart items to order items format
      final items = cartItems.map((item) {
        return {
          'productId': item.product.id,
          'productName': item.product.name,
          'productImage': item.product.mainImage,
          'price': item.product.price,
          'quantity': item.quantity,
          'total': item.totalPrice,
          if (item.selectedVariants != null)
            'selectedVariants': item.selectedVariants,
        };
      }).toList();

      // Prepare order data
      final orderData = {
        'items': items,
        'shippingAddress': shippingAddress.toJson(),
        'subtotal': subtotal,
        'tax': tax,
        'shipping': shipping,
        'total': total,
        'paymentMethod': paymentMethod,
        'currency': currency,
      };

      final response = await OrderService.createMobileOrder(orderData);

      _currentOrder = OrderModel.fromJson(response['order'] ?? response);
      _error = null;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Load order details
  Future<OrderModel?> loadOrderDetails(String orderId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await OrderService.getOrderDetails(orderId);
      final order = OrderModel.fromJson(response);
      _error = null;
      _isLoading = false;
      notifyListeners();
      return order;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  // Get order by ID
  OrderModel? getOrderById(String orderId) {
    try {
      return _orders.firstWhere((order) => order.id == orderId);
    } catch (e) {
      return null;
    }
  }

  // Clear current order
  void clearCurrentOrder() {
    _currentOrder = null;
    notifyListeners();
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
