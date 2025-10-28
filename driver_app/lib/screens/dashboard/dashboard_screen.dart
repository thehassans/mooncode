import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/order_provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/theme.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/order_card.dart';
import 'package:intl/intl.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final orderProvider = Provider.of<OrderProvider>(context, listen: false);
    await orderProvider.refreshAllData();
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderProvider = Provider.of<OrderProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final metrics = orderProvider.metrics;
    final status = metrics['status'] ?? {};
    final user = authProvider.user;

    // Calculate commission
    final deliveredCount = status['delivered'] ?? 0;
    final commissionPerOrder = user?['driverProfile']?['commissionPerOrder'] ?? 
                               user?['commissionPerOrder'] ?? 0;
    final totalCommission = user?['driverProfile']?['totalCommission'] ?? 
                           (commissionPerOrder * deliveredCount);

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppTheme.primaryGold,
      child: _isLoading
          ? const Center(child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryGold),
            ))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Header
                Text(
                  'Driver Dashboard',
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    foreground: Paint()
                      ..shader = const LinearGradient(
                        colors: [AppTheme.primaryGold, AppTheme.primaryGoldDark],
                      ).createShader(const Rect.fromLTWH(0, 0, 200, 70)),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Overview of your delivery workload',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppTheme.darkMuted
                        : AppTheme.lightMuted,
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // Wallet Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.success, Color(0xFF059669)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.success.withOpacity(0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.account_balance_wallet,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                          const Spacer(),
                          const Icon(Icons.trending_up, color: Colors.white, size: 20),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Wallet Balance',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'SAR ${totalCommission.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'From $deliveredCount delivered orders',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // Order Stats Grid
                Text(
                  'Order Statistics',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.5,
                  children: [
                    StatCard(
                      title: 'Assigned',
                      value: '${status['assigned'] ?? 0}',
                      icon: Icons.assignment_outlined,
                      color: AppTheme.info,
                    ),
                    StatCard(
                      title: 'Picked Up',
                      value: '${status['picked_up'] ?? 0}',
                      icon: Icons.local_shipping_outlined,
                      color: AppTheme.warning,
                    ),
                    StatCard(
                      title: 'Delivered',
                      value: '${status['delivered'] ?? 0}',
                      icon: Icons.check_circle_outline,
                      color: AppTheme.success,
                    ),
                    StatCard(
                      title: 'No Response',
                      value: '${status['no_response'] ?? 0}',
                      icon: Icons.phone_missed_outlined,
                      color: AppTheme.danger,
                    ),
                  ],
                ),
                
                const SizedBox(height: 24),
                
                // Recent Assigned Orders
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Assigned Orders',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    TextButton(
                      onPressed: () {
                        // Navigate to orders panel
                      },
                      child: const Text('View All'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                
                ...orderProvider.getOrders('assigned').take(3).map((order) {
                  return OrderCard(
                    order: order,
                    onTap: () {
                      // Navigate to order details
                    },
                  );
                }).toList(),
                
                if (orderProvider.getOrders('assigned').isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppTheme.darkPanel
                          : AppTheme.lightPanel,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Theme.of(context).brightness == Brightness.dark
                            ? AppTheme.darkBorder
                            : AppTheme.lightBorder,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.inbox_outlined,
                          size: 48,
                          color: Theme.of(context).brightness == Brightness.dark
                              ? AppTheme.darkMuted
                              : AppTheme.lightMuted,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No assigned orders',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).brightness == Brightness.dark
                                ? AppTheme.darkMuted
                                : AppTheme.lightMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                
                const SizedBox(height: 32),
              ],
            ),
    );
  }
}
