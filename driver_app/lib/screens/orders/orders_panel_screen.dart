import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/order_provider.dart';
import '../../utils/theme.dart';
import '../../widgets/order_card.dart';

class OrdersPanelScreen extends StatefulWidget {
  const OrdersPanelScreen({super.key});

  @override
  State<OrdersPanelScreen> createState() => _OrdersPanelScreenState();
}

class _OrdersPanelScreenState extends State<OrdersPanelScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final orderProvider = Provider.of<OrderProvider>(context, listen: false);
    await Future.wait([
      orderProvider.fetchOrders('assigned'),
      orderProvider.fetchOrders('picked'),
      orderProvider.fetchOrders('delivered'),
    ]);
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _pickupOrder(String orderId) async {
    final orderProvider = Provider.of<OrderProvider>(context, listen: false);
    final success = await orderProvider.pickupOrder(orderId);
    
    if (!mounted) return;
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? 'Order picked up successfully' : 'Failed to pickup order'),
        backgroundColor: success ? AppTheme.success : AppTheme.danger,
      ),
    );
  }

  Future<void> _deliverOrder(String orderId) async {
    // Show delivery confirmation dialog
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => const DeliveryDialog(),
    );

    if (result == null) return;

    final orderProvider = Provider.of<OrderProvider>(context, listen: false);
    final success = await orderProvider.deliverOrder(
      orderId,
      deliveryNote: result['note'],
      recipientName: result['recipient'],
    );

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? 'Order delivered successfully' : 'Failed to deliver order'),
        backgroundColor: success ? AppTheme.success : AppTheme.danger,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final orderProvider = Provider.of<OrderProvider>(context);

    return Column(
      children: [
        // Tab bar
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark
                ? AppTheme.darkPanel
                : AppTheme.lightPanel,
            border: Border(
              bottom: BorderSide(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkBorder
                    : AppTheme.lightBorder,
              ),
            ),
          ),
          child: TabBar(
            controller: _tabController,
            labelColor: AppTheme.primaryGold,
            unselectedLabelColor: Theme.of(context).brightness == Brightness.dark
                ? AppTheme.darkMuted
                : AppTheme.lightMuted,
            indicatorColor: AppTheme.primaryGold,
            indicatorWeight: 3,
            tabs: [
              Tab(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Assigned'),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.info.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${orderProvider.getOrders('assigned').length}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.info),
                      ),
                    ),
                  ],
                ),
              ),
              Tab(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Picked'),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.warning.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${orderProvider.getOrders('picked').length}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.warning),
                      ),
                    ),
                  ],
                ),
              ),
              Tab(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Delivered'),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${orderProvider.getOrders('delivered').length}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.success),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Tab views
        Expanded(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryGold),
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    // Assigned orders
                    _buildOrderList(
                      orderProvider.getOrders('assigned'),
                      'assigned',
                    ),
                    // Picked orders
                    _buildOrderList(
                      orderProvider.getOrders('picked'),
                      'picked',
                    ),
                    // Delivered orders
                    _buildOrderList(
                      orderProvider.getOrders('delivered'),
                      'delivered',
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildOrderList(List orders, String status) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inbox_outlined,
              size: 64,
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppTheme.darkMuted
                  : AppTheme.lightMuted,
            ),
            const SizedBox(height: 16),
            Text(
              'No ${status} orders',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkMuted
                    : AppTheme.lightMuted,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppTheme.primaryGold,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return OrderCard(
            order: order,
            onTap: () {
              // Navigate to order details
            },
            trailing: status == 'assigned'
                ? ElevatedButton(
                    onPressed: () => _pickupOrder(order['_id']),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                    ),
                    child: const Text('Pick Up', style: TextStyle(fontSize: 12)),
                  )
                : status == 'picked'
                    ? ElevatedButton(
                        onPressed: () => _deliverOrder(order['_id']),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.success,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          minimumSize: Size.zero,
                        ),
                        child: const Text('Deliver', style: TextStyle(fontSize: 12)),
                      )
                    : null,
          );
        },
      ),
    );
  }
}

class DeliveryDialog extends StatefulWidget {
  const DeliveryDialog({super.key});

  @override
  State<DeliveryDialog> createState() => _DeliveryDialogState();
}

class _DeliveryDialogState extends State<DeliveryDialog> {
  final _recipientController = TextEditingController();
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _recipientController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirm Delivery'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _recipientController,
            decoration: const InputDecoration(
              labelText: 'Recipient Name',
              hintText: 'Who received the order?',
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _noteController,
            decoration: const InputDecoration(
              labelText: 'Delivery Note (Optional)',
              hintText: 'Any additional notes',
            ),
            maxLines: 3,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context, {
              'recipient': _recipientController.text,
              'note': _noteController.text,
            });
          },
          child: const Text('Confirm'),
        ),
      ],
    );
  }
}
