import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRoots = ['client/src', 'server/src', 'scripts'];
const codeExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const importPattern = /\b(?:import\s*(?:[^'"()]*?\s+from\s*)?|export\s+[^'"()]*?\s+from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

async function collectFiles(relativeRoot) {
    const absoluteRoot = path.join(repoRoot, relativeRoot);
    const files = [];
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'output' || entry.name === 'graft') continue;
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(absolutePath);
            } else if (entry.isFile() && codeExtensions.has(path.extname(entry.name))) {
                files.push(absolutePath);
            }
        }
    }
    await visit(absoluteRoot);
    return files;
}

export function extractRelativeImports(source) {
    const imports = [];
    for (const match of source.matchAll(importPattern)) {
        if (match[1]?.startsWith('.')) imports.push(match[1]);
    }
    return imports;
}

async function isFile(candidate) {
    try {
        return (await stat(candidate)).isFile();
    } catch {
        return false;
    }
}

export async function resolveRelativeModule(importer, specifier) {
    const base = path.resolve(path.dirname(importer), specifier);
    const explicitExtension = path.extname(base);
    if (explicitExtension && !codeExtensions.has(explicitExtension)) return null;

    const candidates = explicitExtension
        ? [base]
        : [
            ...[...codeExtensions].map((extension) => `${base}${extension}`),
            ...[...codeExtensions].map((extension) => path.join(base, `index${extension}`)),
        ];
    for (const candidate of candidates) {
        if (await isFile(candidate)) return candidate;
    }
    throw new Error(`Unresolved relative module ${specifier} imported by ${path.relative(repoRoot, importer)}`);
}

export function findCycles(graph) {
    const cycles = [];
    const visited = new Set();
    const active = new Set();
    const stack = [];

    function visit(node) {
        if (active.has(node)) {
            const start = stack.indexOf(node);
            cycles.push([...stack.slice(start), node]);
            return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        active.add(node);
        stack.push(node);
        for (const dependency of graph.get(node) || []) visit(dependency);
        stack.pop();
        active.delete(node);
    }

    for (const node of graph.keys()) visit(node);
    return cycles;
}

export async function buildModuleGraph(roots = defaultRoots) {
    const files = (await Promise.all(roots.map(collectFiles))).flat();
    const fileSet = new Set(files);
    const graph = new Map(files.map((file) => [file, []]));
    let edgeCount = 0;

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        for (const specifier of extractRelativeImports(source)) {
            const dependency = await resolveRelativeModule(file, specifier);
            if (!dependency || !fileSet.has(dependency)) continue;
            graph.get(file).push(dependency);
            edgeCount += 1;
        }
    }
    return { graph, files, edgeCount };
}

async function main() {
    const { graph, files, edgeCount } = await buildModuleGraph();
    const cycles = findCycles(graph);
    if (cycles.length > 0) {
        const formatted = cycles.map((cycle) => cycle
            .map((file) => path.relative(repoRoot, file))
            .join(' -> '));
        throw new Error(`Circular relative imports detected:\n${formatted.join('\n')}`);
    }
    process.stdout.write(`Validated ${files.length} source modules and ${edgeCount} relative import edges; no cycles found.\n`);
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
    main().catch((error) => {
        process.stderr.write(`Module graph validation failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}
