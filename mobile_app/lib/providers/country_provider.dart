import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CountryProvider with ChangeNotifier {
  String _selectedCountry = 'KSA'; // Default country
  String _selectedCurrency = 'SAR'; // Default currency
  
  // Supported countries with their currencies
  final Map<String, String> _countryCurrencyMap = {
    'UAE': 'AED',
    'KSA': 'SAR',
    'Oman': 'OMR',
    'Bahrain': 'BHD',
    'Kuwait': 'KWD',
    'Qatar': 'QAR',
    'India': 'INR',
  };
  
  // Currency conversion rates (base: AED)
  final Map<String, double> _currencyRates = {
    'AED': 1.0,
    'SAR': 1.02,
    'OMR': 0.38,
    'BHD': 0.38,
    'KWD': 0.31,
    'QAR': 3.64,
    'INR': 22.5,
  };

  String get selectedCountry => _selectedCountry;
  String get selectedCurrency => _selectedCurrency;
  Map<String, String> get countryCurrencyMap => _countryCurrencyMap;
  
  List<String> get availableCountries => _countryCurrencyMap.keys.toList();

  // Load saved country from storage
  Future<void> loadCountry() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedCountry = prefs.getString('selected_country');
      
      if (savedCountry != null && _countryCurrencyMap.containsKey(savedCountry)) {
        _selectedCountry = savedCountry;
        _selectedCurrency = _countryCurrencyMap[savedCountry]!;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading country: $e');
    }
  }

  // Set country and currency
  Future<void> setCountry(String country) async {
    if (!_countryCurrencyMap.containsKey(country)) return;
    
    _selectedCountry = country;
    _selectedCurrency = _countryCurrencyMap[country]!;
    
    // Save to storage
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('selected_country', country);
    } catch (e) {
      debugPrint('Error saving country: $e');
    }
    
    notifyListeners();
  }

  // Convert price from base currency (product's currency) to selected currency
  double convertPrice(double price, String fromCurrency) {
    if (fromCurrency == _selectedCurrency) return price;
    
    final fromRate = _currencyRates[fromCurrency] ?? 1.0;
    final toRate = _currencyRates[_selectedCurrency] ?? 1.0;
    
    // Convert to AED first, then to target currency
    final priceInAED = price / fromRate;
    final priceInTarget = priceInAED * toRate;
    
    return priceInTarget;
  }

  // Format price with currency symbol
  String formatPrice(double price, {String? currency}) {
    final curr = currency ?? _selectedCurrency;
    return '$curr ${price.toStringAsFixed(2)}';
  }

  // Get currency symbol
  String getCurrencySymbol(String currency) {
    const symbols = {
      'AED': 'د.إ',
      'SAR': 'ر.س',
      'OMR': 'ر.ع',
      'BHD': 'د.ب',
      'KWD': 'د.ك',
      'QAR': 'ر.ق',
      'INR': '₹',
    };
    return symbols[currency] ?? currency;
  }

  // Get phone code for country
  String getPhoneCode(String country) {
    const phoneCodes = {
      'UAE': '+971',
      'KSA': '+966',
      'Oman': '+968',
      'Bahrain': '+973',
      'Kuwait': '+965',
      'Qatar': '+974',
      'India': '+91',
    };
    return phoneCodes[country] ?? '+966';
  }

  // Get flag emoji for country
  String getCountryFlag(String country) {
    const flags = {
      'UAE': '🇦🇪',
      'KSA': '🇸🇦',
      'Oman': '🇴🇲',
      'Bahrain': '🇧🇭',
      'Kuwait': '🇰🇼',
      'Qatar': '🇶🇦',
      'India': '🇮🇳',
    };
    return flags[country] ?? '🌍';
  }
}
