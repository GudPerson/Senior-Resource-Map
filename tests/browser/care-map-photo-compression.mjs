// Real browser encoding of synthetic photos/graphics; no user data or API writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || '/tmp/care-map-photo-compression';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4219 } });
const report = { boundary: 'Actual upload normalizer, Chromium canvas encoders and synthetic images; no production reads/writes.', cases: [] };
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls.local[0]);
    const results = await page.evaluate(async moduleUrl => {
        const { normalizeAnnotationImageFile } = await import(moduleUrl);
        const encode = (canvas, mime, quality) => new Promise(resolve => canvas.toBlob(resolve, mime, quality));
        const run = async (name, canvas, mime) => {
            const source = await encode(canvas, mime, 0.96);
            const result = await normalizeAnnotationImageFile(new File([source], name, { type: mime }));
            const bitmap = await createImageBitmap(result.blob);
            const decoded = document.createElement('canvas'); decoded.width = bitmap.width; decoded.height = bitmap.height;
            const ctx = decoded.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
            const expected = document.createElement('canvas'); expected.width = result.width; expected.height = result.height;
            expected.getContext('2d').drawImage(canvas, 0, 0, expected.width, expected.height);
            const actual = ctx.getImageData(0, 0, decoded.width, decoded.height).data;
            const original = expected.getContext('2d').getImageData(0, 0, expected.width, expected.height).data;
            let squaredError = 0;
            for (let i = 0; i < actual.length; i++) if (i % 4 !== 3) squaredError += (actual[i] - original[i]) ** 2;
            const mse = squaredError / (actual.length * 0.75);
            return { name, inputBytes: source.size, bytes: result.blob.size, mime: result.blob.type,
                width: result.width, height: result.height, decodedWidth: decoded.width, decodedHeight: decoded.height,
                psnr: mse === 0 ? null : 10 * Math.log10(255 ** 2 / mse), cornerAlpha: actual[3],
                base64: await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(result.blob); }) };
        };
        // A detailed, photographic-size fixture with smooth areas, texture and signs.
        const photo = document.createElement('canvas'); photo.width = 4000; photo.height = 3000;
        const ctx = photo.getContext('2d'); const pixels = ctx.createImageData(photo.width, photo.height);
        let seed = 123456789;
        for (let y = 0; y < photo.height; y++) for (let x = 0; x < photo.width; x++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const noise = ((seed >>> 24) - 128) / 5, index = (y * photo.width + x) * 4;
            pixels.data[index] = 70 + x / 35 + noise;
            pixels.data[index + 1] = 105 + y / 35 + noise;
            pixels.data[index + 2] = 150 + 30 * Math.sin(x / 220) + noise;
            pixels.data[index + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0); ctx.fillStyle = '#f8fafc'; ctx.fillRect(300, 300, 3400, 650);
        ctx.fillStyle = '#134e4a'; ctx.font = 'bold 150px sans-serif'; ctx.fillText('Fictional Community Hub', 420, 550);
        ctx.font = '90px sans-serif'; ctx.fillText('Visits: Monday to Friday, 9 am to 5 pm', 420, 750);
        const results = [];
        for (const mime of ['image/jpeg', 'image/png', 'image/webp']) results.push(await run(`photo-${mime.split('/')[1]}`, photo, mime));
        const graphic = document.createElement('canvas'); graphic.width = 1200; graphic.height = 800;
        const g = graphic.getContext('2d'); g.fillStyle = '#0f766e'; g.fillRect(100, 100, 1000, 600);
        g.fillStyle = 'white'; g.font = '48px sans-serif'; g.fillText('Keep this transparent margin', 160, 400);
        results.push(await run('transparent-graphic', graphic, 'image/png'));
        const text = document.createElement('canvas'); text.width = 600; text.height = 400;
        const t = text.getContext('2d'); t.fillStyle = 'white'; t.fillRect(0, 0, 600, 400);
        t.fillStyle = 'black'; t.font = '18px sans-serif'; t.fillText('Small text stays sharp and lossless.', 30, 80);
        results.push(await run('small-text', text, 'image/png'));
        return results;
    }, `/@fs${path.join(root, 'client/src/lib/annotationMedia.js')}`);
    for (const item of results) {
        const { base64, ...evidence } = item;
        assert.equal(item.width, item.decodedWidth); assert.equal(item.height, item.decodedHeight);
        assert.ok(Math.max(item.width, item.height) <= 1600);
        if (item.name.startsWith('photo-')) {
            assert.ok(['image/jpeg', 'image/png'].includes(item.mime));
            assert.ok(item.bytes <= 500 * 1024);
            assert.ok(item.bytes < item.inputBytes / 2, 'large input is substantially smaller');
            assert.ok(item.width >= 1024 && item.height >= 768, 'useful slide/web dimensions survive');
            assert.ok(item.psnr === null || item.psnr > 30, 'encoding retains image detail');
        } else {
            assert.equal(item.mime, 'image/png'); assert.equal(item.psnr, null, 'small graphics remain lossless');
            if (item.name === 'transparent-graphic') assert.equal(item.cornerAlpha, 0);
            else assert.equal(item.width, 600, 'small inputs are never enlarged');
        }
        await fs.writeFile(path.join(out, `${item.name}.${item.mime === 'image/jpeg' ? 'jpg' : 'png'}`), Buffer.from(base64, 'base64'));
        report.cases.push(evidence);
    }
} catch (error) { report.failure = error.stack; throw error; }
finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
}
