export class MapMediaBucket {
    objects = new Map(); counter = 0; beforePut = null;
    async get(key) {
        const stored = this.objects.get(key);
        if (!stored) return null;
        const bytes = stored.bytes.slice();
        return { etag: stored.etag, size: bytes.length, body: new Response(bytes).body,
            httpMetadata: stored.httpMetadata, customMetadata: stored.customMetadata,
            json: async () => JSON.parse(new TextDecoder().decode(bytes)) };
    }
    async put(key, value, options = {}) {
        if (this.beforePut) await this.beforePut(key);
        const prior = this.objects.get(key), condition = options.onlyIf;
        if (condition instanceof Headers && condition.get('If-None-Match') === '*' && prior) return null;
        if (condition?.etagMatches && prior?.etag !== condition.etagMatches) return null;
        const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value).slice();
        const object = { bytes, etag: `etag-${++this.counter}`, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} };
        this.objects.set(key, object);
        return { etag: object.etag };
    }
}

export function png({ width = 1, height = 1, variant = 0, size } = {}) {
    const original = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64'));
    const bytes = new Uint8Array(size || original.length + 1); bytes.set(original);
    const view = new DataView(bytes.buffer); view.setUint32(16, width); view.setUint32(20, height);
    bytes[bytes.length - 1] = variant;
    return bytes;
}

export function whereValues(where) {
    const result = [];
    const visit = (value) => {
        if (!value || typeof value !== 'object') return;
        if (value.constructor?.name === 'Param') result.push(value.value);
        else if (Array.isArray(value.queryChunks)) value.queryChunks.forEach(visit);
    };
    visit(where); return result;
}
