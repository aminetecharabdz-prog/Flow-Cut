import 'dart:io';

import 'package:cross_file/cross_file.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';

import 'services.dart';

/// A file picked or recorded on the device, held in memory so it works the
/// same on Android, iOS and the web.
class LocalMedia {
  LocalMedia({required this.name, required this.bytes, this.source});

  /// File name with extension (decides the upload's content type).
  final String name;
  final Uint8List bytes;

  /// Local path on mobile, blob/object URL on the web (used for playback).
  final String? source;

  String get mime => mimeOf(name);
  bool get isVideo => mime.startsWith('video/');
  bool get isImage => mime.startsWith('image/');

  static Future<LocalMedia> fromPicked(PlatformFile f) async {
    final xfile = f.xFile;
    return LocalMedia(name: f.name, bytes: await xfile.readAsBytes(), source: kIsWeb ? xfile.path : f.path);
  }

  /// Recorder output: a file path on mobile, a blob URL on the web.
  static Future<LocalMedia> fromRecording(String pathOrUrl, String name) async =>
      LocalMedia(name: name, bytes: await XFile(pathOrUrl).readAsBytes(), source: pathOrUrl);
}

/// Pick files of a type; returns them loaded in memory.
Future<List<LocalMedia>> pickMedia(FileType type, {List<String>? extensions}) async {
  final files = await FilePicker.pickFiles(type: type, allowedExtensions: extensions);
  return Future.wait(files.map(LocalMedia.fromPicked));
}

/// Read a media file's duration with the platform player.
Future<int> mediaDurationMs(LocalMedia m) async {
  final VideoPlayerController c;
  if (kIsWeb) {
    final src = m.source;
    c = VideoPlayerController.networkUrl(
      src != null && src.isNotEmpty ? Uri.parse(src) : Uri.dataFromBytes(m.bytes, mimeType: m.mime),
    );
  } else {
    c = VideoPlayerController.file(File(m.source!));
  }
  try {
    await c.initialize();
    return c.value.duration.inMilliseconds;
  } finally {
    await c.dispose();
  }
}
