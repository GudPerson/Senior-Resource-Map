import {
    buildMyMapAssetLedger,
    buildMyMapAssetWorkbookRows,
    toSafeExcelText,
} from './myMapAssetLedger.js';

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function buildMyMapExcelFileName(mapName) {
    const slug = slugify(mapName);
    return `${slug || 'carearound-map'}-assets.xlsx`;
}

function setSheetLayout(sheet, widths) {
    sheet['!cols'] = widths.map((width) => ({ wch: width }));
    if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] };
}

function setTextColumn(XLSX, sheet, columnIndex) {
    if (!sheet['!ref']) return;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
        if (!cell) continue;
        cell.t = 's';
        cell.z = '@';
    }
}

export async function createMyMapExcelWorkbook({
    directory,
    presentation,
    locale = 'en-SG',
} = {}) {
    const XLSX = await import('@e965/xlsx');
    const ledger = buildMyMapAssetLedger({ directory, presentation, locale });
    const rows = buildMyMapAssetWorkbookRows(ledger);
    const workbook = XLSX.utils.book_new();
    const summary = XLSX.utils.aoa_to_sheet([
        ['CareAround SG My Map asset export'],
        ['Map', toSafeExcelText(ledger.mapName)],
        ['Assets', ledger.summary.assetCount],
        ['Personal places', ledger.summary.personalPlaceCount],
        ['Categories', ledger.summary.categoryCount],
        ['Descriptions', ledger.summary.descriptionCount],
        [],
        ['Privacy note', 'Private map notes are not included in this workbook.'],
    ]);
    summary['!cols'] = [{ wch: 24 }, { wch: 58 }];

    const assets = XLSX.utils.json_to_sheet(rows.assets, {
        header: ['Map no.', 'Resource name', 'Category', 'Address', 'Postal code', 'Type', 'Description count'],
    });
    setSheetLayout(assets, [12, 36, 28, 48, 16, 18, 18]);
    setTextColumn(XLSX, assets, 4);

    const descriptions = XLSX.utils.json_to_sheet(rows.descriptions, {
        header: ['Map no.', 'Resource name', 'Category', 'Description no.', 'Description', 'Text colour', 'Highlight colour'],
    });
    setSheetLayout(descriptions, [12, 36, 28, 16, 64, 16, 18]);

    XLSX.utils.book_append_sheet(workbook, summary, 'Summary');
    XLSX.utils.book_append_sheet(workbook, assets, 'Map Assets');
    XLSX.utils.book_append_sheet(workbook, descriptions, 'Descriptions');
    return { workbook, ledger, XLSX };
}

export async function downloadMyMapExcel(options = {}) {
    const [{ workbook, ledger, XLSX }, { saveAs }] = await Promise.all([
        createMyMapExcelWorkbook(options),
        import('file-saver'),
    ]);
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(
        new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        buildMyMapExcelFileName(ledger.mapName),
    );
}
