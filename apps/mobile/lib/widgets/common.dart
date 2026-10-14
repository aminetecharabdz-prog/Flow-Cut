import 'package:flutter/material.dart';

import '../options.dart';

/// Titled block used by every wizard step.
class Section extends StatelessWidget {
  const Section({super.key, required this.title, this.subtitle, required this.child, this.number});
  final String title;
  final String? subtitle;
  final Widget child;
  final int? number;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            if (number != null)
              Container(
                width: 26,
                height: 26,
                margin: const EdgeInsetsDirectional.only(end: 10),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: theme.colorScheme.primary, shape: BoxShape.circle),
                child: Text('$number', style: TextStyle(color: theme.colorScheme.onPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
              ),
            Expanded(child: Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
          ]),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(subtitle!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

/// Single-choice chips.
class ChipChoice extends StatelessWidget {
  const ChipChoice({super.key, required this.options, required this.value, required this.onChanged});
  final List<Opt> options;
  final String? value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final o in options)
          ChoiceChip(
            avatar: o.icon == null ? null : Icon(o.icon, size: 18),
            label: Text(o.label),
            selected: value == o.id,
            onSelected: (_) => onChanged(o.id),
          ),
      ],
    );
  }
}

/// Large selectable card with a title and a hint.
class OptionCard extends StatelessWidget {
  const OptionCard({super.key, required this.selected, required this.onTap, required this.title, this.hint, this.icon, this.leading});
  final bool selected;
  final VoidCallback onTap;
  final String title;
  final String? hint;
  final IconData? icon;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected ? cs.primaryContainer : cs.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: selected ? cs.primary : Colors.transparent, width: 2),
            ),
            child: Row(children: [
              ?leading,
              if (icon != null) Icon(icon, color: selected ? cs.primary : cs.onSurfaceVariant),
              if (icon != null || leading != null) const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                  if (hint != null) Text(hint!, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                ]),
              ),
              if (selected) Icon(Icons.check_circle, color: cs.primary),
            ]),
          ),
        ),
      ),
    );
  }
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

/// Row of colour swatches with an optional custom hex entry.
class ColorField extends StatelessWidget {
  const ColorField({super.key, required this.label, required this.color, required this.onChanged});
  final String label;
  final Color color;
  final ValueChanged<Color> onChanged;

  Future<void> _edit(BuildContext context) async {
    final ctrl = TextEditingController(text: colorToHex(color));
    final result = await showDialog<Color>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in const [
              Color(0xFFFFC83D), Color(0xFFFF4F7B), Color(0xFFD4A64A), Color(0xFF1E88E5), Color(0xFF22C55E), Color(0xFFE11D48),
              Color(0xFFA855F7), Color(0xFF22D3EE), Color(0xFFFF6B35), Color(0xFF111111), Color(0xFFFFFFFF), Color(0xFF0E1230),
            ])
              GestureDetector(
                onTap: () => Navigator.pop(ctx, c),
                child: Container(width: 36, height: 36, decoration: BoxDecoration(color: c, shape: BoxShape.circle, border: Border.all(color: Colors.white24))),
              ),
          ]),
          const SizedBox(height: 12),
          TextField(controller: ctrl, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'HEX (#RRGGBB)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, hexToColor(ctrl.text)), child: const Text('تم')),
        ],
      ),
    );
    if (result != null) onChanged(result);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _edit(context),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Column(children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white38, width: 2))),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12)),
        ]),
      ),
    );
  }
}
