import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient get supabase => Supabase.instance.client;

String get currentUserId => supabase.auth.currentUser!.id;

/// Raised for user-facing failures; [code] matches server hints.
class AppException implements Exception {
  AppException(this.message, {this.code});
  final String message;
  final String? code;
  @override
  String toString() => message;
}

const _mimeByExt = {
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'webm': 'video/webm',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'heic': 'image/heic',
  'svg': 'image/svg+xml',
};

String extOf(String path) {
  final i = path.lastIndexOf('.');
  return i < 0 ? 'bin' : path.substring(i + 1).toLowerCase();
}

String mimeOf(String path) => _mimeByExt[extOf(path)] ?? 'application/octet-stream';

bool isVideoFile(String path) => mimeOf(path).startsWith('video/');

/// Upload a local file under `<user>/<project>/<name>` and register it as an asset.
Future<String> uploadAsset({
  required String projectId,
  required File file,
  required String bucket,
  required String kind,
  required String name,
  int? durationMs,
}) async {
  final path = '$currentUserId/$projectId/$name.${extOf(file.path)}';
  final mime = mimeOf(file.path);
  await supabase.storage.from(bucket).upload(path, file, fileOptions: FileOptions(contentType: mime, upsert: true));
  final row = await supabase
      .from('assets')
      .upsert({
        'project_id': projectId,
        'kind': kind,
        'bucket': bucket,
        'path': path,
        'mime_type': mime,
        'size_bytes': await file.length(),
        'duration_ms': ?durationMs,
      }, onConflict: 'bucket,path')
      .select('id')
      .single();
  return row['id'] as String;
}

/// Calls the `generate` function (queues the job and wakes the worker).
Future<Map<String, dynamic>> requestJob(String projectId, String action, [Map<String, dynamic> extra = const {}]) async {
  try {
    final res = await supabase.functions.invoke('generate', body: {'action': action, 'project_id': projectId, ...extra});
    final data = Map<String, dynamic>.from(res.data as Map);
    return data;
  } on FunctionException catch (e) {
    final details = e.details;
    if (details is Map) {
      throw AppException('${details['error'] ?? 'خطأ غير معروف'}', code: details['code'] as String?);
    }
    throw AppException('تعذّر بدء العملية (${e.status})');
  }
}

Future<String?> signedUrlForAsset(String? assetId) async {
  if (assetId == null) return null;
  final a = await supabase.from('assets').select('bucket, path').eq('id', assetId).maybeSingle();
  if (a == null) return null;
  return supabase.storage.from(a['bucket'] as String).createSignedUrl(a['path'] as String, 3600);
}

Future<int> creditBalanceSeconds() async => (await supabase.rpc('get_credit_balance') as num).toInt();

Future<String> currentPlan() async {
  final p = await supabase.from('profiles').select('plan').eq('id', currentUserId).maybeSingle();
  return (p?['plan'] as String?) ?? 'free';
}

String formatSeconds(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
