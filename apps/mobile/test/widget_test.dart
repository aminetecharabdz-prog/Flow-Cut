import 'package:flutter_test/flutter_test.dart';
import 'package:motioncut/main.dart';

void main() {
  test('Supabase client config is always present', () {
    expect(supabaseUrl, startsWith('https://'));
    expect(supabaseKey, isNotEmpty);
  });
}
