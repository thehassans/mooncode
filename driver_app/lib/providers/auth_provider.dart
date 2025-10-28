import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final SharedPreferences _prefs;
  bool _isAuthenticated = false;
  bool _isInitialized = false;
  Map<String, dynamic>? _user;
  String? _token;

  AuthProvider(this._prefs) {
    _checkAuth();
  }

  bool get isAuthenticated => _isAuthenticated;
  bool get isInitialized => _isInitialized;
  Map<String, dynamic>? get user => _user;
  String? get token => _token;

  Future<void> _checkAuth() async {
    _token = _prefs.getString('token');
    final userJson = _prefs.getString('user');
    
    if (_token != null && userJson != null) {
      _user = jsonDecode(userJson);
      _isAuthenticated = true;
    }
    
    _isInitialized = true;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    try {
      final response = await ApiService.login(email, password);
      
      _token = response['token'];
      _user = response['user'];
      
      if (_token != null) {
        await _prefs.setString('token', _token!);
        await _prefs.setString('user', jsonEncode(_user));
        _isAuthenticated = true;
        notifyListeners();
        return true;
      }
      
      return false;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    await _prefs.remove('token');
    await _prefs.remove('user');
    _token = null;
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }

  Future<void> updateUser(Map<String, dynamic> userData) async {
    _user = {...?_user, ...userData};
    await _prefs.setString('user', jsonEncode(_user));
    notifyListeners();
  }
}
