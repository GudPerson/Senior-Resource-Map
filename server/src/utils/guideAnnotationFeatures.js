import { normalizeRole } from './roles.js';

const route = '/my-directory?section=my-maps';
const reviewed = '2026-10-08';
const ids = { image: 'map-private-image-annotations', tags: 'map-annotation-resource-links', privacy: 'map-annotation-private-sharing-boundary', boundaries: 'map-private-kml-boundaries', gestures: 'map-viewing-gestures' };
const copy = {
    en: {
        gesturesTitle: "Zoom and rotate your Care Map",
        gestures: "On a Care Map you own, pinch with two fingers to zoom and twist them to rotate. With a mouse, use the wheel to zoom and hold the right button while dragging to rotate. On a trackpad, pinch to zoom or hold Shift while scrolling with two fingers to rotate. You can also use Rotate left, Rotate right and Reset to north. Rotation works in Full map too. The viewing angle is temporary and does not change saved coordinates. Annotation editing and personal-place placement return the map to north-up. PNG/PDF exports, shared maps and website embeds remain north-up.",
        boundariesTitle: 'Import KML boundaries into a Care Map',
        boundaries: 'Open a Care Map you own on a desktop with a fine pointer. Choose Edit content → Annotate → Import boundaries → Choose KML file. Select a .kml file up to 2 MB. Preview the named areas and select the boundaries to add; expand Adjust appearance to change outline and fill colours, outline width and opacity. Choose Add selected boundaries, then wait for Saved. Cancel leaves your map unchanged; Undo removes the complete import in one step. Exact source corners are retained. Use Edit layout → Annotations to show or hide individual boundaries. Multipart polygons and holes are supported, with up to 1,000 corners per polygon part including its holes, within the 20,000 stored-point map limit. No corners are simplified. Pins, resources, mixed geometry, non-zero altitude, descriptions and external links are excluded; KMZ is not supported yet. Imports remain private and are excluded from shared links and website embeds. Visible saved boundaries can appear in owner PNG/PDF downloads. Importing someone’s drawing does not verify it as an official or current boundary.',
        imageTitle: 'Add a private image to your Care Map', tagsTitle: 'Link an annotation to map resources', privacyTitle: 'Image and resource-link privacy', open: 'Open Care Maps', signIn: 'Sign in to continue',
        image: 'Sign in and open a Care Map you own on a desktop with a fine pointer. Choose Edit content → Annotate → Add image and select a PNG, JPEG or WebP. Click the map to place it. Choose Move annotation and drag its centre handle to move it; drag a corner to resize while keeping its proportions. Images have no border by default; select the image and enable Show border when needed. Add an image description and wait for Saved. Undo reverses a completed edit. Your account allows up to 20 uploaded images and 20 MB across your maps.',
        tags: 'On a Care Map you own, choose Edit content → Annotate, select an annotation and choose Tag Resources. Select resources already in that map, then choose Behaviour: Appear shows a linked annotation; Pulse runs briefly; Highlight gives a steady glow. Hover over a linked card to activate its visible annotations; hover over an annotation to identify its linked cards. Keyboard focus does the same. On touch, use Show linked annotation or tap an annotation, then Clear linked selection. Hover ends when you leave; keyboard focus stays active until focus moves away. For Pulse or Highlight, choose Glow colour; the default is bright pin orange, and Use pin orange resets it. Reduced motion uses a steady glow. A programme applies to its cards at every map location. Saved-view hidden annotations stay hidden. Wait for Saved after editing links, behaviour or colour.',
        privacy: 'Images and annotation resource links are owner-private and are excluded from shared links and website embeds. Share this annotation and Include annotations apply only to shareable drawing shapes; their existing explicit publishing rules still apply. Owner PNG/PDF downloads can include private images, so review a download before sending it. Downloads are static: temporary selection and pulse effects are not saved or exported.',
    },
    'zh-CN': {
        gesturesTitle: "缩放和旋转关怀地图",
        gestures: "在自己拥有的关怀地图中，双指捏合可缩放，双指扭转可旋转。使用鼠标时，滚轮可缩放，按住右键拖动可旋转。使用触控板时，捏合可缩放，按住 Shift 并双指滚动可旋转。也可使用向左旋转、向右旋转及恢复北向上。全屏地图同样支持旋转。浏览角度是临时的，不会改变保存的坐标。编辑标注或放置个人地点时，地图恢复北向上。PNG/PDF 导出、共享地图和网站嵌入保持北向上。",
        boundariesTitle: '将 KML 边界导入关怀地图',
        boundaries: '在配有精细指针的桌面设备上打开自己的关怀地图。选择编辑内容 → 添加标注 → 导入边界 → 选择 KML 文件。选择最大 2 MB 的 .kml 文件。预览具名区域并勾选所需边界；展开调整外观来更改边线和填充颜色、边线宽度及不透明度。选择添加所选边界并等待 Saved。取消不会更改地图；Undo 可一次撤销整个导入。原始角点会完整保留。使用编辑布局 → 标注显示或隐藏各个边界。支持多部分多边形和内部空洞，每部分连同空洞最多 1,000 个角点；地图总上限为 20,000 个存储点。不会简化角点。不会导入图钉、资源、混合几何、非零高度、说明或外部链接；暂不支持 KMZ。导入内容保持私密，不会加入共享链接或网站嵌入。可见且已保存的边界可加入所有者的 PNG/PDF 下载。导入他人的绘图不代表已核实其为官方或最新边界。',
        imageTitle: '在关怀地图中添加私人图片', tagsTitle: '将标注关联到地图资源', privacyTitle: '图片和资源关联的隐私', open: '打开关怀地图', signIn: '登录以继续',
        image: '登录后，在配有鼠标等精细指针的桌面设备上打开自己拥有的关怀地图。选择编辑内容 → 添加标注 → 添加图片，然后选择 PNG、JPEG 或 WebP。在地图上点击以放置图片。选择“Move annotation”，拖动中心控制点以移动图片；拖动角点可按比例调整大小。图片默认没有边框；选中图片后，可启用“显示边框”。添加图片说明并等待 Saved。Undo 可撤销已完成的编辑。账户在所有地图中合计最多可上传 20 张图片、20 MB。',
        tags: '在自己的关怀地图中选择编辑内容 → 添加标注，选中标注并选择关联资源。勾选此地图中的资源，再选择效果：显示会显示关联标注；闪动会短暂闪动；突出显示会保持光圈。悬停在关联卡片上会激活可见标注，悬停在标注上会标识关联卡片。键盘焦点有同样效果。触屏可使用“显示关联标注”或轻触标注，再用“清除关联选择”清除。离开会结束悬停效果；键盘焦点移开后才结束焦点效果。闪动或突出显示时可选择光圈颜色；默认是明亮的图钉橙色，“使用图钉橙色”可恢复。减少动态效果时保持稳定光圈。活动在此地图所有地点的卡片都会关联。保存视图中隐藏的标注保持隐藏。编辑关联、效果或颜色后请等待 Saved。',
        privacy: '图片和标注的资源关联仅供地图所有者使用，不会加入共享链接或网站嵌入。Share this annotation 和 Include annotations 仅适用于可共享的绘图形状，仍须按现有规则明确发布。所有者的 PNG/PDF 下载可能包含私人图片，发送前请检查文件。下载为静态内容，不会保存或导出临时选择和闪动效果。',
    },
    ms: {
        gesturesTitle: "Zum dan putar Peta Penjagaan",
        gestures: "Pada Peta Penjagaan milik anda, cubit dengan dua jari untuk zum dan putar kedua-duanya untuk memutar peta. Dengan tetikus, gunakan roda untuk zum dan tahan butang kanan sambil menyeret untuk memutar. Pada pad jejak, cubit untuk zum atau tahan Shift sambil menatal dengan dua jari untuk memutar. Anda juga boleh menggunakan Putar ke kiri, Putar ke kanan dan Kembali ke utara. Putaran juga berfungsi dalam Peta penuh. Sudut paparan adalah sementara dan tidak mengubah koordinat tersimpan. Penyuntingan anotasi dan peletakan tempat peribadi mengembalikan peta ke utara. Eksport PNG/PDF, peta kongsi dan benaman laman web kekal menghadap utara.",
        boundariesTitle: 'Import sempadan KML ke Peta Penjagaan',
        boundaries: 'Buka Peta Penjagaan milik anda pada desktop dengan penuding halus. Pilih Edit kandungan → Anotasi → Import sempadan → Pilih fail KML. Pilih fail .kml sehingga 2 MB. Pratonton kawasan bernama dan pilih sempadan untuk ditambah; buka Laraskan rupa untuk menukar warna garisan dan isian, lebar garisan serta kelegapan. Pilih Tambah sempadan dipilih, kemudian tunggu Saved. Batal tidak mengubah peta; Undo membuang seluruh import dalam satu langkah. Penjuru asal dikekalkan tepat. Gunakan Edit susun atur → Anotasi untuk menunjukkan atau menyembunyikan sempadan. Poligon berbilang bahagian dan lubang disokong: sehingga 1,000 penjuru setiap bahagian termasuk lubangnya, dalam had 20,000 titik tersimpan bagi peta. Tiada penjuru dipermudah. Pin, sumber, geometri bercampur, altitud bukan sifar, penerangan dan pautan luar dikecualikan; KMZ belum disokong. Import kekal peribadi dan tidak disertakan dalam pautan kongsi atau benaman. Sempadan kelihatan yang disimpan boleh muncul dalam muat turun PNG/PDF pemilik. Import lukisan orang lain tidak mengesahkannya sebagai sempadan rasmi atau terkini.',
        imageTitle: 'Tambah imej peribadi pada Peta Penjagaan', tagsTitle: 'Pautkan anotasi kepada sumber peta', privacyTitle: 'Privasi imej dan pautan sumber', open: 'Buka Peta Penjagaan', signIn: 'Log masuk untuk meneruskan',
        image: 'Log masuk dan buka Peta Penjagaan milik anda pada desktop dengan penuding halus. Pilih Edit kandungan → Anotasi → Tambah imej dan pilih PNG, JPEG atau WebP. Klik peta untuk meletakkannya. Pilih Move annotation dan seret pemegang tengah untuk mengalihkannya; seret penjuru untuk mengubah saiz mengikut nisbahnya. Imej tanpa sempadan secara lalai; pilih imej dan hidupkan Tunjukkan sempadan jika perlu. Tambah penerangan imej dan tunggu Saved. Undo membatalkan edit yang selesai. Akaun anda membenarkan sehingga 20 imej dimuat naik dan 20 MB untuk semua peta.',
        tags: 'Pada peta milik anda, pilih Edit kandungan → Anotasi, pilih anotasi dan Pautkan Sumber. Pilih sumber dalam peta, kemudian Kesan: Muncul menunjukkan anotasi; Berdenyut seketika; Serlahkan memberi cahaya tetap. Layangkan penuding pada kad berpaut untuk mengaktifkan anotasi yang kelihatan; pada anotasi untuk mengenal pasti kadnya. Gunakan fokus papan kekunci untuk kesan yang sama. Pada skrin sentuh, gunakan Tunjukkan anotasi berpaut atau ketik anotasi, kemudian Bersihkan pilihan pautan. Kesan penuding tamat apabila anda meninggalkan sasaran; kesan fokus kekal sehingga fokus dialihkan. Untuk Berdenyut atau Serlahkan, pilih Warna cahaya; lalai ialah jingga pin terang, dan Guna jingga pin menetapkannya semula. Gerakan dikurangkan menggunakan cahaya tetap. Program meliputi kadnya di setiap lokasi peta. Anotasi tersembunyi dalam paparan tersimpan kekal tersembunyi. Tunggu Saved selepas mengedit pautan, kesan atau warna.',
        privacy: 'Imej dan pautan sumber anotasi adalah peribadi kepada pemilik dan tidak disertakan dalam pautan kongsi atau benaman laman web. Share this annotation dan Include annotations hanya untuk bentuk lukisan yang boleh dikongsi; peraturan penerbitan sedia ada masih terpakai. Muat turun PNG/PDF pemilik boleh mengandungi imej peribadi; semak sebelum menghantarnya. Muat turun adalah statik: pilihan sementara dan denyutan tidak disimpan atau dieksport.',
    },
    ta: {
        gesturesTitle: "பராமரிப்பு வரைபடத்தின் அளவை மாற்றவும் சுழற்றவும்",
        gestures: "உங்களுக்குச் சொந்தமான பராமரிப்பு வரைபடத்தில் இரு விரல்களால் அளவை மாற்றவும், விரல்களைத் திருப்பிச் சுழற்றவும். சுட்டியில் உருளை மூலம் அளவை மாற்றவும்; வலது பொத்தானை அழுத்தி இழுத்துச் சுழற்றவும். தொடுபலகையில் இரு விரல்களால் அளவை மாற்றவும் அல்லது Shift அழுத்தி இரு விரல்களால் உருட்டிச் சுழற்றவும். இடப்புறம் சுழற்று, வலப்புறம் சுழற்று, வடக்கு நோக்கித் திருப்பு பொத்தான்களையும் பயன்படுத்தலாம். முழு வரைபடத்திலும் சுழற்சி இயங்கும். பார்வைக் கோணம் தற்காலிகமானது; சேமித்த ஆயத்தொலைவுகளை மாற்றாது. குறிப்புகளைத் திருத்தும்போதும் தனிப்பட்ட இடத்தை வைக்கும்போதும் வரைபடம் வடக்கு நோக்கித் திரும்பும். PNG/PDF ஏற்றுமதி, பகிர்ந்த வரைபடங்கள், இணையப் பதிப்புகள் வடக்கு நோக்கியே இருக்கும்.",
        boundariesTitle: 'பராமரிப்பு வரைபடத்தில் KML எல்லைகளை இறக்குமதி செய்',
        boundaries: 'துல்லியச் சுட்டியுள்ள கணினியில் உங்களுடைய பராமரிப்பு வரைபடத்தைத் திறக்கவும். உள்ளடக்கத்தைத் திருத்து → குறிப்பிடு → எல்லைகளை இறக்குமதி செய் → KML கோப்பைத் தேர்ந்தெடு. 2 MB வரையிலான .kml கோப்பைத் தேர்ந்தெடுக்கவும். பெயருள்ள பகுதிகளை முன்னோட்டமிட்டு எல்லைகளைத் தேர்ந்தெடுக்கவும்; தோற்றத்தை மாற்று மூலம் கோடு மற்றும் நிரப்பு நிறங்கள், கோட்டு அகலம், ஒளிபுகாமை ஆகியவற்றை மாற்றவும். தேர்ந்த எல்லைகளைச் சேர் என்பதைத் தேர்ந்து Saved வரை காத்திருக்கவும். ரத்து வரைபடத்தை மாற்றாது; Undo முழு இறக்குமதியையும் ஒரே படியில் நீக்கும். அசல் மூலைகள் அப்படியே இருக்கும். அமைப்பைத் திருத்து → குறிப்புகள் மூலம் எல்லைகளை காட்டலாம் அல்லது மறைக்கலாம். பல பகுதிகளுள்ள பலகோணங்களும் உள் வெற்றிடங்களும் ஆதரிக்கப்படும். வெற்றிடங்களுடன் ஒவ்வொரு பகுதிக்கும் 1,000 மூலைகள் வரை; வரைபடத்தில் மொத்தம் 20,000 சேமித்த புள்ளிகள் வரை. மூலைகள் எளிமைப்படுத்தப்படாது. ஊசிகள், வளங்கள், கலப்பு வடிவங்கள், பூஜ்ஜியமற்ற உயரம், விளக்கங்கள், வெளி இணைப்புகள் சேராது; KMZ இன்னும் ஆதரிக்கப்படாது. இறக்குமதிகள் தனிப்பட்டவை; பகிர்வு இணைப்புகள் அல்லது இணைய உட்பொதிவுகளில் சேராது. சேமித்த தெரியும் எல்லைகள் உரிமையாளரின் PNG/PDF பதிவிறக்கங்களில் வரலாம். மற்றவரின் வரைபடத்தை இறக்குமதி செய்வது அது அதிகாரப்பூர்வமான அல்லது தற்போதைய எல்லை என்பதை உறுதிப்படுத்தாது.',
        imageTitle: 'பராமரிப்பு வரைபடத்தில் தனிப்பட்ட படத்தைச் சேர்க்கவும்', tagsTitle: 'குறிப்பை வரைபட வளங்களுடன் இணைக்கவும்', privacyTitle: 'படங்கள் மற்றும் வள இணைப்புகளின் தனியுரிமை', open: 'பராமரிப்பு வரைபடங்களைத் திறக்கவும்', signIn: 'தொடர உள்நுழையவும்',
        image: 'உள்நுழைந்து, சுட்டியுள்ள கணினியில் உங்களுடைய பராமரிப்பு வரைபடத்தைத் திறக்கவும். உள்ளடக்கத்தைத் திருத்து → குறிப்பிடு → படத்தைச் சேர்க்கவும் என்பதைத் தேர்ந்து PNG, JPEG அல்லது WebP படத்தைத் தேர்ந்தெடுக்கவும். வைக்க வரைபடத்தில் கிளிக் செய்யவும். Move annotation என்பதைத் தேர்ந்து நடுக் கைப்பிடியை இழுத்து நகர்த்தவும்; மூலையை இழுத்து விகிதம் மாறாமல் அளவை மாற்றவும். படத்துக்கு இயல்பாக விளிம்பு இல்லை; படத்தைத் தேர்ந்து விளிம்பைக் காட்டு என்பதை இயக்கலாம். பட விளக்கத்தைச் சேர்த்து Saved வரை காத்திருக்கவும். Undo முடிந்த திருத்தத்தை மீளாக்கும். அனைத்து வரைபடங்களுக்கும் மொத்தம் 20 பதிவேற்றப்பட்ட படங்கள், 20 MB வரை அனுமதி உள்ளது.',
        tags: 'உங்கள் வரைபடத்தில் உள்ளடக்கத்தைத் திருத்து → குறிப்பிடு, பின்னர் குறிப்பைத் தேர்ந்து வளங்களை இணைக்கவும். வரைபட வளங்களைத் தேர்ந்து விளைவைத் தேர்வுசெய்யவும்: தோன்றும் குறிப்பைக் காட்டும்; துடிக்கும் சிறிது துடிக்கும்; முன்னிலைப்படுத்தும் நிலையான ஒளிர்வைத் தரும். இணைந்த அட்டைமேல் சுட்டியை வைத்தால் தெரியும் குறிப்புகள் செயல்படும்; குறிப்புமேல் வைத்தால் இணைந்த அட்டைகள் தெரியும். விசைப்பலகை கவனமும் இதே விளைவைத் தரும். தொடுதிரையில் இணைந்த குறிப்பைக் காட்டு அல்லது குறிப்பைத் தொடுங்கள்; இணைக்கப்பட்ட தேர்வை நீக்கு மூலம் நீக்கலாம். விலகினால் சுட்டி விளைவு முடியும்; விசைப்பலகை கவனத்தை மாற்றும் வரை அதன் விளைவு இருக்கும். துடிக்கும் அல்லது முன்னிலைப்படுத்தும் போது ஒளிர்வு நிறம் தேரலாம்; இயல்பானது தெளிவான ஊசியின் ஆரஞ்சு. ஊசியின் ஆரஞ்சு நிறத்தைப் பயன்படுத்து அதை மீட்டமைக்கும். இயக்கம் குறைக்கப்பட்டால் நிலையான ஒளிர்வு இருக்கும். நிகழ்ச்சியின் எல்லா இட அட்டைகளும் இணையும். சேமித்த பார்வையில் மறைந்த குறிப்புகள் மறைந்தே இருக்கும். இணைப்பு, விளைவு அல்லது நிறம் திருத்தியபின் Saved வரை காத்திருக்கவும்.',
        privacy: 'படங்களும் குறிப்பின் வள இணைப்புகளும் உரிமையாளருக்குத் தனிப்பட்டவை; பகிர்வு இணைப்பு, வலைத்தள உட்பொதிவில் சேராது. Share this annotation, Include annotations ஆகியவை பகிரக்கூடிய வரைந்த வடிவங்களுக்கு மட்டுமே; வெளிப்படையாக வெளியிடும் பழைய விதிகள் பொருந்தும். உரிமையாளரின் PNG/PDF பதிவிறக்கத்தில் தனிப்பட்ட படங்கள் இருக்கலாம்; அனுப்புமுன் சரிபார்க்கவும். பதிவிறக்கம் நிலையானது; தற்காலிகத் தேர்வு, துடிப்பு சேமிக்கப்படாது, ஏற்றுமதியாகாது.',
    },
};

