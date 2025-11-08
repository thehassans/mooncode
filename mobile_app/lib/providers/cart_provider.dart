import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/cart_model.dart';
import '../models/product_model.dart';

class CartProvider with ChangeNotifier {
  List<CartItem> _items = [];
  static const String _cartKey = 'cart_items';

  List<CartItem> get items => _items;
  Cart get cart => Cart(items: _items);
  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);
  double get subtotal => _items.fold(0, (sum, item) => sum + item.totalPrice);
  double get total => cart.total;

  // Load cart from local storage
  Future<void> loadCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = prefs.getString(_cartKey);
      
      if (cartJson != null) {
        final List<dynamic> decoded = jsonDecode(cartJson);
        _items = decoded.map((item) => CartItem.fromJson(item)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading cart: $e');
    }
  }

  // Save cart to local storage
  Future<void> _saveCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = jsonEncode(_items.map((item) => item.toJson()).toList());
      await prefs.setString(_cartKey, cartJson);
    } catch (e) {
      debugPrint('Error saving cart: $e');
    }
  }

  // Add item to cart
  void addItem(ProductModel product, {int quantity = 1, Map<String, String>? variants}) {
    final existingIndex = _items.indexWhere((item) => item.product.id == product.id);

    if (existingIndex >= 0) {
      _items[existingIndex].quantity += quantity;
    } else {
      _items.add(CartItem(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        product: product,
        quantity: quantity,
        selectedVariants: variants,
      ));
    }

    _saveCart();
    notifyListeners();
  }

  // Update item quantity
  void updateItemQuantity(String itemId, int quantity) {
    final index = _items.indexWhere((item) => item.id == itemId);
    
    if (index >= 0) {
      if (quantity <= 0) {
        _items.removeAt(index);
      } else {
        _items[index].quantity = quantity;
      }
      _saveCart();
      notifyListeners();
    }
  }

  // Remove item from cart
  void removeItem(String itemId) {
    _items.removeWhere((item) => item.id == itemId);
    _saveCart();
    notifyListeners();
  }

  // Clear cart
  void clearCart() {
    _items.clear();
    _saveCart();
    notifyListeners();
  }

  // Check if product is in cart
  bool hasProduct(String productId) {
    return _items.any((item) => item.product.id == productId);
  }

  // Get cart item for product
  CartItem? getCartItem(String productId) {
    try {
      return _items.firstWhere((item) => item.product.id == productId);
    } catch (e) {
      return null;
    }
  }

  // Increase quantity
  void increaseQuantity(String itemId) {
    final index = _items.indexWhere((item) => item.id == itemId);
    if (index >= 0) {
      _items[index].quantity++;
      _saveCart();
      notifyListeners();
    }
  }

  // Decrease quantity
  void decreaseQuantity(String itemId) {
    final index = _items.indexWhere((item) => item.id == itemId);
    if (index >= 0) {
      if (_items[index].quantity > 1) {
        _items[index].quantity--;
        _saveCart();
        notifyListeners();
      } else {
        removeItem(itemId);
      }
    }
  }
}
