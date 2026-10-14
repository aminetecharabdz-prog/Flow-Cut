import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart' show appVersion;
import '../services.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _isSignUp = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      if (_isSignUp) {
        final res = await supabase.auth.signUp(email: _email.text.trim(), password: _password.text);
        if (res.session == null && mounted) showSnack(context, 'تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.');
      } else {
        await supabase.auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
    } on AuthException catch (e) {
      if (mounted) showSnack(context, e.message == 'Invalid login credentials' ? 'البريد أو كلمة المرور غير صحيحة.' : e.message);
    } catch (e) {
      if (mounted) showSnack(context, 'حدث خطأ: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (_email.text.trim().isEmpty) {
      showSnack(context, 'اكتب بريدك أولاً.');
      return;
    }
    try {
      await supabase.auth.resetPasswordForEmail(_email.text.trim());
      if (mounted) showSnack(context, 'أرسلنا لك رسالة لتغيير كلمة المرور.');
    } on AuthException catch (e) {
      if (mounted) showSnack(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Icon(Icons.movie_filter_rounded, size: 76, color: cs.primary),
              const SizedBox(height: 12),
              const Text('MotionCut', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'MC Lalezar', fontSize: 40)),
              const Text('صوتك يتحوّل إلى فيديو موشن جرافيك احترافي', textAlign: TextAlign.center),
              const SizedBox(height: 4),
              Text('الإصدار $appVersion', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
              const SizedBox(height: 32),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'البريد الإلكتروني', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'كلمة المرور', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: _loading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(_isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'),
                ),
              ),
              TextButton(
                onPressed: _loading ? null : () => setState(() => _isSignUp = !_isSignUp),
                child: Text(_isSignUp ? 'لديك حساب؟ سجّل الدخول' : 'ليس لديك حساب؟ أنشئ حساباً'),
              ),
              if (!_isSignUp) TextButton(onPressed: _loading ? null : _resetPassword, child: const Text('نسيت كلمة المرور؟')),
            ]),
          ),
        ),
      ),
    );
  }
}
