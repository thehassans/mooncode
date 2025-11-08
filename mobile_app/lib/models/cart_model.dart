import 'product_model.dart';

class CartItem {
  final String id;
  final ProductModel product;
  int quantity;
  final Map<String, String>? selectedVariants;

  CartItem({
    required this.id,
    required this.product,
    this.quantity = 1,
    this.selectedVariants,
  });

  double get totalPrice => product.price * quantity;

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'] ?? '',
      product: ProductModel.fromJson(json['product']),
      quantity: json['quantity'] ?? 1,
      selectedVariants: json['selectedVariants'] != null
          ? Map<String, String>.from(json['selectedVariants'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'product': product.toJson(),
      'quantity': quantity,
      if (selectedVariants != null) 'selectedVariants': selectedVariants,
    };
  }

  CartItem copyWith({
    String? id,
    ProductModel? product,
    int? quantity,
    Map<String, String>? selectedVariants,
  }) {
    return CartItem(
      id: id ?? this.id,
      product: product ?? this.product,
      quantity: quantity ?? this.quantity,
      selectedVariants: selectedVariants ?? this.selectedVariants,
    );
  }
}

class Cart {
  final List<CartItem> items;

  Cart({required this.items});

  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);
  
  double get subtotal => items.fold(0, (sum, item) => sum + item.totalPrice);
  
  double get tax => subtotal * 0.05; // 5% tax
  
  double get shipping {
    if (subtotal == 0) return 0;
    if (subtotal > 200) return 0; // Free shipping over AED 200
    return 25; // AED 25 flat shipping fee
  }
  
  double get total => subtotal + tax + shipping;

  bool get isEmpty => items.isEmpty;

  CartItem? findItem(String productId) {
    try {
      return items.firstWhere((item) => item.product.id == productId);
    } catch (e) {
      return null;
    }
  }

  bool hasProduct(String productId) {
    return items.any((item) => item.product.id == productId);
  }
}
