const PRINT_MAP_PDF_FORMAT = 'a3';
const PRINT_MAP_PDF_MARGIN_PT = 18;

function normalizeDimension(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 1;
}

export function getPrintMapPdfOrientation({ width, height } = {}) {
    return normalizeDimension(width) >= normalizeDimension(height) ? 'landscape' : 'portrait';
}

export function getContainedPrintImageRect(
    imageDimensions = {},
    pageDimensions = {},
    margin = PRINT_MAP_PDF_MARGIN_PT,
) {
    const imageWidth = normalizeDimension(imageDimensions.width);
    const imageHeight = normalizeDimension(imageDimensions.height);
    const pageWidth = normalizeDimension(pageDimensions.width);
    const pageHeight = normalizeDimension(pageDimensions.height);
    const safeMargin = Math.max(0, Number(margin) || 0);
    const availableWidth = Math.max(1, pageWidth - (safeMargin * 2));
    const availableHeight = Math.max(1, pageHeight - (safeMargin * 2));
    const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;

    return {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
    };
}

export function buildPrintMapPdfFileName(directoryName, suffix = 'print') {
    const slug = String(directoryName || 'carearound-directory')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const safeSuffix = String(suffix || 'print')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'print';
    return `${slug || 'carearound-directory'}-${safeSuffix}.pdf`;
}

export async function createPrintMapPdfDocument({ pages = [], directoryName = '' } = {}) {
    const usablePages = pages.filter((page) => (
        typeof page?.dataUrl === 'string'
        && page.dataUrl.startsWith('data:image/png')
        && Number(page.width) > 0
        && Number(page.height) > 0
    ));
    if (!usablePages.length) {
        throw new Error('PDF export failed because no print pages are ready.');
    }

    const { jsPDF } = await import('jspdf');
    const firstOrientation = getPrintMapPdfOrientation(usablePages[0]);
    const doc = new jsPDF({
        orientation: firstOrientation,
        unit: 'pt',
        format: PRINT_MAP_PDF_FORMAT,
        compress: true,
        putOnlyUsedFonts: true,
    });
    doc.setProperties({
        title: String(directoryName || 'CareAround SG map'),
        subject: 'CareAround SG print-ready map and resource pages',
    });

    usablePages.forEach((page, index) => {
        const orientation = getPrintMapPdfOrientation(page);
        if (index > 0) {
            doc.addPage(PRINT_MAP_PDF_FORMAT, orientation);
        }
        const pageSize = {
            width: doc.internal.pageSize.getWidth(),
            height: doc.internal.pageSize.getHeight(),
        };
        const imageRect = getContainedPrintImageRect(page, pageSize);
        doc.addImage(
            page.dataUrl,
            'PNG',
            imageRect.x,
            imageRect.y,
            imageRect.width,
            imageRect.height,
            undefined,
            'FAST',
        );
    });

    return doc;
}

export async function downloadPrintMapPdf({ pages = [], directoryName = '', fileNameSuffix = 'print' } = {}) {
    const doc = await createPrintMapPdfDocument({ pages, directoryName });
    doc.save(buildPrintMapPdfFileName(directoryName, fileNameSuffix));
}
