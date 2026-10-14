import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../options.dart';
import '../services.dart';
import '../widgets/common.dart';
import 'progress_screen.dart';
import 'scenes_editor.dart';

/// Preview of the generated video with edit, restyle and export actions.
class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key, required this.projectId, this.exportJobId});
  final String projectId;
  final String? exportJobId;

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  Map<String, dynamic>? _project;
  VideoPlayerController? _player;
  Map<String, dynamic>? _export;
  String _plan = 'free';
  bool _loading = true;
  bool _sharing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final project = await supabase.from('projects').select().eq('id', widget.projectId).single();
    final url = await signedUrlForAsset(project['preview_asset_id'] as String?);
    final exports = await supabase.from('exports').select().eq('project_id', widget.projectId).order('created_at', ascending: false).limit(1);
    _plan = await currentPlan();
    VideoPlayerController? player;
    if (url != null) {
      player = VideoPlayerController.networkUrl(Uri.parse(url));
      await player.initialize();
      await player.setLooping(true);
      await player.play();
    }
    if (!mounted) {
      await player?.dispose();
      return;
    }
    setState(() {
      _project = project;
      _player?.dispose();
      _player = player;
      _export = exports.isEmpty ? null : exports.first;
      _loading = false;
    });
  }

  Future<void> _startJob(String action, [Map<String, dynamic> extra = const {}]) async {
    try {
      final res = await requestJob(widget.projectId, action, extra);
      if (!mounted) return;
      final job = Map<String, dynamic>.from(res['job'] as Map);
      await _player?.pause();
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => ProgressScreen(projectId: widget.projectId, jobId: job['id'] as String, workerWoken: res['dispatched'] == true)),
      );
    } on AppException catch (e) {
      if (mounted) showSnack(context, friendlyError(e.code, e.message));
    }
  }

  Future<void> _restyle() async {
    final p = _project!;
    var style = p['template_id'] as String? ?? 'vivid';
    String? font = p['font_id'] as String?;
    var caption = p['caption_mode'] as String? ?? 'word_box';
    final pal = Map<String, dynamic>.from((p['palette'] as Map?) ?? {});
    var primary = hexToColor(pal['primary'] as String?) ?? styles.firstWhere((s) => s.id == style).primary;
    var secondary = hexToColor(pal['secondary'] as String?) ?? styles.firstWhere((s) => s.id == style).secondary;
    var background = hexToColor(pal['background'] as String?) ?? styles.firstWhere((s) => s.id == style).bg;

    final apply = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.8,
          builder: (ctx, scroll) => ListView(controller: scroll, padding: const EdgeInsets.all(16), children: [
            const Text('تغيير الشكل بدون إعادة التفريغ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Section(
              title: 'الأسلوب',
              child: ChipChoice(
                options: [for (final s in styles) Opt(s.id, s.label)],
                value: style,
                onChanged: (v) => set(() => style = v),
              ),
            ),
            Section(
              title: 'الألوان',
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                ColorField(label: 'الأساسي', color: primary, onChanged: (c) => set(() => primary = c)),
                ColorField(label: 'الثانوي', color: secondary, onChanged: (c) => set(() => secondary = c)),
                ColorField(label: 'الخلفية', color: background, onChanged: (c) => set(() => background = c)),
              ]),
            ),
            Section(
              title: 'الخط',
              child: ChipChoice(
                options: [const Opt('auto', 'تلقائي'), for (final f in headingFonts) Opt(f.id, f.label)],
                value: font ?? 'auto',
                onChanged: (v) => set(() => font = v == 'auto' ? null : v),
              ),
            ),
            Section(title: 'الكابشن', child: ChipChoice(options: captionModes, value: caption, onChanged: (v) => set(() => caption = v))),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Padding(padding: EdgeInsets.all(12), child: Text('طبّق وأعد الرندر'))),
          ]),
        ),
      ),
    );
    if (apply != true) return;
    await supabase.from('projects').update({
      'template_id': style,
      'font_id': font,
      'caption_mode': caption,
      'palette': {'primary': colorToHex(primary), 'secondary': colorToHex(secondary), 'background': colorToHex(background)},
    }).eq('id', widget.projectId);
    await _startJob('rerender');
  }

  Future<void> _editScenes() async {
    final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => ScenesEditor(projectId: widget.projectId)));
    if (changed == true) await _startJob('rerender');
  }

  Future<void> _exportSheet() async {
    var resolution = _plan == 'free' ? '720p' : '1080p';
    var fps = 30;
    var subtitles = false;
    final go = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('تصدير الفيديو', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: [
                const ButtonSegment(value: '720p', label: Text('720p')),
                ButtonSegment(value: '1080p', label: const Text('1080p'), enabled: _plan != 'free', icon: _plan == 'free' ? const Icon(Icons.lock, size: 16) : null),
                ButtonSegment(value: '4k', label: const Text('4K'), enabled: _plan == 'business', icon: _plan != 'business' ? const Icon(Icons.lock, size: 16) : null),
              ],
              selected: {resolution},
              onSelectionChanged: (s) => set(() => resolution = s.first),
            ),
            const SizedBox(height: 12),
            SegmentedButton<int>(
              segments: const [ButtonSegment(value: 30, label: Text('30 fps')), ButtonSegment(value: 60, label: Text('60 fps'))],
              selected: {fps},
              onSelectionChanged: (s) => set(() => fps = s.first),
            ),
            SwitchListTile(title: const Text('ملف ترجمة SRT منفصل'), value: subtitles, onChanged: (v) => set(() => subtitles = v)),
            if (_plan == 'free') const Text('الباقة المجانية: 720p مع علامة مائية.', style: TextStyle(fontSize: 12)),
            const SizedBox(height: 8),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Padding(padding: EdgeInsets.all(12), child: Text('صدّر'))),
          ]),
        ),
      ),
    );
    if (go == true) await _startJob('export', {'resolution': resolution, 'fps': fps, 'include_subtitles': subtitles});
  }

  Future<void> _share() async {
    final assetId = (_export?['video_asset_id'] ?? _project?['preview_asset_id']) as String?;
    final url = await signedUrlForAsset(assetId);
    if (url == null) return;
    if (kIsWeb) {
      // In the browser: open the file in a new tab (play / download from there).
      await launchUrl(Uri.parse('$url&download=motioncut.mp4'), webOnlyWindowName: '_blank');
      return;
    }
    setState(() => _sharing = true);
    try {
      final client = HttpClient();
      final req = await client.getUrl(Uri.parse(url));
      final res = await req.close();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/motioncut_${DateTime.now().millisecondsSinceEpoch}.mp4');
      await res.pipe(file.openWrite());
      client.close();
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'video/mp4')], text: _project?['title'] as String?));
    } catch (e) {
      if (mounted) showSnack(context, 'تعذّر تحميل الفيديو: $e');
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final p = _player;
    return Scaffold(
      appBar: AppBar(title: Text((_project?['title'] as String?) ?? 'الفيديو')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (p != null)
          Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.6),
              child: AspectRatio(
                aspectRatio: p.value.aspectRatio,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: GestureDetector(
                    onTap: () => setState(() => p.value.isPlaying ? p.pause() : p.play()),
                    child: Stack(fit: StackFit.expand, children: [
                      VideoPlayer(p),
                      if (!p.value.isPlaying) const Center(child: Icon(Icons.play_circle_fill, size: 72, color: Colors.white70)),
                      Align(alignment: Alignment.bottomCenter, child: VideoProgressIndicator(p, allowScrubbing: true)),
                    ]),
                  ),
                ),
              ),
            ),
          )
        else
          const Card(child: Padding(padding: EdgeInsets.all(24), child: Text('لا توجد معاينة بعد.'))),
        const SizedBox(height: 16),
        if (_export != null)
          Card(
            color: cs.primaryContainer,
            child: ListTile(
              leading: const Icon(Icons.check_circle),
              title: Text('النسخة النهائية جاهزة · ${_export!['resolution']}'),
              subtitle: Text('${_export!['fps']} fps${_export!['has_watermark'] == true ? ' · علامة مائية' : ''}'),
            ),
          ),
        FilledButton.icon(
          onPressed: _sharing ? null : _share,
          icon: _sharing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.ios_share),
          label: Padding(padding: const EdgeInsets.all(12), child: Text(kIsWeb ? (_export != null ? 'تحميل النسخة النهائية' : 'تحميل المعاينة') : (_export != null ? 'حفظ / مشاركة النسخة النهائية' : 'حفظ / مشاركة المعاينة'))),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: _editScenes, icon: const Icon(Icons.edit_note), label: const Text('تعديل النصوص'))),
          const SizedBox(width: 10),
          Expanded(child: OutlinedButton.icon(onPressed: _restyle, icon: const Icon(Icons.palette_outlined), label: const Text('تغيير الشكل'))),
        ]),
        const SizedBox(height: 10),
        OutlinedButton.icon(onPressed: _exportSheet, icon: const Icon(Icons.high_quality), label: const Text('تصدير بجودة أعلى')),
      ]),
    );
  }
}
