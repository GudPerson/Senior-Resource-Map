import { loadMapNoteImage, mapNoteImageFilename } from './mapNoteImages.js';
import { buildMyMapPdfFileName } from './myMapPdfLedger.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function buildMapNotesExportResources(ledger) {
    let number = 0;
    return ledger.categories.flatMap(category => category.resources.map(resource => {
        const reference = `R${String(++number).padStart(3, '0')}`;
        return {
            ...resource,
            reference,
            notes: resource.notes.map((note, index) => ({ ...note, reference: `${reference}-N${index + 1}` })),
            images: (resource.images || []).map((image, index) => {
                const imageReference = `${reference}-I${index + 1}`;
                return { ...image, reference: imageReference,
                    filename: `images/${reference}/${imageReference}-${mapNoteImageFilename(resource.name, index, image.mimeType)}` };
            }),
        };
    }));
}

export function buildMapNotesImageIndex(ledger, resources) {
    const sections = resources.map(resource => `<section id="${resource.reference}">
<h2>${resource.reference} — ${escapeHtml(resource.name)}</h2>
<p>${escapeHtml(resource.category)}<br>${escapeHtml(resource.address)}</p>
${resource.notes.length ? resource.notes.map(note => `<article><h3>${note.reference}${note.dateLabel ? ` · ${escapeHtml(note.dateLabel)}` : ''}</h3><p class="note">${escapeHtml(note.text)}</p></article>`).join('') : '<p>No text notes.</p>'}
${resource.images.length ? '<p>These images belong to this resource’s notes. Individual text-note links have not been recorded.</p>' : ''}
${resource.images.map(image => `<figure><a href="${escapeHtml(image.filename)}"><img loading="lazy" src="${escapeHtml(image.filename)}" alt="${escapeHtml(`${image.reference} — ${resource.name}`)}"></a><figcaption>${image.reference} — ${escapeHtml(resource.name)}<br><a href="${escapeHtml(image.filename)}" download>Download image</a></figcaption></figure>`).join('')}
</section>`).join('');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(ledger.mapName)} — Notes and images</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#1f2937}h1,h2{color:#07524f}section{border-top:2px solid #dce2e8;margin-top:32px;padding-top:16px}.note{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:24px 0}img{max-width:100%;max-height:75vh;object-fit:contain}figcaption{font-weight:600}a{color:#07524f}</style>
<h1>${escapeHtml(ledger.mapName)}</h1><p>Notes and images · Generated ${escapeHtml(ledger.generatedLabel)}</p>
<p>Extract the ZIP before opening this index. Resource references match the PDF, image folders and filenames.</p>
<p><a href="${escapeHtml(buildMyMapPdfFileName(ledger.mapName))}">Open notes PDF</a></p>${sections}</html>`;
}

// Use the same authenticated, bounded decoder as the gallery. Read sequentially
// and release each decoded image before loading the next one.
export async function readMapNotesExportImage({ mapId, image, signal,
    loadImage = loadMapNoteImage, createObjectURL = value => URL.createObjectURL(value),
    revokeObjectURL = value => URL.revokeObjectURL(value), timeoutMs = 20000 }) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    let blob, url;
    try {
        const source = await loadImage({ mapId, image, signal: controller.signal,
            createObjectURL: value => { blob = value; return createObjectURL(value); }, revokeObjectURL });
        url = source.url;
        controller.signal.throwIfAborted();
        if (!blob || blob.type.split(';')[0] !== image.mimeType) throw new Error('Invalid note image response.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        controller.signal.throwIfAborted();
        return bytes;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (url) revokeObjectURL(url);
    }
}

export async function buildMapNotesArchive({ ledger, resources, imageFiles, pdf }) {
    const { zip, strToU8 } = await import('fflate');
    const manifest = {
        mapName: ledger.mapName, generatedAt: ledger.generatedAt,
        imageAssociation: 'resource-notes',
        resources: resources.map(resource => ({ reference: resource.reference, name: resource.name,
            category: resource.category, address: resource.address,
            notes: resource.notes.map(note => ({ reference: note.reference, text: note.text, date: note.dateLabel })),
            images: resource.images.map(image => ({ reference: image.reference, filename: image.filename })) })),
    };
    const files = {
        ...imageFiles,
        [buildMyMapPdfFileName(ledger.mapName)]: new Uint8Array(pdf),
        'index.html': strToU8(buildMapNotesImageIndex(ledger, resources)),
        'notes-and-images.json': strToU8(JSON.stringify(manifest, null, 2)),
    };
    // Photos and PDFs are already compressed; STORE avoids worker overhead and
    // costly recompression on phones. fflate's callback yields between entries.
    return new Promise((resolve, reject) => zip(files, { level: 0 }, (error, bytes) => error ? reject(error) : resolve(bytes)));
}
