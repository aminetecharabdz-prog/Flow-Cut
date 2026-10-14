import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services.dart';

// Public client values (safe to ship; data is protected by RLS).
// Can be overridden at build time with --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_KEY=...
const _envUrl = String.fromEnvironment('SUPABASE_URL');
const _envKey = String.fromEnvironment('SUPABASE_KEY');
const supabaseUrl = _envUrl == '' ? 'https://ukekgjillyhxbiexewpi.supabase.co' : _envUrl;
const supabaseKey = _envKey == '' ? 'sb_publishable_AUhKj0D_LkM_cKkn2dWB9A_BFT5Zsij' : _envKey;

const appVersion = '1.2.0';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, publishableKey: supabaseKey);
  runApp(const MotionCutApp());
}

class MotionCutApp extends StatelessWidget {
  const MotionCutApp({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFFFFC83D), brightness: Brightness.dark).copyWith(
      primary: const Color(0xFFFFC83D),
      onPrimary: const Color(0xFF1A1400),
      surface: const Color(0xFF0E0F16),
    );
    return MaterialApp(
      title: 'MotionCut',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('fr'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: scheme,
        useMaterial3: true,
        fontFamily: 'MC Cairo',
        scaffoldBackgroundColor: scheme.surface,
        inputDecorationTheme: const InputDecorationTheme(filled: true),
      ),
      // On wide screens (the web app on a computer) keep a phone-like column.
      builder: (context, child) => ColoredBox(
        color: scheme.surface,
        child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 680), child: child)),
      ),
      home: const AuthGate(),
    );
  }
}

/// Shows the login screen or the home screen depending on the auth session.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, _) => supabase.auth.currentSession == null ? const LoginScreen() : const HomeScreen(),
    );
  }
}
