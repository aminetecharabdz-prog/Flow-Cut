import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// Public client values (safe to ship; data is protected by RLS).
// Can be overridden at build time with --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_KEY=...
const _envUrl = String.fromEnvironment('SUPABASE_URL');
const _envKey = String.fromEnvironment('SUPABASE_KEY');
const supabaseUrl = _envUrl == '' ? 'https://ukekgjillyhxbiexewpi.supabase.co' : _envUrl;
const supabaseKey = _envKey == '' ? 'sb_publishable_AUhKj0D_LkM_cKkn2dWB9A_BFT5Zsij' : _envKey;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty) {
    await Supabase.initialize(url: supabaseUrl, publishableKey: supabaseKey);
  }
  runApp(const MotionCutApp());
}

SupabaseClient get supabase => Supabase.instance.client;

class MotionCutApp extends StatelessWidget {
  const MotionCutApp({super.key});

  @override
  Widget build(BuildContext context) {
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
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7C3AED), brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: supabaseUrl.isEmpty || supabaseKey.isEmpty ? const MissingConfigScreen() : const AuthGate(),
    );
  }
}

class MissingConfigScreen extends StatelessWidget {
  const MissingConfigScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('إعدادات Supabase غير موجودة.\nأضف SUPABASE_URL و SUPABASE_KEY عند البناء.',
              textAlign: TextAlign.center),
        ),
      ),
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
      builder: (context, _) {
        return supabase.auth.currentSession == null ? const LoginScreen() : const ProjectsScreen();
      },
    );
  }
}

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

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      if (_isSignUp) {
        final res = await supabase.auth.signUp(email: _email.text.trim(), password: _password.text);
        if (res.session == null && mounted) {
          _snack('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده.');
        }
      } else {
        await supabase.auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
    } on AuthException catch (e) {
      _snack(e.message);
    } catch (e) {
      _snack('حدث خطأ: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.movie_filter_rounded, size: 72),
                const SizedBox(height: 12),
                Text('MotionCut', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 4),
                const Text('حوّل صوتك إلى فيديو موشن جرافيك', textAlign: TextAlign.center),
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  late Future<_HomeData> _data = _load();

  Future<_HomeData> _load() async {
    final projects = await supabase
        .from('projects')
        .select('id, title, status, goal, created_at')
        .isFilter('deleted_at', null)
        .order('updated_at', ascending: false);
    final balance = await supabase.rpc('get_credit_balance') as int;
    return _HomeData(List<Map<String, dynamic>>.from(projects), balance);
  }

  Future<void> _refresh() async {
    setState(() => _data = _load());
    await _data;
  }

  Future<void> _newProject() async {
    final title = await showDialog<String>(context: context, builder: (_) => const _NewProjectDialog());
    if (title == null) return;
    try {
      await supabase.from('projects').insert({'title': title});
      await _refresh();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذّر إنشاء المشروع: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('مشاريعي'),
        actions: [
          IconButton(
            tooltip: 'تسجيل الخروج',
            icon: const Icon(Icons.logout),
            onPressed: () => supabase.auth.signOut(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newProject,
        icon: const Icon(Icons.add),
        label: const Text('فيديو جديد'),
      ),
      body: FutureBuilder<_HomeData>(
        future: _data,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('خطأ في التحميل: ${snap.error}'));
          }
          final data = snap.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.timer_outlined),
                    title: const Text('رصيد التوليد'),
                    trailing: Text(_formatSeconds(data.balanceSeconds),
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                ),
                const SizedBox(height: 16),
                if (data.projects.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 48),
                    child: Text('لا توجد مشاريع بعد.\nاضغط "فيديو جديد" للبدء.', textAlign: TextAlign.center),
                  ),
                for (final p in data.projects)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.movie_outlined),
                      title: Text((p['title'] as String).isEmpty ? 'بدون عنوان' : p['title'] as String),
                      subtitle: Text(_statusLabel(p['status'] as String)),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HomeData {
  _HomeData(this.projects, this.balanceSeconds);
  final List<Map<String, dynamic>> projects;
  final int balanceSeconds;
}

class _NewProjectDialog extends StatefulWidget {
  const _NewProjectDialog();

  @override
  State<_NewProjectDialog> createState() => _NewProjectDialogState();
}

class _NewProjectDialogState extends State<_NewProjectDialog> {
  final _title = TextEditingController();

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('فيديو جديد'),
      content: TextField(
        controller: _title,
        autofocus: true,
        decoration: const InputDecoration(labelText: 'عنوان المشروع'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(context, _title.text.trim()), child: const Text('إنشاء')),
      ],
    );
  }
}

String _formatSeconds(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')} دقيقة';

String _statusLabel(String status) => switch (status) {
      'draft' => 'مسودة',
      'queued' => 'في الانتظار',
      'processing' => 'جارٍ التوليد...',
      'ready' => 'جاهز',
      'failed' => 'فشل',
      _ => status,
    };
