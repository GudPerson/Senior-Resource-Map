import { buildMyMapPdfFileName, buildMyMapPdfLedger } from './myMapPdfLedger.js';

const BRAND = {
    teal: [13, 118, 112],
    tealDark: [7, 82, 79],
    ink: [31, 41, 55],
    muted: [107, 114, 128],
    line: [220, 226, 232],
    panel: [246, 249, 250],
};

const PAGE = {
    width: 595.28,
    margin: 48,
};

function resolveAutoTable(module) {
    return module?.default || module?.autoTable || module;
}

function writeHeader(doc, ledger) {
    doc.setFillColor(...BRAND.teal);
    doc.rect(0, 0, PAGE.width, 72, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(ledger.mapName, PAGE.margin, 32, { maxWidth: PAGE.width - (PAGE.margin * 2) });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated ${ledger.generatedLabel}`, PAGE.margin, 54);
    doc.setTextColor(...BRAND.ink);
}

function writeLabelValue(doc, label, value, x, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...BRAND.ink);
    doc.text(String(value), x, y + 22);
}

function writeSummary(doc, autoTable, ledger) {
    writeHeader(doc, ledger);

    const { summary } = ledger;
    const top = 104;
    const columnWidth = (PAGE.width - (PAGE.margin * 2)) / 4;
    writeLabelValue(doc, 'Total resources', summary.resourceCount, PAGE.margin, top);
    writeLabelValue(doc, 'Categories', summary.categoryCount, PAGE.margin + columnWidth, top);
    writeLabelValue(doc, 'With notes', summary.resourcesWithNotesCount, PAGE.margin + (columnWidth * 2), top);
    writeLabelValue(doc, 'Total notes', summary.noteCount, PAGE.margin + (columnWidth * 3), top);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BRAND.tealDark);
    doc.text('Category summary', PAGE.margin, 172);

    autoTable(doc, {
        startY: 192,
        head: [['Category', 'Resources', 'Resources with notes', 'Notes']],
        body: ledger.categories.map((category) => [
            category.name,
            category.resources.length,
            category.resources.filter((resource) => resource.notes.length > 0).length,
            category.resources.reduce((count, resource) => count + resource.notes.length, 0),
        ]),
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 6,
            textColor: BRAND.ink,
            lineColor: BRAND.line,
            lineWidth: 0.5,
        },
        headStyles: {
            fillColor: BRAND.tealDark,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        alternateRowStyles: {
            fillColor: BRAND.panel,
        },
        margin: { left: PAGE.margin, right: PAGE.margin },
    });
}

function formatNote(note) {
    const details = [note.visibility];
    if (note.updatedAt) details.push(`Updated ${note.updatedAt}`);
    return `${note.text} (${details.join('; ')})`;
}

function buildResourceRows(category) {
    return category.resources.map((resource) => [
        resource.name,
        resource.address,
        resource.notes.length > 0 ? resource.notes.map(formatNote).join('\n') : 'No notes',
    ]);
}

function writeLedger(doc, autoTable, ledger) {
    for (const category of ledger.categories) {
        doc.addPage();
        writeHeader(doc, ledger);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...BRAND.tealDark);
        doc.text(category.name, PAGE.margin, 108, { maxWidth: PAGE.width - (PAGE.margin * 2) });

        autoTable(doc, {
            startY: 128,
            head: [['Resource', 'Address', 'Notes']],
            body: buildResourceRows(category),
            theme: 'grid',
            columns: [
                { header: 'Resource', dataKey: 0 },
                { header: 'Address', dataKey: 1 },
                { header: 'Notes', dataKey: 2 },
            ],
            styles: {
                font: 'helvetica',
                fontSize: 8.5,
                cellPadding: 5,
                overflow: 'linebreak',
                valign: 'top',
                textColor: BRAND.ink,
                lineColor: BRAND.line,
                lineWidth: 0.5,
            },
            headStyles: {
                fillColor: BRAND.tealDark,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: BRAND.panel,
            },
            columnStyles: {
                0: { cellWidth: 150 },
                1: { cellWidth: 150 },
                2: { cellWidth: PAGE.width - (PAGE.margin * 2) - 300 },
            },
            margin: { left: PAGE.margin, right: PAGE.margin, top: 96 },
            didDrawPage: () => writeHeader(doc, ledger),
        });
    }
}

export async function downloadMyMapPdf({
    directory,
    presentation,
    generatedAt = new Date(),
    locale = 'en-SG',
} = {}) {
    const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);
    const autoTable = resolveAutoTable(autoTableModule);
    const ledger = buildMyMapPdfLedger({ directory, presentation, generatedAt, locale });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    writeSummary(doc, autoTable, ledger);
    writeLedger(doc, autoTable, ledger);
    doc.save(buildMyMapPdfFileName(ledger.mapName));
}
