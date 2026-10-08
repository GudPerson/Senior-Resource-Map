import { normalizeRole } from './roles.js';

const route = '/my-directory?section=my-maps';
const reviewed = '2026-10-08';
const ids = { image: 'map-private-image-annotations', tags: 'map-annotation-resource-links', privacy: 'map-annotation-private-sharing-boundary' };
const copy = {
    en: {
        imageTitle: 'Add a private image to your Care Map', tagsTitle: 'Link an annotation to map resources', privacyTitle: 'Image and resource-link privacy', open: 'Open Care Maps', signIn: 'Sign in to continue',
        image: 'Sign in and open a Care Map you own on a desktop with a fine pointer. Choose Edit content → Annotate → Add image and select a PNG, JPEG or WebP. Click the map to place it. Choose Move annotation and drag its centre handle to move it; drag a corner to resize while keeping its proportions. Add an image description and wait for Saved. Undo reverses a completed edit. Your account allows up to 20 uploaded images and 20 MB across your maps.',
        tags: 'On a Care Map you own, choose Edit content → Annotate, select an annotation and choose Tag Resources. Select one or more resources already in that map, then choose Behaviour: Appear shows the annotation when a linked resource is selected; Pulse runs briefly and then keeps a steady highlight; Highlight stays until Clear linked selection. Reduced motion uses a steady highlight. Selecting an annotation identifies its linked cards; selecting a card activates linked annotations. A programme applies to its cards at every map location. Saved-view hidden annotations stay hidden. Wait for Saved after editing links or behaviour.',
        privacy: 'Images and annotation resource links are owner-private and are excluded from shared links and website embeds. Share this annotation and Include annotations apply only to shareable drawing shapes; their existing explicit publishing rules still apply. Owner PNG/PDF downloads can include private images, so review a download before sending it. Downloads are static: temporary selection and pulse effects are not saved or exported.',
    },
    'zh-CN': {
        imageTitle: '在关怀地图中添加私人图片', tagsTitle: '将标注关联到地图资源', privacyTitle: '图片和资源关联的隐私', open: '打开关怀地图', signIn: '登录以继续',
        image: '登录后，在配有鼠标等精细指针的桌面设备上打开自己拥有的关怀地图。选择编辑内容 → 添加标注 → 添加图片，然后选择 PNG、JPEG 或 WebP。在地图上点击以放置图片。选择“Move annotation”，拖动中心控制点以移动图片；拖动角点可按比例调整大小。添加图片说明并等待 Saved。Undo 可撤销已完成的编辑。账户在所有地图中合计最多可上传 20 张图片、20 MB。',
        tags: '在自己的关怀地图中选择编辑内容 → 添加标注，选中标注并选择关联资源。勾选此地图中的一个或多个资源，再选择效果：显示会在选中关联资源时显示标注；闪动会短暂闪动后保持突出显示；突出显示会保持到清除关联选择。减少动态效果时只突出显示。选中标注会标识关联卡片，选中卡片会激活关联标注。活动在此地图所有地点的卡片都会关联。保存视图中隐藏的标注保持隐藏。编辑后请等待 Saved。',
        privacy: '图片和标注的资源关联仅供地图所有者使用，不会加入共享链接或网站嵌入。Share this annotation 和 Include annotations 仅适用于可共享的绘图形状，仍须按现有规则明确发布。所有者的 PNG/PDF 下载可能包含私人图片，发送前请检查文件。下载为静态内容，不会保存或导出临时选择和闪动效果。',
    },
    ms: {
        imageTitle: 'Tambah imej peribadi pada Peta Penjagaan', tagsTitle: 'Pautkan anotasi kepada sumber peta', privacyTitle: 'Privasi imej dan pautan sumber', open: 'Buka Peta Penjagaan', signIn: 'Log masuk untuk meneruskan',
        image: 'Log masuk dan buka Peta Penjagaan milik anda pada desktop dengan penuding halus. Pilih Edit kandungan → Anotasi → Tambah imej dan pilih PNG, JPEG atau WebP. Klik peta untuk meletakkannya. Pilih Move annotation dan seret pemegang tengah untuk mengalihkannya; seret penjuru untuk mengubah saiz mengikut nisbahnya. Tambah penerangan imej dan tunggu Saved. Undo membatalkan edit yang selesai. Akaun anda membenarkan sehingga 20 imej dimuat naik dan 20 MB untuk semua peta.',
        tags: 'Pada peta milik anda, pilih Edit kandungan → Anotasi, pilih anotasi dan Pautkan Sumber. Pilih sumber yang sudah ada dalam peta, kemudian Kesan: Muncul menunjukkan anotasi apabila sumber dipilih; Berdenyut seketika kemudian kekalkan serlahan; Serlahkan kekal sehingga Bersihkan pilihan pautan. Gerakan dikurangkan menggunakan serlahan sahaja. Memilih anotasi menandakan kadnya; memilih kad mengaktifkan anotasi. Program meliputi kadnya di setiap lokasi peta. Anotasi tersembunyi dalam paparan tersimpan kekal tersembunyi. Tunggu Saved selepas mengedit.',
        privacy: 'Imej dan pautan sumber anotasi adalah peribadi kepada pemilik dan tidak disertakan dalam pautan kongsi atau benaman laman web. Share this annotation dan Include annotations hanya untuk bentuk lukisan yang boleh dikongsi; peraturan penerbitan sedia ada masih terpakai. Muat turun PNG/PDF pemilik boleh mengandungi imej peribadi; semak sebelum menghantarnya. Muat turun adalah statik: pilihan sementara dan denyutan tidak disimpan atau dieksport.',
    },
    ta: {
        imageTitle: 'பராமரிப்பு வரைபடத்தில் தனிப்பட்ட படத்தைச் சேர்க்கவும்', tagsTitle: 'குறிப்பை வரைபட வளங்களுடன் இணைக்கவும்', privacyTitle: 'படங்கள் மற்றும் வள இணைப்புகளின் தனியுரிமை', open: 'பராமரிப்பு வரைபடங்களைத் திறக்கவும்', signIn: 'தொடர உள்நுழையவும்',
        image: 'உள்நுழைந்து, சுட்டியுள்ள கணினியில் உங்களுடைய பராமரிப்பு வரைபடத்தைத் திறக்கவும். உள்ளடக்கத்தைத் திருத்து → குறிப்பிடு → படத்தைச் சேர்க்கவும் என்பதைத் தேர்ந்து PNG, JPEG அல்லது WebP படத்தைத் தேர்ந்தெடுக்கவும். வைக்க வரைபடத்தில் கிளிக் செய்யவும். Move annotation என்பதைத் தேர்ந்து நடுக் கைப்பிடியை இழுத்து நகர்த்தவும்; மூலையை இழுத்து விகிதம் மாறாமல் அளவை மாற்றவும். பட விளக்கத்தைச் சேர்த்து Saved வரை காத்திருக்கவும். Undo முடிந்த திருத்தத்தை மீளாக்கும். அனைத்து வரைபடங்களுக்கும் மொத்தம் 20 பதிவேற்றப்பட்ட படங்கள், 20 MB வரை அனுமதி உள்ளது.',
        tags: 'உங்கள் வரைபடத்தில் உள்ளடக்கத்தைத் திருத்து → குறிப்பிடு, பின்னர் குறிப்பைத் தேர்ந்து வளங்களை இணைக்கவும். வரைபடத்தில் ஏற்கெனவே உள்ள வளங்களைத் தேர்ந்து விளைவைத் தேர்வுசெய்யவும்: தோன்றும் என்பது வளத்தைத் தேர்ந்தால் குறிப்பைக் காட்டும்; துடிக்கும் என்பது சிறிது துடித்தபின் முன்னிலைப்படுத்தும்; முன்னிலைப்படுத்தும் என்பது இணைக்கப்பட்ட தேர்வை நீக்கும் வரை நீடிக்கும். இயக்கம் குறைக்கப்பட்டால் நிலையான முன்னிலை மட்டும் இருக்கும். குறிப்பைத் தேர்ந்தால் இணைந்த அட்டைகள் தெரியும்; அட்டையைத் தேர்ந்தால் குறிப்புகள் செயல்படும். நிகழ்ச்சியின் எல்லா வரைபட இட அட்டைகளும் இணையும். சேமித்த பார்வையில் மறைந்த குறிப்புகள் மறைந்தே இருக்கும். திருத்தியபின் Saved வரை காத்திருக்கவும்.',
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
    const map = ['My Maps', 'Care Maps'].includes(pageContext) || /\b(?:care\s+|my\s+)?maps?\b|地图|地圖|வரைபட|\bpeta\b/.test(q);
    const annotation = /\bannotations?\b|标注|標註|குறிப்ப|\banotasi\b/.test(q);
    if ((!map && !annotation) || /\b(?:extract|ocr|flyer import|medical|healthy|heart rate|blood|show my colleagues|show someone elses)\b/.test(q)) return null;
    if (!annotation && /\b(?:public\s+(?:place|resource|listing)|(?:place|resource|programme|offering)\s+(?:photo|image|logo))\b|公开地点|公共地点/.test(q)) return null;
    if (/\b(?:show|list|read|count)\b.{0,50}\b(?:colleagues?|someone elses?|other\s+(?:person|user|account))\b/.test(q)) return null;
    const image = /\b(?:images?|photos?|pictures?)\b|图片|照片|படத்தை|படங்கள்|\bimej\b/.test(q);
    const tag = /\b(?:tag(?:ging)?\s+resources?|link(?:ed|ing)?\s+(?:an?\s+)?(?:annotation|resources?|cards?)|resources?\s+links?)\b|关联资源|关联卡片|வளங்களை இணை|இணைந்த அட்டை|\b(?:pautkan|serlahkan|berdenyut)\b/.test(q)
        || annotation && /\b(?:tag|link|linked|linking|appear|pulse|highlight)\b/.test(q)
        || /\b(?:pulse|highlight|appear)\b/.test(q) && /\b(?:effects?|behaviours?|behaviors?|linked\s+(?:cards?|resources?))\b/.test(q);
    if (tag) return 'tags';
    if (image) return 'image';
    // Keep the reviewed joint notes/drawings workflow on its established route.
    const sharing = /\b(?:share|shared|sharing|public|publish|privacy|embed)\b|共享|分享|隐私|பகிர|தனியுரிமை|\b(?:kongsi|privasi)\b/.test(q);
    if (annotation && sharing && !/\bnotes?\b/.test(q)) return 'privacy';
    return null;
}

export function guideAnnotationFeatureFact(kind = 'privacy', locale, question = '') {
    const text = copy[selectedLocale(locale, question)];
    return { id: ids[kind], title: text[`${kind}Title`], message: text[kind], route, reviewed, visibility: 'public',
        evidence: kind === 'image'
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
    return { topicId: fact.id, answerKind: 'procedure', message: kind === 'privacy' ? fact.message : `${fact.message}\n\n${privacy.message}`,
        actions: [{ label: signedIn ? text.open : text.signIn, route: signedIn ? route : '/login' }],
        sources: (kind === 'privacy' ? [fact] : [fact, privacy]).map(sourceFor) };
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
