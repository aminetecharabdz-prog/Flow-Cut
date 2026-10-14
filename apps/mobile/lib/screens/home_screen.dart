import 'package:flutter/material.dart';

import '../options.dart';
import '../services.dart';
import 'progress_screen.dart';
import 'result_screen.dart';
import 'wizard_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<(List<Map<String, dynamic>>, int)> _data = _load();

  Future<(List<Map<String, dynamic>>, int)> _load() async {
    final projects = await supabase
        .from('projects')
        .select('id, title, status, goal, video_type, template_id, error, updated_at')
        .isFilter('deleted_at', null)
        .order('updated_at', ascending: false);
    return (List<Map<String, dynamic>>.from(projects), await creditBalanceSeconds());
  }

  Future<void> _refresh() async {
    setState(() => _data = _load());
    await _data;
  }

  Future<void> _open(Map<String, dynamic> p) async {
    final id = p['id'] as String;
    final status = p['status'] as String;
    Widget? screen;
    if (status == 'ready') {
      screen = ResultScreen(projectId: id);
    } else if (status == 'queued' || status == 'processing' || status == 'failed') {
      final jobs = await supabase.from('jobs').select('id').eq('project_id', id).order('created_at', ascending: false).limit(1);
      if (jobs.isNotEmpty) screen = ProgressScreen(projectId: id, jobId: jobs.first['id'] as String);
    }
    if (screen == null || !mounted) return;
    await Navigator.push(context, MaterialPageRoute(builder: (_) => screen!));
    _refresh();
  }

  Future<void> _delete(Map<String, dynamic> p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف المشروع؟'),
        content: Text('${p['title']}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok != true) return;
    await supabase.from('projects').update({'deleted_at': DateTime.now().toUtc().toIso8601String()}).eq('id', p['id']);
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('MotionCut', style: TextStyle(fontFamily: 'MC Lalezar', fontSize: 26)),
        actions: [IconButton(tooltip: 'تسجيل الخروج', icon: const Icon(Icons.logout), onPressed: () => supabase.auth.signOut())],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const WizardScreen()));
          _refresh();
        },
        icon: const Icon(Icons.add),
        label: const Text('فيديو جديد'),
      ),
      body: FutureBuilder<(List<Map<String, dynamic>>, int)>(
        future: _data,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) return Center(child: Text('خطأ في التحميل: ${snap.error}'));
          final (projects, balance) = snap.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 100), children: [
              Card(
                child: ListTile(
                  leading: Icon(Icons.timer_outlined, color: cs.primary),
                  title: const Text('رصيد التوليد'),
                  subtitle: const Text('دقائق متبقية هذا الشهر'),
                  trailing: Text(formatSeconds(balance), style: Theme.of(context).textTheme.titleLarge),
                ),
              ),
              const SizedBox(height: 12),
              if (projects.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 60),
                  child: Column(children: [
                    Icon(Icons.auto_awesome, size: 64, color: cs.primary),
                    const SizedBox(height: 12),
                    const Text('ابدأ أول فيديو لك', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Text('سجّل صوتك، اختر الأسلوب، والتطبيق يقوم بالمونتاج.', textAlign: TextAlign.center, style: TextStyle(color: cs.onSurfaceVariant)),
                  ]),
                ),
              for (final p in projects)
                Card(
                  child: ListTile(
                    onTap: () => _open(p),
                    onLongPress: () => _delete(p),
                    leading: CircleAvatar(
                      backgroundColor: cs.primaryContainer,
                      child: Icon(switch (p['video_type']) {
                        'talking_head' => Icons.record_voice_over,
                        'media_montage' => Icons.photo_library,
                        _ => Icons.auto_awesome,
                      }),
                    ),
                    title: Text((p['title'] as String?)?.isNotEmpty == true ? p['title'] as String : 'بدون عنوان'),
                    subtitle: Text([
                      statusLabels[p['status']] ?? '${p['status']}',
                      goals.where((g) => g.id == p['goal']).map((g) => g.label).firstOrNull,
                    ].whereType<String>().join(' · ')),
                    trailing: switch (p['status']) {
                      'ready' => Icon(Icons.play_circle, color: cs.primary),
                      'failed' => Icon(Icons.error_outline, color: cs.error),
                      'queued' || 'processing' => const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                      _ => null,
                    },
                  ),
                ),
              if (projects.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('اضغط مطوّلاً على مشروع لحذفه.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                ),
            ]),
          );
        },
      ),
    );
  }
}
