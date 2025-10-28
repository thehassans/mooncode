import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/product_provider.dart';
import '../../providers/auth_provider.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ProductProvider>(context, listen: false).loadProducts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final productProvider = Provider.of<ProductProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.appName),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // TODO: Navigate to search screen
            },
          ),
        ],
      ),
      body: productProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : productProvider.error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 64,
                        color: AppColors.error,
                      ),
                      const SizedBox(height: AppDimensions.spaceMD),
                      Text(
                        productProvider.error!,
                        style: const TextStyle(color: AppColors.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppDimensions.spaceMD),
                      ElevatedButton(
                        onPressed: () {
                          productProvider.loadProducts();
                        },
                        child: const Text(AppStrings.tryAgain),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => productProvider.loadProducts(refresh: true),
                  child: ListView(
                    padding: const EdgeInsets.all(AppDimensions.paddingMD),
                    children: [
                      // Welcome Message
                      Text(
                        'Welcome, ${authProvider.user?.firstName ?? "User"}!',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: AppDimensions.spaceSM),
                      const Text(
                        'Discover our latest products',
                        style: TextStyle(
                          fontSize: 16,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppDimensions.spaceLG),

                      // Products Grid
                      if (productProvider.products.isEmpty)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(AppDimensions.paddingXL),
                            child: Column(
                              children: [
                                Icon(
                                  Icons.shopping_bag_outlined,
                                  size: 64,
                                  color: AppColors.gray,
                                ),
                                SizedBox(height: AppDimensions.spaceMD),
                                Text(
                                  'No products available yet',
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                SizedBox(height: AppDimensions.spaceSM),
                                Text(
                                  'Check back soon for new items!',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: AppColors.textTertiary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: AppDimensions.spaceMD,
                            mainAxisSpacing: AppDimensions.spaceMD,
                            childAspectRatio: 0.7,
                          ),
                          itemCount: productProvider.products.length,
                          itemBuilder: (context, index) {
                            final product = productProvider.products[index];
                            return Card(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Product Image
                                  Expanded(
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: AppColors.extraLightGray,
                                        borderRadius: const BorderRadius.vertical(
                                          top: Radius.circular(
                                              AppDimensions.radiusLG),
                                        ),
                                      ),
                                      child: Center(
                                        child: Icon(
                                          Icons.image_outlined,
                                          size: 48,
                                          color: AppColors.gray,
                                        ),
                                      ),
                                    ),
                                  ),
                                  // Product Info
                                  Padding(
                                    padding: const EdgeInsets.all(
                                        AppDimensions.paddingSM),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          product.name,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(
                                            height: AppDimensions.spaceXS),
                                        Text(
                                          '${product.currency ?? 'AED'} ${product.price.toStringAsFixed(2)}',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
    );
  }
}
