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
    height: 841.89,
    margin: 48,
};

const TYPE = {
    coverTitle: 16,
    coverMeta: 9,
    summaryLabel: 9,
    summaryValue: 15,
    sectionTitle: 12,
    summaryTable: 9.5,
    ledgerTable: 9.5,
    footer: 8,
};

function resolveAutoTable(module) {
    return module?.default || module?.autoTable || module;
}

function writeCoverHeader(doc, ledger) {
    doc.setFillColor(...BRAND.teal);
    doc.rect(0, 0, PAGE.width, 64, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.coverTitle);
    doc.text(ledger.mapName, PAGE.margin, 28, { maxWidth: PAGE.width - (PAGE.margin * 2) });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.coverMeta);
    doc.text(`Generated ${ledger.generatedLabel}`, PAGE.margin, 48);
    doc.setTextColor(...BRAND.ink);
}

function writeLedgerFooter(doc, pageNumber) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.footer);
    doc.setTextColor(...BRAND.muted);
    doc.text(`Page ${pageNumber}`, PAGE.margin, PAGE.height - 32);
    doc.setTextColor(...BRAND.ink);
}

function writeLabelValue(doc, label, value, x, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.summaryLabel);
    doc.setTextColor(...BRAND.muted);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.summaryValue);
    doc.setTextColor(...BRAND.ink);
    doc.text(String(value), x, y + 22);
}

function writeSummary(doc, autoTable, ledger) {
    writeCoverHeader(doc, ledger);

    const { summary } = ledger;
    const top = 96;
    const columnWidth = (PAGE.width - (PAGE.margin * 2)) / 4;
    writeLabelValue(doc, 'Total resources', summary.resourceCount, PAGE.margin, top);
    writeLabelValue(doc, 'Categories', summary.categoryCount, PAGE.margin + columnWidth, top);
    writeLabelValue(doc, 'With notes', summary.resourcesWithNotesCount, PAGE.margin + (columnWidth * 2), top);
    writeLabelValue(doc, 'Total notes', summary.noteCount, PAGE.margin + (columnWidth * 3), top);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.sectionTitle);
    doc.setTextColor(...BRAND.tealDark);
    doc.text('Category summary', PAGE.margin, 164);

    autoTable(doc, {
        startY: 184,
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
            fontSize: TYPE.summaryTable,
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
    const prefix = note.dateLabel ? `[${note.dateLabel}] - ` : '';
    return `${prefix}${note.text}`;
}

function buildResourceRows(category) {
    return category.resources.map((resource) => [
        resource.name,
        resource.address,
        resource.notes.length > 0 ? resource.notes.map(formatNote).join('\n\n') : 'No notes',
    ]);
}

function writeLedger(doc, autoTable, ledger) {
    for (const category of ledger.categories) {
        doc.addPage();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(TYPE.sectionTitle);
        doc.setTextColor(...BRAND.tealDark);
        doc.text(category.name, PAGE.margin, 72, { maxWidth: PAGE.width - (PAGE.margin * 2) });

        autoTable(doc, {
            startY: 92,
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
                fontSize: TYPE.ledgerTable,
                cellPadding: 6,
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
            margin: { left: PAGE.margin, right: PAGE.margin, top: 60 },
            didDrawPage: () => writeLedgerFooter(doc, doc.internal.getNumberOfPages()),
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
    doc.setProperties({
        title: ledger.mapName,
        subject: 'CareAround SG My Map PDF ledger',
    });

    writeSummary(doc, autoTable, ledger);
    writeLedger(doc, autoTable, ledger);
    doc.save(buildMyMapPdfFileName(ledger.mapName));
}
