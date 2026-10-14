import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../media.dart';
import '../options.dart';
import '../services.dart';
import '../widgets/audio_input.dart';
import '../widgets/common.dart';
import 'progress_screen.dart';

/// Three-step creation flow: project -> studio -> style, then generate.
class WizardScreen extends StatefulWidget {
  const WizardScreen({super.key});

  @override
  State<WizardScreen> createState() => _WizardScreenState();
}

class _WizardScreenState extends State<WizardScreen> {
  final _pages = PageController();
  int _step = 0;
  bool _busy = false;
  String _busyLabel = '';

  // Step 1 - project
  final _title = TextEditingController();
  final _business = TextEditingController();
  String _businessType = 'ecommerce';
  String _goal = 'content_marketing';
  String _videoType = 'motion_graphics';
  LocalMedia? _logo;
  Color _primary = const Color(0xFFFFC83D);
  Color _secondary = const Color(0xFFFF4F7B);
  Color _background = const Color(0xFF0E1230);
  bool _customColors = false;

  // Step 2 - studio
  AudioSource? _audio;
  String _audioLang = 'auto';
  String _captionLang = 'same';
  String _script = 'arabic';
  final _idea = TextEditingController();
  final List<LocalMedia> _productImages = [];
  final List<LocalMedia> _media = [];
  final _productName = TextEditingController();
  final _price = TextEditingController();
  final _oldPrice = TextEditingController();
  final _offer = TextEditingController();

  // Step 3 - style
  String _style = 'vivid';
  String? _font;
  String _captionMode = 'word_box';
  String _pace = 'medium';
  String _aspect = '9:16';
  bool _sfx = true;
  LocalMedia? _music;
  final _handle = TextEditingController();
  final _phone = TextEditingController();
  final _website = TextEditingController();
  final _button = TextEditingController();

  @override
  void dispose() {
    for (final c in [_title, _business, _idea, _productName, _price, _oldPrice, _offer, _handle, _phone, _website, _button]) {
      c.dispose();
    }
    _pages.dispose();
    super.dispose();
  }

  Future<LocalMedia?> _pickOne(FileType type) async {
    final files = await pickMedia(type);
    return files.isEmpty ? null : files.first;
  }

  bool _validateStep(int step) {
    if (step == 1 && _audio == null) {
      showSnack(context, 'أضف التعليق الصوتي: سجّل أو ارفع ملفاً.');
      return false;
    }
    if (step == 1 && _videoType == 'talking_head' && !(_audio?.isVideo ?? false)) {
      showSnack(context, 'نوع "شخص يتكلم" يحتاج فيديو للمتحدث بدل ملف صوتي.');
      return false;
    }
    if (step == 1 && _videoType == 'media_montage' && _media.isEmpty) {
      showSnack(context, 'أضف بعض الصور أو المقاطع للمونتاج.');
      return false;
    }
    return true;
  }

