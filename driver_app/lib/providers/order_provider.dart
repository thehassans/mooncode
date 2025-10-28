import 'package:flutter/material.dart';
import '../services/api_service.dart';

class OrderProvider extends ChangeNotifier {
  Map<String, dynamic> _metrics = {};
  Map<String, List<dynamic>> _ordersByStatus = {};
  bool _isLoading = false;

  Map<String, dynamic> get metrics => _metrics;
  Map<String, List<dynamic>> get ordersByStatus => _ordersByStatus;
  bool get isLoading => _isLoading;

  List<dynamic> getOrders(String status) {
    return _ordersByStatus[status] ?? [];
  }

  Future<void> fetchMetrics() async {
    try {
      _metrics = await ApiService.getDriverMetrics();
      notifyListeners();
    } catch (e) {
      // Handle error
      debugPrint('Error fetching metrics: $e');
    }
  }

  Future<void> fetchOrders(String status) async {
    try {
      _isLoading = true;
      notifyListeners();
      
      final orders = await ApiService.getDriverOrders(status);
      _ordersByStatus[status] = orders;
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      debugPrint('Error fetching orders: $e');
    }
  }

  Future<void> refreshAllData() async {
    await Future.wait([
      fetchMetrics(),
      fetchOrders('assigned'),
      fetchOrders('picked'),
      fetchOrders('delivered'),
    ]);
  }

  Future<bool> pickupOrder(String orderId) async {
    try {
      await ApiService.pickupOrder(orderId);
      await refreshAllData();
      return true;
    } catch (e) {
      debugPrint('Error picking up order: $e');
      return false;
    }
  }

  Future<bool> deliverOrder(
    String orderId, {
    String? deliveryNote,
    String? recipientName,
  }) async {
    try {
      await ApiService.deliverOrder(
        orderId,
        deliveryNote: deliveryNote,
        recipientName: recipientName,
      );
      await refreshAllData();
      return true;
    } catch (e) {
      debugPrint('Error delivering order: $e');
      return false;
    }
  }
}
