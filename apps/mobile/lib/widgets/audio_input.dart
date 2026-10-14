import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../media.dart';
import '../services.dart';
import 'common.dart';

/// The chosen voice-over: a recording or an uploaded audio/video file.
class AudioSource {
  AudioSource(this.media, this.durationMs, {required this.recorded});
  final LocalMedia media;
  final int durationMs;
  final bool recorded;
  bool get isVideo => media.isVideo;
}

const _maxMs = 180000;
const _minMs = 5000;

class AudioInput extends StatefulWidget {
  const AudioInput({super.key, required this.value, required this.onChanged});
  final AudioSource? value;
  final ValueChanged<AudioSource?> onChanged;

  @override
  State<AudioInput> createState() => _AudioInputState();
}

class _AudioInputState extends State<AudioInput> {
  final _recorder = AudioRecorder();
  Timer? _timer;
  bool _recording = false;
  bool _paused = false;
  int _elapsedMs = 0;
  bool _loading = false;

  @override
  void dispose() {
    _timer?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) {
      if (mounted) showSnack(context, 'اسمح للتطبيق باستعمال الميكروفون من الإعدادات.');
      return;
    }
    // Browsers record Opus/WebM; phones record AAC/M4A.
    final path = kIsWeb ? '' : '${(await getTemporaryDirectory()).path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(
      RecordConfig(encoder: kIsWeb ? AudioEncoder.opus : AudioEncoder.aacLc, bitRate: 128000, sampleRate: 48000, numChannels: 1),
      path: path,
    );
    widget.onChanged(null);
    setState(() {
      _recording = true;
      _paused = false;
      _elapsedMs = 0;
    });
    _timer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (_paused) return;
      setState(() => _elapsedMs += 200);
      if (_elapsedMs >= _maxMs) _stop();
    });
  }

  Future<void> _togglePause() async {
    if (_paused) {
      await _recorder.resume();
    } else {
      await _recorder.pause();
    }
    setState(() => _paused = !_paused);
  }

  Future<void> _stop() async {
    _timer?.cancel();
    final path = await _recorder.stop();
    setState(() => _recording = false);
    if (path == null) return;
    if (_elapsedMs < _minMs) {
      if (mounted) showSnack(context, 'التسجيل قصير جداً، 5 ثواني على الأقل.');
      return;
    }
    final media = await LocalMedia.fromRecording(path, kIsWeb ? 'voice.webm' : 'voice.m4a');
    widget.onChanged(AudioSource(media, _elapsedMs, recorded: true));
  }

  Future<void> _pick() async {
    setState(() => _loading = true);
    try {
      final files = await pickMedia(FileType.custom, extensions: const ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'webm', 'mp4', 'mov']);
      if (files.isEmpty) return;
      final media = files.first;
      if (media.bytes.length > 50 * 1024 * 1024) {
        if (mounted) showSnack(context, 'الملف أكبر من 50 ميغا.');
        return;
      }
      final ms = await mediaDurationMs(media);
      if (ms < _minMs || ms > _maxMs) {
        if (mounted) showSnack(context, 'مدة الصوت يجب أن تكون بين 5 ثواني و3 دقائق.');
        return;
      }
      widget.onChanged(AudioSource(media, ms, recorded: false));
    } catch (_) {
      if (mounted) showSnack(context, 'تعذّر قراءة هذا الملف.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final v = widget.value;
    if (_recording) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.fiber_manual_record, color: _paused ? cs.outline : Colors.red),
              const SizedBox(width: 8),
              Text(formatSeconds(_elapsedMs ~/ 1000), style: Theme.of(context).textTheme.headlineMedium),
              Text(' / 3:00', style: TextStyle(color: cs.onSurfaceVariant)),
            ]),
            const SizedBox(height: 8),
            LinearProgressIndicator(value: _elapsedMs / _maxMs),
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              OutlinedButton.icon(onPressed: _togglePause, icon: Icon(_paused ? Icons.play_arrow : Icons.pause), label: Text(_paused ? 'استئناف' : 'إيقاف مؤقت')),
              const SizedBox(width: 12),
              FilledButton.icon(onPressed: _stop, icon: const Icon(Icons.stop), label: const Text('إنهاء')),
            ]),
          ]),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (v != null)
        Card(
          color: cs.primaryContainer,
          child: ListTile(
            leading: Icon(v.isVideo ? Icons.videocam : (v.recorded ? Icons.mic : Icons.audio_file)),
            title: Text(v.recorded ? 'تسجيل صوتي' : v.media.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text('المدة ${formatSeconds(v.durationMs ~/ 1000)}${v.isVideo ? ' · فيديو' : ''}'),
            trailing: IconButton(icon: const Icon(Icons.close), onPressed: () => widget.onChanged(null)),
          ),
        ),
      Row(children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: _loading ? null : _start,
            icon: const Icon(Icons.mic),
            label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('سجّل الآن')),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _loading ? null : _pick,
            icon: _loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.upload_file),
            label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('ارفع ملف')),
          ),
        ),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text('MP3 · M4A · WAV أو فيديو MP4 · MOV — من 5 ثواني إلى 3 دقائق', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
      ),
    ]);
  }
}