function selectedLocale(locale, question = '') {
    if (copy[locale]) return locale;
    if (/[\u0b80-\u0bff]/.test(question)) return 'ta';
    if (/[\u3400-\u9fff]/.test(question)) return 'zh-CN';
    if (/\b(?:peta|imej|anotasi|pautkan|berdenyut)\b/i.test(question)) return 'ms';
    return 'en';
}

export function guideAnnotationFeatureIntent(question = '', pageContext = '') {
    const q = String(question).toLowerCase().replace(/[’']/g, '');
    const map = ['My Maps', 'Care Maps'].includes(pageContext) || /\b(?:care\s+|my\s+)?maps?\b|地图|地圖|வரைபட|\bpeta\b|\b(?:kml|kmz)\b/.test(q);
    const annotation = /\bannotations?\b|标注|標註|குறிப்ப|\banotasi\b/.test(q);
    if ((!map && !annotation) || /\b(?:extract|ocr|flyer import|medical|healthy|heart rate|blood|show my colleagues|show someone elses)\b/.test(q)) return null;
    if (!annotation && /\b(?:public\s+(?:place|resource|listing)|(?:place|resource|programme|offering)\s+(?:photo|image|logo))\b|公开地点|公共地点/.test(q)) return null;
    if (/\b(?:show|list|read|count)\b.{0,50}\b(?:colleagues?|someone elses?|other\s+(?:person|user|account))\b/.test(q)) return null;
    if (/\b(?:kml|kmz)\b/.test(q) && /\b(?:admin|subregions?|region groups?|postal mapping|spreadsheet|workbook|excel)\b/.test(q)
        && !/\b(?:care|my)\s+maps?\b/.test(q)) return null;
    if (/\b(?:kml|kmz)\b|\bimport.{0,25}boundar|(?:导入|匯入).{0,10}边界|\bimport\s+sempadan\b|எல்லைகளை இறக்குமதி/.test(q)) return 'boundaries';
    const image = /\b(?:images?|photos?|pictures?)\b|图片|照片|படத்தை|படங்கள்|\bimej\b/.test(q);
    const hoverLinks = /\b(?:hover(?:ing)?|focus|touch|tap|fokus|sentuh|penuding)\b|悬停|键盘焦点|触屏|சுட்டி|விசைப்பலகை|தொடுதிரை/.test(q)
        && (annotation || /\b(?:resources?|cards?|linked|sumber|kad)\b|资源|卡片|வளங்கள்|அட்டை/.test(q));
    const glow = /\b(?:glow|pin orange|warna cahaya)\b|光圈|光晕|ஒளிர்வு/.test(q);
    const tag = hoverLinks || glow || /\b(?:tag(?:ging)?\s+resources?|link(?:ed|ing)?\s+(?:an?\s+)?(?:annotation|resources?|cards?)|resources?\s+links?)\b|关联资源|关联卡片|வளங்களை இணை|இணைந்த அட்டை|\b(?:pautkan|serlahkan|berdenyut)\b/.test(q)
        || annotation && /\b(?:tag|link|linked|linking|appear|pulse|highlight)\b/.test(q)
        || /\b(?:pulse|highlight|appear)\b/.test(q) && /\b(?:effects?|behaviours?|behaviors?|linked\s+(?:cards?|resources?))\b/.test(q);
    if (tag) return 'tags';
    if (image) return 'image';
    if (map && /\b(?:pinch|zoom (?:in|out)|rotate|rotation|trackpad|mouse wheel|two.finger|zum|putar|pad jejak)\b|\u7f29\u653e|\u65cb\u8f6c|\u89e6\u63a7\u677f|\u0b9a\u0bc1\u0bb4\u0bb1\u0bcd|\u0ba4\u0bca\u0b9f\u0bc1\u0baa\u0bb2\u0b95\u0bc8/.test(q)) return 'gestures';

    // Keep the reviewed joint notes/drawings workflow on its established route.
    const sharing = /\b(?:share|shared|sharing|public|publish|privacy|embed)\b|共享|分享|隐私|பகிர|தனியுரிமை|\b(?:kongsi|privasi)\b/.test(q);
    if (annotation && sharing && !/\bnotes?\b/.test(q)) return 'privacy';
    return null;
}

export function guideAnnotationFeatureFact(kind = 'privacy', locale, question = '') {
    const text = copy[selectedLocale(locale, question)];
    return { id: ids[kind], title: text[`${kind}Title`], message: text[kind], route, reviewed: ['boundaries', 'gestures'].includes(kind) ? '2026-10-10' : reviewed, visibility: 'public',
        evidence: kind === 'gestures' ? 'client/src/components/CareMapGestureControl.jsx; client/src/hooks/useCareMapGestures.js'
            : kind === 'boundaries' ? 'client/src/components/KmlBoundaryImport.jsx; client/src/lib/kmlBoundaries.js; server/src/controllers/printAnnotationsController.js'
            : kind === 'image'
            ? 'client/src/components/AnnotationImageUpload.jsx; client/src/components/PrintAnnotationLayer.jsx; server/src/utils/privateMapMedia.js'
            : kind === 'tags'
                ? 'client/src/components/AnnotationResourcePicker.jsx; client/src/hooks/useAnnotationResourceActivation.js; client/src/lib/annotationResourceLinks.js'
                : 'server/src/controllers/printAnnotationsController.js:167-196; client/src/components/ShareMapModal.jsx:109-119; client/src/components/MapImageExportButton.jsx' };
}
const sourceFor = ({ id, title, route: destination, reviewed: date }) => ({ id, title, route: destination, reviewed: date });

export function answerGuideAnnotationFeatures({ question = '', pageContext = '', locale, actor = null } = {}) {
    const kind = guideAnnotationFeatureIntent(question, pageContext);
    if (!kind) return null;
    const fact = guideAnnotationFeatureFact(kind, locale, question), privacy = guideAnnotationFeatureFact('privacy', locale, question);
    const text = copy[selectedLocale(locale, question)], signedIn = Boolean(actor?.id) && normalizeRole(actor.role) !== 'guest' && !actor.isImpersonating;
    return { topicId: fact.id, answerKind: 'procedure', message: ['privacy', 'boundaries', 'gestures'].includes(kind) ? fact.message : `${fact.message}\n\n${privacy.message}`,
        actions: [{ label: signedIn ? text.open : text.signIn, route: signedIn ? route : '/login' }],
        sources: (['privacy', 'boundaries', 'gestures'].includes(kind) ? [fact] : [fact, privacy]).map(sourceFor) };
}

function concernsAnnotations(answer) {
    return answer?.topicId === 'map-note-annotation-sharing' || answer?.topicId === 'embedded-map-notes'
        || answer?.sources?.some(source => source.articleId === 'HC-16' || source.id?.startsWith('article-hc-16-'));
}

export function qualifyGuideAnnotationAnswer(answer, { locale, question = '' } = {}) {
    if (!answer || !concernsAnnotations(answer) || answer.sources?.some(source => source.id === ids.privacy)) return answer;
    const privacy = guideAnnotationFeatureFact('privacy', locale, question);
    return { ...answer, message: `${privacy.message}\n\n${answer.message}`, sources: [...(answer.sources || []), sourceFor(privacy)] };
}

export function guideAnnotationGroundingFacts(facts = [], { question = '', pageContext = '', locale } = {}) {
    if (!guideAnnotationFeatureIntent(question, pageContext) && !facts.some(fact => fact.articleId === 'HC-16' || fact.id === 'embedded-map-notes')) return facts;
    const privacy = guideAnnotationFeatureFact('privacy', locale, question);
    return facts.some(fact => fact.id === privacy.id) ? facts : [...facts, privacy];
}
