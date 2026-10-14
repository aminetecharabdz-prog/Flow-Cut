import 'dart:async';

import 'package:flutter/material.dart';

import '../options.dart';
import '../services.dart';
import '../widgets/common.dart';
import 'result_screen.dart';

/// Live progress of one job (generation, re-render or export).
class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key, required this.projectId, required this.jobId, this.workerWoken = true});
  final String projectId;
  final String jobId;
  final bool workerWoken;

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  late final Stream<List<Map<String, dynamic>>> _stream =
      supabase.from('jobs').stream(primaryKey: ['id']).eq('id', widget.jobId);
  bool _navigated = false;
  bool _retrying = false;

  void _onDone(Map<String, dynamic> job) {
    if (_navigated) return;
    _navigated = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => ResultScreen(projectId: widget.projectId, exportJobId: job['type'] == 'export' ? widget.jobId : null)),
      );
    });
  }

  Future<void> _retry(String type) async {
    setState(() => _retrying = true);
    try {
      final res = await requestJob(widget.projectId, type == 'full_generation' ? 'generate' : type == 'rerender' ? 'rerender' : 'export');
      if (!mounted) return;
      final job = Map<String, dynamic>.from(res['job'] as Map);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => ProgressScreen(projectId: widget.projectId, jobId: job['id'] as String, workerWoken: res['dispatched'] == true)),
      );
    } on AppException catch (e) {
      if (mounted) showSnack(context, friendlyError(e.code, e.message));
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('جارٍ العمل على الفيديو')),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: _stream,
        builder: (context, snap) {
          final job = snap.data?.isNotEmpty == true ? snap.data!.first : null;
          if (job == null) return const Center(child: CircularProgressIndicator());
          final status = job['status'] as String;
          final type = job['type'] as String;
          if (status == 'succeeded') _onDone(job);
          final progress = ((job['progress'] as num?) ?? 0).toDouble() / 100;
          final stage = job['stage'] as String?;
          final stages = type == 'full_generation' ? ['enhance_audio', 'transcribe', 'plan_scenes', 'render'] : ['render'];
          final current = stage == null ? -1 : stages.indexOf(stage);

          if (status == 'failed' || status == 'canceled') {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.error_outline, size: 64, color: cs.error),
                  const SizedBox(height: 12),
                  const Text('لم يكتمل الفيديو', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('${job['error'] ?? ''}', textAlign: TextAlign.center, style: TextStyle(color: cs.onSurfaceVariant)),
                  if (type == 'full_generation') const Text('تم إرجاع الدقائق إلى رصيدك.', style: TextStyle(fontSize: 12)),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _retrying ? null : () => _retry(type),
                    icon: const Icon(Icons.refresh),
                    label: const Text('أعد المحاولة'),
                  ),
                ]),
              ),
            );
          }

          return ListView(padding: const EdgeInsets.all(24), children: [
            const SizedBox(height: 20),
            Center(
              child: SizedBox(
                width: 160,
                height: 160,
                child: Stack(fit: StackFit.expand, children: [
                  CircularProgressIndicator(value: status == 'queued' ? null : progress, strokeWidth: 10),
                  Center(
                    child: Text(status == 'queued' ? '...' : '${(progress * 100).round()}%', style: Theme.of(context).textTheme.headlineMedium),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 28),
            if (status == 'queued')
              Card(
                child: ListTile(
                  leading: const Icon(Icons.hourglass_top),
                  title: const Text('في قائمة الانتظار'),
                  subtitle: Text(widget.workerWoken
                      ? 'سيبدأ خادم المونتاج خلال لحظات (أول مرة قد تأخذ دقيقتين).'
                      : 'خادم المونتاج غير مفعّل بعد. أكمل إعداد GitHub Actions ثم أعد المحاولة.'),
                ),
              ),
            for (var i = 0; i < stages.length; i++)
              ListTile(
                leading: i < current || (status == 'succeeded')
                    ? Icon(Icons.check_circle, color: cs.primary)
                    : i == current
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
                        : Icon(Icons.radio_button_unchecked, color: cs.outline),
                title: Text(type == 'export' && stages[i] == 'render' ? 'تصدير بالجودة المختارة' : stageLabels[stages[i]] ?? stages[i]),
              ),
            const SizedBox(height: 16),
            Text('يمكنك الخروج من هذه الشاشة، والعمل يكمل في الخلفية.', textAlign: TextAlign.center, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
          ]);
        },
      ),
    );
  }
}
