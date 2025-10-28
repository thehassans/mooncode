class ProductModel {
  final String id;
  final String name;
  final String description;
  final double price;
  final double? originalPrice;
  final String? currency;
  final List<String> images;
  final String category;
  final String? brand;
  final int stock;
  final bool isForMobile;
  final bool isActive;
  final List<ProductVariant>? variants;
  final ProductRating? rating;
  final Map<String, dynamic>? specifications;
  final DateTime createdAt;

  ProductModel({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.originalPrice,
    this.currency,
    required this.images,
    required this.category,
    this.brand,
    required this.stock,
    this.isForMobile = false,
    this.isActive = true,
    this.variants,
    this.rating,
    this.specifications,
    required this.createdAt,
  });

  bool get isInStock => stock > 0;
  bool get hasDiscount => originalPrice != null && originalPrice! > price;
  double get discountPercentage {
    if (!hasDiscount) return 0;
    return ((originalPrice! - price) / originalPrice!) * 100;
  }

  String get mainImage => images.isNotEmpty ? images.first : '';

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    // Handle both single image string and array of images
    List<String> imageList = [];
    if (json['images'] != null) {
      if (json['images'] is List) {
        imageList = List<String>.from(json['images']);
      } else if (json['images'] is String) {
        imageList = [json['images']];
      }
    } else if (json['image'] != null) {
      imageList = [json['image']];
    }
    
    return ProductModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? json['title'] ?? '',
      description: json['description'] ?? json['desc'] ?? '',
      price: _parsePrice(json['price']),
      originalPrice: json['originalPrice'] != null
          ? _parsePrice(json['originalPrice'])
          : (json['compareAtPrice'] != null ? _parsePrice(json['compareAtPrice']) : null),
      currency: json['currency'] ?? 'AED',
      images: imageList,
      category: json['category'] ?? json['categoryId'] ?? '',
      brand: json['brand'],
      stock: json['stock'] ?? json['quantity'] ?? 0,
      isForMobile: json['isForMobile'] ?? true, // Default to true for mobile app
      isActive: json['isActive'] ?? json['active'] ?? true,
      variants: json['variants'] != null
          ? (json['variants'] as List)
              .map((v) => ProductVariant.fromJson(v))
              .toList()
          : null,
      rating: json['rating'] != null
          ? ProductRating.fromJson(json['rating'])
          : (json['reviews'] != null ? _parseRating(json['reviews']) : null),
      specifications: json['specifications'] ?? json['specs'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
  
  static double _parsePrice(dynamic price) {
    if (price == null) return 0;
    if (price is num) return price.toDouble();
    if (price is String) return double.tryParse(price) ?? 0;
    return 0;
  }
  
  static ProductRating? _parseRating(dynamic reviews) {
    if (reviews is Map) {
      return ProductRating(
        average: _parsePrice(reviews['average'] ?? reviews['rating']),
        count: reviews['count'] ?? reviews['total'] ?? 0,
      );
    }
    return null;
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'description': description,
      'price': price,
      if (originalPrice != null) 'originalPrice': originalPrice,
      'currency': currency,
      'images': images,
      'category': category,
      if (brand != null) 'brand': brand,
      'stock': stock,
      'isForMobile': isForMobile,
      'isActive': isActive,
      if (variants != null) 'variants': variants!.map((v) => v.toJson()).toList(),
      if (rating != null) 'rating': rating!.toJson(),
      if (specifications != null) 'specifications': specifications,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

class ProductVariant {
  final String name;
  final List<String> options;

  ProductVariant({
    required this.name,
    required this.options,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      name: json['name'] ?? '',
      options: List<String>.from(json['options'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'options': options,
    };
  }
}

class ProductRating {
  final double average;
  final int count;

  ProductRating({
    required this.average,
    required this.count,
  });

  factory ProductRating.fromJson(Map<String, dynamic> json) {
    return ProductRating(
      average: (json['average'] ?? 0).toDouble(),
      count: json['count'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'average': average,
      'count': count,
    };
  }
}
