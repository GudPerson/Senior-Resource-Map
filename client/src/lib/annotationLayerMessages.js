const messages = {
    en: {
        search: 'Search annotations', searchPlaceholder: 'Name, type or group', type: 'Type', group: 'Group',
        allTypes: 'All types', allGroups: 'All groups', ungrouped: 'Ungrouped',
        boundary: 'Imported boundaries', polygon: 'Areas', circle: 'Circles', line: 'Lines', rectangle: 'Rectangles', pin: 'Labels', image: 'Images', other: 'Other',
        results: '{visible} of {total} matches shown', showMatches: 'Show all matching annotations', noMatches: 'No annotations match these filters.',
        organise: 'Organise groups', groupName: 'Group name', groupPlaceholder: 'New or existing group',
        groupHelp: 'Move matching annotations into a named group. Their visibility stays the same.',
        move: 'Move {count} matching items', remove: 'Ungroup {count} matching items', moving: 'Saving group…', saved: 'Group saved.',
        failed: 'Group changes could not be saved. They remain pending.', retry: 'Retry saving group', undo: 'Undo group change', undone: 'Group change undone.',
        groupScope: 'Groups apply across this map’s saved views. Showing or hiding items applies to this view only.',
        visibilityFull: 'This selection will not fit while old visibility settings remain.',
        cleanupHelp: 'Clean up settings for deleted annotations in this view. Current annotations are kept.', cleanup: 'Clean up {count} old visibility settings',
    },
    zh: {
        search: '搜索标注', searchPlaceholder: '名称、类型或分组', type: '类型', group: '分组',
        allTypes: '所有类型', allGroups: '所有分组', ungrouped: '未分组',
        boundary: '导入的边界', polygon: '区域', circle: '圆形', line: '线条', rectangle: '矩形', pin: '标签', image: '图片', other: '其他',
        results: '{total} 个匹配项中显示 {visible} 个', showMatches: '显示所有匹配的标注', noMatches: '没有符合筛选条件的标注。',
        organise: '管理分组', groupName: '分组名称', groupPlaceholder: '新建或现有分组',
        groupHelp: '将匹配的标注移入指定分组。显示状态保持不变。',
        move: '移动 {count} 个匹配项', remove: '取消 {count} 个匹配项的分组', moving: '正在保存分组…', saved: '分组已保存。',
        failed: '无法保存分组更改。更改仍等待保存。', retry: '重试保存分组', undo: '撤销分组更改', undone: '已撤销分组更改。',
        groupScope: '分组适用于此地图的所有已保存视图。显示或隐藏仅适用于当前视图。',
        visibilityFull: '旧显示设置占用了空间，无法保存此选择。',
        cleanupHelp: '清除此视图中已删除标注的显示设置。当前标注将保留。', cleanup: '清理 {count} 项旧显示设置',
    },
    ms: {
        search: 'Cari anotasi', searchPlaceholder: 'Nama, jenis atau kumpulan', type: 'Jenis', group: 'Kumpulan',
        allTypes: 'Semua jenis', allGroups: 'Semua kumpulan', ungrouped: 'Tanpa kumpulan',
        boundary: 'Sempadan diimport', polygon: 'Kawasan', circle: 'Bulatan', line: 'Garisan', rectangle: 'Segi empat', pin: 'Label', image: 'Imej', other: 'Lain-lain',
        results: '{visible} daripada {total} padanan dipaparkan', showMatches: 'Tunjukkan semua anotasi sepadan', noMatches: 'Tiada anotasi sepadan dengan penapis ini.',
        organise: 'Urus kumpulan', groupName: 'Nama kumpulan', groupPlaceholder: 'Kumpulan baharu atau sedia ada',
        groupHelp: 'Pindahkan anotasi sepadan ke kumpulan bernama. Keterlihatan tidak berubah.',
        move: 'Pindahkan {count} item sepadan', remove: 'Keluarkan {count} item daripada kumpulan', moving: 'Menyimpan kumpulan…', saved: 'Kumpulan disimpan.',
        failed: 'Perubahan kumpulan tidak dapat disimpan. Perubahan masih menunggu.', retry: 'Cuba simpan kumpulan lagi', undo: 'Buat asal perubahan kumpulan', undone: 'Perubahan kumpulan dibuat asal.',
        groupScope: 'Kumpulan digunakan dalam semua paparan tersimpan peta ini. Papar atau sembunyi hanya untuk paparan ini.',
        visibilityFull: 'Pilihan ini tidak muat selagi tetapan keterlihatan lama masih ada.',
        cleanupHelp: 'Bersihkan tetapan anotasi yang dipadam dalam paparan ini. Anotasi semasa dikekalkan.', cleanup: 'Bersihkan {count} tetapan keterlihatan lama',
    },
    ta: {
        search: 'குறிப்புகளைத் தேடு', searchPlaceholder: 'பெயர், வகை அல்லது குழு', type: 'வகை', group: 'குழு',
        allTypes: 'அனைத்து வகைகள்', allGroups: 'அனைத்துக் குழுக்கள்', ungrouped: 'குழுவில்லாதவை',
        boundary: 'இறக்குமதி எல்லைகள்', polygon: 'பகுதிகள்', circle: 'வட்டங்கள்', line: 'கோடுகள்', rectangle: 'செவ்வகங்கள்', pin: 'பெயர்கள்', image: 'படங்கள்', other: 'பிற',
        results: '{total} பொருத்தங்களில் {visible} காட்டப்படுகின்றன', showMatches: 'பொருந்தும் அனைத்துக் குறிப்புகளையும் காட்டு', noMatches: 'இந்த வடிகட்டிகளுக்குப் பொருந்தும் குறிப்புகள் இல்லை.',
        organise: 'குழுக்களை ஒழுங்குபடுத்து', groupName: 'குழுப் பெயர்', groupPlaceholder: 'புதிய அல்லது தற்போதைய குழு',
        groupHelp: 'பொருந்தும் குறிப்புகளைப் பெயரிட்ட குழுவிற்கு நகர்த்து. காட்சிநிலை மாறாது.',
        move: '{count} பொருந்தும் உருப்படிகளை நகர்த்து', remove: '{count} உருப்படிகளின் குழுவை நீக்கு', moving: 'குழு சேமிக்கப்படுகிறது…', saved: 'குழு சேமிக்கப்பட்டது.',
        failed: 'குழு மாற்றங்களைச் சேமிக்க முடியவில்லை. அவை நிலுவையில் உள்ளன.', retry: 'குழுவை மீண்டும் சேமி', undo: 'குழு மாற்றத்தைச் செயல்தவிர்', undone: 'குழு மாற்றம் செயல்தவிர்க்கப்பட்டது.',
        groupScope: 'குழுக்கள் இந்த வரைபடத்தின் சேமித்த அனைத்துக் காட்சிகளுக்கும் பொருந்தும். காட்டுவதும் மறைப்பதும் இந்தக் காட்சிக்கு மட்டுமே.',
        visibilityFull: 'பழைய காட்சி அமைப்புகள் உள்ளதால் இந்தத் தேர்வைச் சேமிக்க இடமில்லை.',
        cleanupHelp: 'இந்தக் காட்சியில் நீக்கப்பட்ட குறிப்புகளின் அமைப்புகளைச் சுத்தம் செய். தற்போதைய குறிப்புகள் பாதுகாக்கப்படும்.', cleanup: '{count} பழைய காட்சி அமைப்புகளைச் சுத்தம் செய்',
    },
};

export function getAnnotationLayerMessages(locale = 'en') {
    return messages[String(locale).split('-')[0]] || messages.en;
}

export function annotationLayerMessage(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
