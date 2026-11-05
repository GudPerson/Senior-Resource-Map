const messages = {
    en: {
        expand: 'Expand editing canvas', exit: 'Return to page', title: 'Editing canvas',
        content: 'Content', draw: 'Draw', measure: 'Measure', studio: 'Studio', resources: 'Resources', export: 'Export',
        closePanel: 'Close tool panel', tools: 'Map editing tools', view: 'Saved view',
        saved: 'All changes saved', saving: 'Saving changes', pending: 'Changes waiting to save',
        loading: 'Loading', failed: 'Changes could not be saved', annotations: 'Annotations',
        finishDraft: 'Finish or cancel your drawing before changing tools.',
    },
    zh: {
        expand: '展开编辑画布', exit: '返回页面', title: '编辑画布',
        content: '内容', draw: '绘图', measure: '测量', studio: '工作室', resources: '资源', export: '导出',
        closePanel: '关闭工具面板', tools: '地图编辑工具', view: '已保存视图',
        saved: '所有更改已保存', saving: '正在保存更改', pending: '更改等待保存',
        loading: '正在加载', failed: '无法保存更改', annotations: '标注',
        finishDraft: '切换工具前，请完成或取消绘图。',
    },
    ms: {
        expand: 'Buka kanvas penyuntingan', exit: 'Kembali ke halaman', title: 'Kanvas penyuntingan',
        content: 'Kandungan', draw: 'Lukis', measure: 'Ukur', studio: 'Studio', resources: 'Sumber', export: 'Eksport',
        closePanel: 'Tutup panel alat', tools: 'Alat suntingan peta', view: 'Paparan tersimpan',
        saved: 'Semua perubahan disimpan', saving: 'Menyimpan perubahan', pending: 'Perubahan menunggu untuk disimpan',
        loading: 'Memuatkan', failed: 'Perubahan tidak dapat disimpan', annotations: 'Anotasi',
        finishDraft: 'Selesaikan atau batalkan lukisan sebelum menukar alat.',
    },
    ta: {
        expand: 'திருத்தும் வரைபடத்தை விரி', exit: 'பக்கத்திற்குத் திரும்பு', title: 'திருத்தும் வரைபடம்',
        content: 'உள்ளடக்கம்', draw: 'வரை', measure: 'அளவிடு', studio: 'ஸ்டுடியோ', resources: 'வளங்கள்', export: 'ஏற்றுமதி',
        closePanel: 'கருவிப் பலகையை மூடு', tools: 'வரைபடத் திருத்தக் கருவிகள்', view: 'சேமித்த காட்சி',
        saved: 'அனைத்து மாற்றங்களும் சேமிக்கப்பட்டன', saving: 'மாற்றங்கள் சேமிக்கப்படுகின்றன', pending: 'மாற்றங்கள் சேமிக்கக் காத்திருக்கின்றன',
        loading: 'ஏற்றப்படுகிறது', failed: 'மாற்றங்களைச் சேமிக்க முடியவில்லை', annotations: 'குறிப்புகள்',
        finishDraft: 'கருவியை மாற்றுமுன் வரைதலை முடிக்கவும் அல்லது ரத்துசெய்யவும்.',
    },
};

export function getOwnerMapCanvasMessages(locale = 'en') {
    return messages[String(locale).split('-')[0]] || messages.en;
}
