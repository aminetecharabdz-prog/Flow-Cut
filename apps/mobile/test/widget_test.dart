import 'package:flutter_test/flutter_test.dart';
import 'package:motioncut/main.dart';

void main() {
  testWidgets('shows config message when Supabase keys are missing', (tester) async {
    await tester.pumpWidget(const MotionCutApp());
    await tester.pumpAndSettle();
    expect(find.textContaining('SUPABASE_URL'), findsOneWidget);
  });
}