  void _next() {
    if (!_validateStep(_step)) return;
    if (_step < 2) {
      setState(() => _step++);
      _pages.animateToPage(_step, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    } else {
      _generate();
    }
  }

  void _back() {
    if (_step == 0) {
      Navigator.pop(context);
      return;
    }
    setState(() => _step--);
    _pages.animateToPage(_step, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
  }

  String? _t(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _generate() async {
    final audio = _audio!;
    setState(() {
      _busy = true;
      _busyLabel = 'إنشاء المشروع...';
    });
    try {
      final style = styles.firstWhere((s) => s.id == _style);
      final colors = _customColors
          ? {'primary': colorToHex(_primary), 'secondary': colorToHex(_secondary), 'background': colorToHex(_background)}
          : <String, String>{};
      final product = _goal == 'product_ad'
          ? {'name': _t(_productName), 'price': _t(_price), 'oldPrice': _t(_oldPrice), 'offer': _t(_offer)}
          : null;
      final endCard = {'handle': _t(_handle), 'phone': _t(_phone), 'website': _t(_website), 'buttonText': _t(_button)};
      final project = await supabase
          .from('projects')
          .insert({
            'title': _t(_title) ?? _t(_business) ?? 'فيديو جديد',
            'business_name': _t(_business),
            'business_type': _businessType,
            'goal': _goal,
            'video_type': _videoType,
            'idea': _t(_idea),
            'audio_language': _audioLang == 'auto' ? null : _audioLang,
            'caption_language': _captionLang == 'same' ? null : _captionLang,
            'caption_script': _script,
            'template_id': style.id,
            'font_id': _font,
            'palette': colors,
            'pace': _pace,
            'caption_mode': _captionMode,
            'aspect_ratio': _aspect,
            'sfx': _sfx,
            'music_mode': _music == null ? 'none' : 'music',
            'product': product,
            'end_card': endCard.values.any((v) => v != null) ? endCard : null,
          })
          .select('id')
          .single();
      final pid = project['id'] as String;

      setState(() => _busyLabel = 'رفع التعليق الصوتي...');
      final audioId = await uploadAsset(
        projectId: pid,
        media: audio.media,
        bucket: 'audio',
        kind: audio.isVideo ? 'source_video' : 'source_audio',
        name: 'source',
        durationMs: audio.durationMs,
      );
      await supabase.from('projects').update({'source_audio_id': audioId}).eq('id', pid);

      if (_logo != null) {
        setState(() => _busyLabel = 'رفع الشعار...');
        await uploadAsset(projectId: pid, media: _logo!, bucket: 'brand', kind: 'logo', name: 'logo');
      }
      for (var i = 0; i < _productImages.length; i++) {
        setState(() => _busyLabel = 'رفع صور المنتج ${i + 1}/${_productImages.length}...');
        await uploadAsset(projectId: pid, media: _productImages[i], bucket: 'product-images', kind: 'product_image', name: 'product_$i');
      }
      for (var i = 0; i < _media.length; i++) {
        setState(() => _busyLabel = 'رفع الصور والمقاطع ${i + 1}/${_media.length}...');
        final f = _media[i];
        await uploadAsset(projectId: pid, media: f, bucket: 'product-images', kind: f.isVideo ? 'media_video' : 'media_image', name: 'media_$i');
      }
      if (_music != null) {
        setState(() => _busyLabel = 'رفع الموسيقى...');
        await uploadAsset(projectId: pid, media: _music!, bucket: 'audio', kind: 'music', name: 'music');
      }

      setState(() => _busyLabel = 'بدء التوليد...');
      final res = await requestJob(pid, 'generate');
      if (!mounted) return;
      final job = Map<String, dynamic>.from(res['job'] as Map);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => ProgressScreen(projectId: pid, jobId: job['id'] as String, workerWoken: res['dispatched'] == true)),
      );
    } on AppException catch (e) {
      if (mounted) showSnack(context, friendlyError(e.code, e.message));
    } catch (e) {
      if (mounted) showSnack(context, 'حدث خطأ: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const titles = ['المشروع', 'الاستوديو', 'الأسلوب'];
    return PopScope(
      canPop: _step == 0 && !_busy,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_busy) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('فيديو جديد · ${titles[_step]}'),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(6),
            child: LinearProgressIndicator(value: (_step + 1) / 3),
          ),
        ),
        body: Stack(children: [
          PageView(
            controller: _pages,
            physics: const NeverScrollableScrollPhysics(),
            children: [_projectStep(), _studioStep(), _styleStep()],
          ),
          if (_busy)
            Container(
              color: Colors.black54,
              alignment: Alignment.center,
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 16),
                    Text(_busyLabel),
                  ]),
                ),
              ),
            ),
        ]),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Row(children: [
              OutlinedButton(onPressed: _busy ? null : _back, child: Text(_step == 0 ? 'إلغاء' : 'رجوع')),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _busy ? null : _next,
                  icon: Icon(_step == 2 ? Icons.auto_awesome : Icons.arrow_back),
                  label: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text(_step == 2 ? 'ولّد الفيديو' : 'التالي'),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _page(List<Widget> children) => ListView(padding: const EdgeInsets.fromLTRB(16, 20, 16, 40), children: children);

  // ---------------------------------------------------------------- Step 1
  Widget _projectStep() {
    return _page([
      Section(
        number: 1,
        title: 'المشروع',
        subtitle: 'الاسم يظهر في الفيديو، ونوع النشاط يوجّه المونتاج.',
        child: Column(children: [
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'عنوان الفيديو (اختياري)', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: _business, decoration: const InputDecoration(labelText: 'اسم المشروع أو العلامة', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          ChipChoice(options: businessTypes, value: _businessType, onChanged: (v) => setState(() => _businessType = v)),
        ]),
      ),
      Section(
        number: 2,
        title: 'هدف الفيديو',
        subtitle: 'الهدف يحدد بنية الفيديو وإيقاعه.',
        child: Column(children: [
          for (final g in goals)
            OptionCard(selected: _goal == g.id, onTap: () => setState(() => _goal = g.id), title: g.label, hint: g.hint),
        ]),
      ),
      Section(
        number: 3,
        title: 'نوع الفيديو',
        child: Column(children: [
          for (final t in videoTypes)
            OptionCard(selected: _videoType == t.id, onTap: () => setState(() => _videoType = t.id), title: t.label, hint: t.hint, icon: t.icon),
        ]),
      ),
      Section(
        number: 4,
        title: 'الشعار والألوان',
        subtitle: 'اختر ألوانك أو اترك ألوان الأسلوب.',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            OutlinedButton.icon(
              onPressed: () async {
                final f = await _pickOne(FileType.image);
                if (f != null) setState(() => _logo = f);
              },
              icon: const Icon(Icons.image_outlined),
              label: Text(_logo == null ? 'ارفع الشعار' : 'تغيير الشعار'),
            ),
            if (_logo != null) ...[
              const SizedBox(width: 12),
              ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.memory(_logo!.bytes, width: 44, height: 44, fit: BoxFit.cover)),
              IconButton(onPressed: () => setState(() => _logo = null), icon: const Icon(Icons.close)),
            ],
          ]),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('أستعمل ألواني الخاصة'),
            value: _customColors,
            onChanged: (v) => setState(() => _customColors = v),
          ),
          if (_customColors) ...[
            SizedBox(
              height: 48,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                for (final p in palettes)
                  GestureDetector(
                    onTap: () => setState(() {
                      _primary = p[0];
                      _secondary = p[1];
                      _background = p[2];
                    }),
                    child: Container(
                      margin: const EdgeInsetsDirectional.only(end: 10),
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: p[2], borderRadius: BorderRadius.circular(24), border: Border.all(color: Colors.white24)),
                      child: Row(children: [
                        for (final c in p.take(2))
                          Container(width: 28, height: 28, margin: const EdgeInsets.symmetric(horizontal: 2), decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
                      ]),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              ColorField(label: 'الأساسي', color: _primary, onChanged: (c) => setState(() => _primary = c)),
              ColorField(label: 'الثانوي', color: _secondary, onChanged: (c) => setState(() => _secondary = c)),
              ColorField(label: 'الخلفية', color: _background, onChanged: (c) => setState(() => _background = c)),
            ]),
          ],
        ]),
      ),
    ]);
  }

  // ---------------------------------------------------------------- Step 2
  Widget _studioStep() {
    return _page([
      Section(
        number: 1,
        title: 'التعليق الصوتي',
        subtitle: _videoType == 'talking_head' ? 'ارفع فيديو المتحدث (الصوت يُستخرج منه).' : 'سجّل صوتك أو ارفع ملفاً صوتياً أو فيديو.',
        child: AudioInput(value: _audio, onChanged: (a) => setState(() => _audio = a)),
      ),
      Section(
        number: 2,
        title: 'اللغة',
        child: Column(children: [
          DropdownButtonFormField<String>(
            initialValue: _audioLang,
            decoration: const InputDecoration(labelText: 'لغة الصوت', border: OutlineInputBorder()),
            items: [for (final l in languages) DropdownMenuItem(value: l.id, child: Text(l.label))],
            onChanged: (v) => setState(() => _audioLang = v ?? 'auto'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _captionLang,
            decoration: const InputDecoration(labelText: 'لغة النص الظاهر', border: OutlineInputBorder()),
            items: [
              const DropdownMenuItem(value: 'same', child: Text('نفس لغة الصوت')),
              for (final l in languages.skip(1)) DropdownMenuItem(value: l.id, child: Text(l.label)),
            ],
            onChanged: (v) => setState(() => _captionLang = v ?? 'same'),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'arabic', label: Text('حروف عربية')),
              ButtonSegment(value: 'latin', label: Text('حروف لاتينية')),
            ],
            selected: {_script},
            onSelectionChanged: (s) => setState(() => _script = s.first),
          ),
        ]),
      ),
      if (_goal == 'product_ad')
        Section(
          number: 3,
          title: 'المنتج',
          subtitle: 'صور المنتج (حتى 10) والسعر والعرض.',
          child: Column(children: [
            _thumbRow(_productImages, () async {
              final picked = await pickMedia(FileType.image);
              setState(() => _productImages.addAll(picked.take(10 - _productImages.length)));
            }),
            const SizedBox(height: 12),
            TextField(controller: _productName, decoration: const InputDecoration(labelText: 'اسم المنتج', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: _price, decoration: const InputDecoration(labelText: 'السعر (مثلاً 2900 دج)', border: OutlineInputBorder()))),
              const SizedBox(width: 10),
              Expanded(child: TextField(controller: _oldPrice, decoration: const InputDecoration(labelText: 'السعر القديم', border: OutlineInputBorder()))),
            ]),
            const SizedBox(height: 12),
            TextField(controller: _offer, decoration: const InputDecoration(labelText: 'شارة العرض (مثلاً -30%)', border: OutlineInputBorder())),
          ]),
        ),
      if (_videoType == 'media_montage' || _goal != 'product_ad')
        Section(
          number: _goal == 'product_ad' ? 4 : 3,
          title: 'الصور والمقاطع',
          subtitle: _videoType == 'media_montage' ? 'مطلوب للمونتاج: صور ومقاطع قصيرة.' : 'اختياري: صور أو مقاطع تظهر في بعض المشاهد.',
          child: _thumbRow(_media, () async {
            final picked = await pickMedia(FileType.media);
            setState(() => _media.addAll(picked.take(20 - _media.length)));
          }),
        ),
      Section(
        title: 'الفكرة',
        subtitle: 'اختياري: اشرح الفكرة أو المشكلة التي يحلها الفيديو ليفهم المونتير الذكي السياق.',
        child: TextField(controller: _idea, maxLines: 4, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'مثلاً: أصحاب المشاريع يضيعون وقتاً طويلاً في المونتاج...')),
      ),
    ]);
  }

  Widget _thumbRow(List<LocalMedia> files, VoidCallback onAdd) {
    return SizedBox(
      height: 84,
      child: ListView(scrollDirection: Axis.horizontal, children: [
        InkWell(
          onTap: onAdd,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: 84,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Theme.of(context).colorScheme.outline)),
            child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.add_photo_alternate_outlined), Text('إضافة', style: TextStyle(fontSize: 12))]),
          ),
        ),
        for (var i = 0; i < files.length; i++)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 8),
            child: Stack(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: files[i].isVideo
                    ? Container(width: 84, height: 84, color: Colors.black26, child: const Icon(Icons.movie))
                    : Image.memory(files[i].bytes, width: 84, height: 84, fit: BoxFit.cover),
              ),
              Positioned(
                top: 2,
                left: 2,
                child: InkWell(
                  onTap: () => setState(() => files.removeAt(i)),
                  child: const CircleAvatar(radius: 11, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 14, color: Colors.white)),
                ),
              ),
            ]),
          ),
      ]),
    );
  }

  // ---------------------------------------------------------------- Step 3
  Widget _styleStep() {
    return _page([
      Section(
        number: 1,
        title: 'أسلوب المونتاج',
        subtitle: 'الأسلوب يحدد الحركة والانتقالات، والمشاهد نفسها تتغير حسب محتوى كلامك.',
        child: GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.62,
          children: [for (final s in styles) _styleCard(s)],
        ),
      ),
      Section(
        number: 2,
        title: 'خط العناوين',
        subtitle: 'تلقائي حسب الأسلوب، أو اختر خطاً.',
        child: SizedBox(
          height: 86,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            _fontCard(null, 'تلقائي', null),
            for (final f in headingFonts) _fontCard(f.id, f.label, f.family),
          ]),
        ),
      ),
      Section(
        number: 3,
        title: 'شكل الكابشن',
        child: Column(children: [
          for (final c in captionModes)
            OptionCard(selected: _captionMode == c.id, onTap: () => setState(() => _captionMode = c.id), title: c.label, hint: c.hint),
        ]),
      ),
      Section(
        number: 4,
        title: 'الإيقاع',
        child: Row(children: [
          for (final p in paces)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: OptionCard(selected: _pace == p.id, onTap: () => setState(() => _pace = p.id), title: p.label, hint: p.hint),
              ),
            ),
        ]),
      ),
      Section(
        number: 5,
        title: 'المقاس',
        child: Column(children: [
          for (final a in aspects) OptionCard(selected: _aspect == a.id, onTap: () => setState(() => _aspect = a.id), title: a.label, hint: a.hint),
        ]),
      ),
      Section(
        number: 6,
        title: 'الصوت',
        child: Column(children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('مؤثرات صوتية مع الحركات'),
            subtitle: const Text('Whoosh · Pop'),
            value: _sfx,
            onChanged: (v) => setState(() => _sfx = v),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.music_note),
            title: Text(_music == null ? 'بدون موسيقى خلفية' : _music!.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: const Text('ارفع موسيقى مرخّصة لك، وتنخفض تلقائياً أثناء الكلام'),
            trailing: _music == null
                ? TextButton(
                    onPressed: () async {
                      final f = await _pickOne(FileType.audio);
                      if (f != null) setState(() => _music = f);
                    },
                    child: const Text('إضافة'))
                : IconButton(onPressed: () => setState(() => _music = null), icon: const Icon(Icons.close)),
          ),
        ]),
      ),
      Section(
        number: 7,
        title: 'كرت النهاية',
        subtitle: 'آخر ما يشوفه الزبون: كيفاش يتواصل معاك. اتركه فارغاً إن لم تحتجه.',
        child: Column(children: [
          TextField(controller: _handle, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'الحساب (@...)', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: _phone, textDirection: TextDirection.ltr, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'الهاتف', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: _website, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'الموقع', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: _button, decoration: const InputDecoration(labelText: 'نص الزر (مثلاً: اطلب الآن)', border: OutlineInputBorder())),
        ]),
      ),
    ]);
  }

  Widget _styleCard(StyleOpt s) {
    final selected = _style == s.id;
    final cs = Theme.of(context).colorScheme;
    final primary = _customColors ? _primary : s.primary;
    final bg = _customColors ? _background : s.bg;
    final fg = bg.computeLuminance() > 0.45 ? Colors.black : Colors.white;
    return GestureDetector(
      onTap: () => setState(() => _style = s.id),
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? cs.primary : Colors.white12, width: selected ? 3 : 1),
        ),
        padding: const EdgeInsets.all(10),
        child: Column(children: [
          Expanded(
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text('أهلاً بيك', style: TextStyle(fontFamily: s.font, color: fg, fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(s.id == 'poster' ? 0 : 8)),
                  child: Text('مايك إيت', style: TextStyle(fontFamily: s.font, color: primary.computeLuminance() > 0.45 ? Colors.black : Colors.white, fontSize: 14)),
                ),
              ]),
            ),
          ),
          Text(s.label, style: TextStyle(color: fg, fontWeight: FontWeight.w800)),
          Text(s.hint, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(color: fg.withValues(alpha: 0.7), fontSize: 10)),
        ]),
      ),
    );
  }

  Widget _fontCard(String? id, String label, String? family) {
    final selected = _font == id;
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: InkWell(
        onTap: () => setState(() => _font = id),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: 96,
          decoration: BoxDecoration(
            color: selected ? cs.primaryContainer : cs.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? cs.primary : Colors.transparent, width: 2),
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(family == null ? 'Aa' : 'أهلاً فيك', style: TextStyle(fontFamily: family, fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
          ]),
        ),
      ),
    );
  }
}
