import { buildMyMapPdfFileName, buildMyMapPdfLedger } from './myMapPdfLedger.js';
import { buildPdfMarkdownLines } from './myMapPdfMarkdown.js';
import { buildMapNotesArchive, buildMapNotesExportResources, readMapNotesExportImage } from './mapNotesExport.js';
import FileSaver from 'file-saver';

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

const SUMMARY_LAYOUT = {
    metricsTop: 88,
    metricValueOffset: 18,
    titleY: 140,
    tableStartY: 156,
};

const LEDGER_LAYOUT = {
    titleY: 58,
    titleLineHeight: 14,
    titleTableGap: 10,
    summaryToLedgerGap: 28,
    categoryGap: 26,
    minimumTableRoom: 112,
};

const LEDGER_CONTENT_WIDTH = PAGE.width - (PAGE.margin * 2);
const LEDGER_COLUMN_WIDTHS = {
    resource: 168,
    get notes() {
        return LEDGER_CONTENT_WIDTH - LEDGER_COLUMN_WIDTHS.resource;
    },
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
    doc.text(String(value), x, y + SUMMARY_LAYOUT.metricValueOffset);
}

function writeSummary(doc, autoTable, ledger) {
    writeCoverHeader(doc, ledger);

    const { summary } = ledger;
    const columnWidth = (PAGE.width - (PAGE.margin * 2)) / 4;
    writeLabelValue(doc, 'Total resources', summary.resourceCount, PAGE.margin, SUMMARY_LAYOUT.metricsTop);
    writeLabelValue(doc, 'Categories', summary.categoryCount, PAGE.margin + columnWidth, SUMMARY_LAYOUT.metricsTop);
    writeLabelValue(doc, 'With notes', summary.resourcesWithNotesCount, PAGE.margin + (columnWidth * 2), SUMMARY_LAYOUT.metricsTop);
    writeLabelValue(doc, 'Total notes', summary.noteCount, PAGE.margin + (columnWidth * 3), SUMMARY_LAYOUT.metricsTop);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.sectionTitle);
    doc.setTextColor(...BRAND.tealDark);
    doc.text('Category summary', PAGE.margin, SUMMARY_LAYOUT.titleY);

    autoTable(doc, {
        startY: SUMMARY_LAYOUT.tableStartY,
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

    return doc.lastAutoTable?.finalY || SUMMARY_LAYOUT.tableStartY;
}

function formatNote(note) {
    const prefix = note.dateLabel ? `[${note.dateLabel}] - ` : '';
    return `${prefix}${note.text}`;
}

function formatResourceIdentity(resource) {
    return [resource.reference ? `${resource.reference} - ${resource.name}` : resource.name, resource.address].filter(Boolean).join('\n');
}

function prefixFirstNoteLine(lines, note) {
    const prefix = `${note.reference ? `${note.reference} ` : ''}${note.dateLabel ? `[${note.dateLabel}] - ` : ''}`;
    if (!prefix) return lines;
    if (lines.length === 0) {
        return [{ text: prefix.trim(), fontStyle: 'normal', hasLink: false }];
    }

    return [
        {
            ...lines[0],
            text: `${prefix}${lines[0].text}`,
        },
        ...lines.slice(1),
    ];
}

function buildNoteLines(notes) {
    if (!notes.length) {
        return [{ text: 'No notes', fontStyle: 'italic', hasLink: false }];
    }

    return notes.flatMap((note, index) => {
        const lines = prefixFirstNoteLine(
            buildPdfMarkdownLines(note.markdownText || note.text),
            note,
        );
        const fallbackLines = lines.length > 0
            ? lines
            : [{ text: formatNote(note), fontStyle: 'normal', hasLink: false }];

        return index === 0
            ? fallbackLines
            : [
                { text: '', fontStyle: 'normal', hasLink: false, spacer: true },
                ...fallbackLines,
            ];
    });
}

function buildNoteCell(line) {
    const styles = {
        fontStyle: line.fontStyle,
        textColor: line.hasLink ? BRAND.tealDark : BRAND.ink,
    };

    if (line.spacer) {
        styles.fontSize = 3;
        styles.cellPadding = { top: 2, right: 6, bottom: 2, left: 6 };
        styles.textColor = BRAND.muted;
    }

    return {
        content: line.text || ' ',
        styles,
    };
}

function buildResourceRows(category, doc, imageCache) {
    return category.resources.flatMap((resource) => {
        const noteLines = buildNoteLines(resource.notes);
        const rows = noteLines.map((line, index) => ({
            resource: index === 0 ? formatResourceIdentity(resource) : '',
            notes: buildNoteCell(line),
        }));
        // Keep each resource's photos immediately after its notes. Image rows
        // span the table so portraits and landscape photos stay readable.
        for (const image of resource.images || []) {
            const scale = Math.min((LEDGER_CONTENT_WIDTH - 12) / image.width, 240 / image.height, 0.75);
            const width = image.width * scale, height = image.height * scale;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(TYPE.ledgerTable);
            // The full identity is already in the notes row. Bound this repeated
            // caption so even an unusually long name cannot split a photo row.
            const name = resource.name.length > 240 ? `${resource.name.slice(0, 237)}...` : resource.name;
            const caption = doc.splitTextToSize(`${image.reference} - ${name}`, LEDGER_CONTENT_WIDTH - 12);
            const captionHeight = caption.length * TYPE.ledgerTable * doc.getLineHeightFactor();
            rows.push({
                resource: { content: caption, colSpan: 2, styles: {
                    fontStyle: 'bold', textColor: BRAND.tealDark,
                    minCellHeight: captionHeight + height + 24,
                } },
                noteImage: { image, bytes: imageCache.get(image.assetId), width, height, captionHeight },
            });
        }
        return rows;
    });
}

function needsFreshPage(currentY, titleLines) {
    const headingHeight = TYPE.sectionTitle
        + ((titleLines.length - 1) * LEDGER_LAYOUT.titleLineHeight);
    return currentY
        + headingHeight
        + LEDGER_LAYOUT.titleTableGap
        + LEDGER_LAYOUT.minimumTableRoom
        > PAGE.height - 72;
}

function writeLedger(doc, autoTable, ledger, imageCache) {
    let currentY = (doc.lastAutoTable?.finalY || SUMMARY_LAYOUT.tableStartY)
        + LEDGER_LAYOUT.summaryToLedgerGap;

    for (const category of ledger.categories) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(TYPE.sectionTitle);
        doc.setTextColor(...BRAND.tealDark);
        const categoryTitleLines = doc.splitTextToSize(category.name, PAGE.width - (PAGE.margin * 2));

        if (needsFreshPage(currentY, categoryTitleLines)) {
            doc.addPage();
            currentY = LEDGER_LAYOUT.titleY;
        }

        doc.text(categoryTitleLines, PAGE.margin, currentY);
        const tableStartY = currentY
            + ((categoryTitleLines.length - 1) * LEDGER_LAYOUT.titleLineHeight)
            + LEDGER_LAYOUT.titleTableGap
            + TYPE.sectionTitle;

        autoTable(doc, {
            startY: tableStartY,
            head: [['Resource / Address', 'Notes']],
            body: buildResourceRows(category, doc, imageCache),
            rowPageBreak: 'avoid',
            theme: 'grid',
            columns: [
                { header: 'Resource / Address', dataKey: 'resource' },
                { header: 'Notes', dataKey: 'notes' },
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
            tableWidth: LEDGER_CONTENT_WIDTH,
            columnStyles: {
                resource: {
                    cellWidth: LEDGER_COLUMN_WIDTHS.resource,
                    overflow: 'linebreak',
                },
                notes: {
                    cellWidth: LEDGER_COLUMN_WIDTHS.notes,
                    overflow: 'linebreak',
                    minCellWidth: LEDGER_COLUMN_WIDTHS.notes,
                },
            },
            margin: { left: PAGE.margin, right: PAGE.margin, top: 60, bottom: 56 },
            didDrawCell: ({ section, column, row, cell }) => {
                const photo = row.raw?.noteImage;
                if (section !== 'body' || column.dataKey !== 'resource' || !photo) return;
                const { image, bytes, width, height, captionHeight } = photo;
                doc.addImage(bytes, image.mimeType === 'image/jpeg' ? 'JPEG' : image.mimeType === 'image/webp' ? 'WEBP' : 'PNG',
                    cell.x + (cell.width - width) / 2, cell.y + captionHeight + 12,
                    width, height, image.assetId, 'FAST');
            },
            didDrawPage: () => writeLedgerFooter(doc, doc.internal.getNumberOfPages()),
        });

        currentY = (doc.lastAutoTable?.finalY || tableStartY) + LEDGER_LAYOUT.categoryGap;
    }
}

export async function createMyMapPdfDownload({
    directory,
    presentation,
    generatedAt = new Date(),
    locale = 'en-SG',
    signal,
    readImage = readMapNotesExportImage,
} = {}) {
    signal?.throwIfAborted();
    const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);
    const autoTable = resolveAutoTable(autoTableModule);
    let ledger = buildMyMapPdfLedger({ directory, presentation, generatedAt, locale });
    const resources = buildMapNotesExportResources(ledger);
    const imageCount = resources.reduce((count, resource) => count + resource.images.length, 0);
    const totalImageBytes = resources.reduce((total, resource) => total + resource.images.reduce((sum, image) => sum + image.size, 0), 0);
    if (totalImageBytes > 64 * 1024 * 1024) {
        throw Object.assign(new Error('Note image export exceeds 64 MB.'), { code: 'map_notes_export_too_large' });
    }
    if (imageCount) {
        const byKey = new Map(resources.map(resource => [resource.assetKey, resource]));
        ledger = { ...ledger, categories: ledger.categories.map(category => ({ ...category,
            resources: category.resources.map(resource => byKey.get(resource.assetKey)) })) };
    }
    const pdfName = buildMyMapPdfFileName(ledger.mapName);
    const imageFiles = {};
    const imageCache = new Map();
    for (const resource of resources) {
        for (const image of resource.images) {
            signal?.throwIfAborted();
            if (!imageCache.has(image.assetId)) imageCache.set(image.assetId, await readImage({ mapId: directory?.id, image, signal }));
            const bytes = imageCache.get(image.assetId);
            signal?.throwIfAborted();
            imageFiles[image.filename] = bytes;
        }
    }
    signal?.throwIfAborted();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.setProperties({
        title: ledger.mapName,
        subject: 'CareAround SG Care Map PDF ledger',
    });
    writeSummary(doc, autoTable, ledger);
    writeLedger(doc, autoTable, ledger, imageCache);
    if (!imageCount) return { blob: doc.output('blob'), filename: pdfName };
    const bytes = await buildMapNotesArchive({ ledger, resources, imageFiles, pdf: doc.output('arraybuffer') });
    signal?.throwIfAborted();
    return { blob: new Blob([bytes], { type: 'application/zip' }), filename: pdfName.replace(/-ledger\.pdf$/, '-notes-and-images.zip') };
}

export async function downloadMyMapPdf(options = {}) {
    const file = await createMyMapPdfDownload(options);
    options.signal?.throwIfAborted();
    FileSaver.saveAs(file.blob, file.filename);
}
