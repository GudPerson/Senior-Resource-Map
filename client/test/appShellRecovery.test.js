import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const recoverySource = fs.readFileSync(
    new URL('../public/app-shell-recovery-20260721-1.js', import.meta.url),
    'utf8',
);

function createElement(tagName) {
    return {
        tagName,
        style: {},
        textContent: '',
        children: [],
        listeners: {},
        setAttribute(name, value) {
            this[name] = value;
        },
        append(...nodes) {
            this.children.push(...nodes);
        },
        appendChild(node) {
            this.children.push(node);
        },
        replaceChildren(...nodes) {
            this.children = nodes;
        },
        addEventListener(name, callback) {
            this.listeners[name] = callback;
        },
        get childElementCount() {
            return this.children.length;
        },
    };
}

function findElement(root, tagName) {
    if (root?.tagName === tagName) return root;
    for (const child of root?.children || []) {
        const match = findElement(child, tagName);
        if (match) return match;
    }
    return null;
}

test('blank client shell offers a same-origin cache-busted entry retry', () => {
    const root = createElement('div');
    const entryScript = {
        src: 'https://app.carearound.sg/assets/index-stale123.js',
    };
    const scheduled = [];
    const appendedToHead = [];
    const document = {
        querySelector: () => entryScript,
        getElementById: (id) => (id === 'root' ? root : null),
        createElement,
        head: {
            appendChild(node) {
                appendedToHead.push(node);
            },
        },
        body: {
            contains(node) {
                return root.children.includes(node);
            },
        },
    };
    const window = {
        location: {
            href: 'https://app.carearound.sg/',
            origin: 'https://app.carearound.sg',
        },
        setTimeout(callback, delay) {
            scheduled.push({ callback, delay });
            return scheduled.length;
        },
    };

    vm.runInNewContext(recoverySource, {
        Date: { now: () => 123456789 },
        Object,
        String,
        URL,
        document,
        window,
    });

    assert.equal(scheduled[0].delay, 6000);
    scheduled[0].callback();

    const retryButton = findElement(root, 'button');
    assert.ok(retryButton);
    assert.equal(retryButton.textContent, 'Load latest app');

    retryButton.listeners.click();

    assert.equal(appendedToHead.length, 1);
    assert.equal(appendedToHead[0].type, 'module');
    assert.equal(
        appendedToHead[0].src,
        'https://app.carearound.sg/assets/index-stale123.js?carearound-retry=123456789',
    );
    assert.equal(scheduled[1].delay, 10000);
});
