import { PRINT_ANNOTATION_DOCUMENT_MAX_COUNT } from '../../../shared/printAnnotationLimits.js';

const copy = {
    en: {
        title: 'Draw & measure', draw: 'Saved drawings', measure: 'Measure',
        drawingHelp: 'Drawings stay on this map. A circle is saved after you click its centre and outer edge.',
        temporary: 'Temporary measurement', temporaryHelp: 'Not saved or exported. Use Draw circle to keep a circle on your map.',
        distance: 'Distance', radius: 'Radius', clear: 'Clear measurement',
        firstDistance: 'Click the starting point, then the end point.',
        nextDistance: 'Move to preview the distance, then click the end point.',
        firstRadius: 'Click the centre, then the circle’s outer edge.',
        nextRadius: 'Move to preview the radius, then click the outer edge.',
        result: 'Straight-line measurement. Clear to measure again.',
        finishDrawing: 'Finish or cancel your drawing before measuring.',
        capacity: `This Care Map has reached its ${PRINT_ANNOTATION_DOCUMENT_MAX_COUNT} saved annotation limit. Existing items can still be edited or removed. Temporary measurements remain available.`,
    },
    zh: {
        title: '绘图与测量', draw: '已保存绘图', measure: '测量',
        drawingHelp: '绘图保留在此地图上。点击圆心和外缘后，圆形即会保存。',
        temporary: '临时测量', temporaryHelp: '不会保存或导出。若要保留圆形，请使用“绘制圆形”。',
        distance: '距离', radius: '半径', clear: '清除测量',
        firstDistance: '点击起点，再点击终点。', nextDistance: '移动以预览距离，再点击终点。',
        firstRadius: '点击圆心，再点击圆的外缘。', nextRadius: '移动以预览半径，再点击外缘。',
        result: '直线测量。清除后可再次测量。', finishDrawing: '测量前，请完成或取消绘图。',
        capacity: `此关爱地图已达到${PRINT_ANNOTATION_DOCUMENT_MAX_COUNT}个已保存标注的上限。仍可编辑或删除现有标注，并使用临时测量。`,
    },
    ms: {
        title: 'Lukis & ukur', draw: 'Lukisan tersimpan', measure: 'Ukur',
        drawingHelp: 'Lukisan kekal pada peta ini. Bulatan disimpan selepas anda klik pusat dan tepi luar.',
        temporary: 'Ukuran sementara', temporaryHelp: 'Tidak disimpan atau dieksport. Gunakan Lukis bulatan untuk mengekalkan bulatan pada peta.',
        distance: 'Jarak', radius: 'Jejari', clear: 'Padam ukuran',
        firstDistance: 'Klik titik mula, kemudian titik akhir.', nextDistance: 'Gerakkan untuk pratonton jarak, kemudian klik titik akhir.',
        firstRadius: 'Klik pusat, kemudian tepi luar bulatan.', nextRadius: 'Gerakkan untuk pratonton jejari, kemudian klik tepi luar.',
        result: 'Ukuran garis lurus. Padam untuk mengukur semula.', finishDrawing: 'Selesaikan atau batalkan lukisan sebelum mengukur.',
        capacity: `Peta ini telah mencapai had ${PRINT_ANNOTATION_DOCUMENT_MAX_COUNT} anotasi tersimpan. Item sedia ada masih boleh disunting atau dibuang. Ukuran sementara masih tersedia.`,
    },
    ta: {
        title: 'வரை மற்றும் அளவிடு', draw: 'சேமித்த வரைபடங்கள்', measure: 'அளவிடு',
        drawingHelp: 'வரைவுகள் இந்த வரைபடத்தில் இருக்கும். மையத்தையும் வெளிப்புற விளிம்பையும் கிளிக் செய்ததும் வட்டம் சேமிக்கப்படும்.',
        temporary: 'தற்காலிக அளவீடு', temporaryHelp: 'சேமிக்கவோ ஏற்றுமதி செய்யவோ முடியாது. வட்டத்தை வைத்திருக்க வட்டம் வரையும் கருவியைப் பயன்படுத்தவும்.',
        distance: 'தூரம்', radius: 'ஆரம்', clear: 'அளவீட்டை அழி',
        firstDistance: 'தொடக்கப் புள்ளியையும் பின்னர் இறுதிப் புள்ளியையும் கிளிக் செய்யவும்.', nextDistance: 'தூரத்தைப் பார்க்க நகர்த்தி இறுதிப் புள்ளியைக் கிளிக் செய்யவும்.',
        firstRadius: 'மையத்தையும் பின்னர் வட்டத்தின் வெளிப்புற விளிம்பையும் கிளிக் செய்யவும்.', nextRadius: 'ஆரத்தைப் பார்க்க நகர்த்தி வெளிப்புற விளிம்பைக் கிளிக் செய்யவும்.',
        result: 'நேர்கோட்டு அளவீடு. மீண்டும் அளவிட அழிக்கவும்.', finishDrawing: 'அளவிடும் முன் வரைவை முடிக்கவும் அல்லது ரத்து செய்யவும்.',
        capacity: `இந்த வரைபடம் ${PRINT_ANNOTATION_DOCUMENT_MAX_COUNT} சேமித்த குறிப்புகளின் வரம்பை எட்டியுள்ளது. ஏற்கனவே உள்ளவற்றைத் திருத்தலாம் அல்லது அகற்றலாம். தற்காலிக அளவீடு கிடைக்கும்.`,
    },
};

export function getAnnotationToolMessages(locale = 'en') {
    return copy[String(locale).split('-')[0]] || copy.en;
}
