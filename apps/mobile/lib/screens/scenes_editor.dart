import 'package:flutter/material.dart';

import '../services.dart';
import '../widgets/common.dart';

const _layoutLabels = {
  'hook': 'خطّاف',
  'statement': 'جملة رئيسية',
  'icon_point': 'فكرة مع أيقونة',
  'list': 'قائمة',
  'steps': 'خطوات',
  'compare': 'مقارنة',
  'stat': 'رقم متحرك',
  'quote': 'اقتباس',
  'product': 'المنتج',
  'media': 'صورة / مقطع',
  'speaker': 'المتحدث',
  'speaker_split': 'المتحدث + شرح',
  'cta': 'دعوة للفعل',
};

/// Edit the on-screen text of each scene (fixes speech-recognition mistakes).
class ScenesEditor extends StatefulWidget {
  const ScenesEditor({super.key, required this.projectId});
  final String projectId;

  @override
  State<ScenesEditor> createState() => _ScenesEditorState();
}

class _ScenesEditorState extends State<ScenesEditor> {
  List<Map<String, dynamic>> _scenes = [];
  final Map<String, TextEditingController> _titles = {};
  final Map<String, TextEditingController> _emphasis = {};
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [..._titles.values, ..._emphasis.values]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final rows = await supabase.from('scenes').select().eq('project_id', widget.projectId).order('position');
    setState(() {
      _scenes = List<Map<String, dynamic>>.from(rows);
      for (final s in _scenes) {
        final id = s['id'] as String;
        _titles[id] = TextEditingController(text: s['display_text'] as String? ?? '');
        _emphasis[id] = TextEditingController(text: ((s['keywords'] as List?) ?? []).join(' '));
      }
      _loading = false;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      for (final s in _scenes) {
        final id = s['id'] as String;
        final title = _titles[id]!.text.trim();
        final keywords = _emphasis[id]!.text.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
        if (title != (s['display_text'] ?? '') || keywords.join(' ') != ((s['keywords'] as List?) ?? []).join(' ')) {
          await supabase.from('scenes').update({'display_text': title, 'keywords': keywords}).eq('id', id);
        }
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showSnack(context, 'تعذّر الحفظ: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('تعديل النصوص'),
        actions: [
          TextButton(onPressed: _saving || _loading ? null : _save, child: const Text('حفظ وإعادة الرندر')),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _scenes.length,
              itemBuilder: (context, i) {
                final s = _scenes[i];
                final id = s['id'] as String;
                final start = ((s['start_ms'] as num) / 1000).toStringAsFixed(1);
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        CircleAvatar(radius: 13, child: Text('${i + 1}', style: const TextStyle(fontSize: 12))),
                        const SizedBox(width: 8),
                        Text(_layoutLabels[s['layout']] ?? '${s['layout']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const Spacer(),
                        Text('$start ث', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
                      ]),
                      if ((s['spoken_text'] as String?)?.isNotEmpty == true)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text('🎙 ${s['spoken_text']}', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
                        ),
                      const SizedBox(height: 10),
                      TextField(controller: _titles[id], decoration: const InputDecoration(labelText: 'النص الظاهر', border: OutlineInputBorder())),
                      const SizedBox(height: 8),
                      TextField(controller: _emphasis[id], decoration: const InputDecoration(labelText: 'الكلمات المميّزة (مفصولة بمسافة)', border: OutlineInputBorder())),
                    ]),
                  ),
                );
              },
            ),
    );
  }
}
