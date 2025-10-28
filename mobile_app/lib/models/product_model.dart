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
    return ProductModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      price: (json['price'] ?? 0).toDouble(),
      originalPrice: json['originalPrice'] != null
          ? (json['originalPrice']).toDouble()
          : null,
      currency: json['currency'] ?? 'AED',
      images: json['images'] != null
          ? List<String>.from(json['images'])
          : [],
      category: json['category'] ?? '',
      brand: json['brand'],
      stock: json['stock'] ?? 0,
      isForMobile: json['isForMobile'] ?? false,
      isActive: json['isActive'] ?? true,
      variants: json['variants'] != null
          ? (json['variants'] as List)
              .map((v) => ProductVariant.fromJson(v))
              .toList()
          : null,
      rating: json['rating'] != null
          ? ProductRating.fromJson(json['rating'])
          : null,
      specifications: json['specifications'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
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
