import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Load application helpers for Node's test runner without a development server.
// Dependencies stay external so tests and components share the same React instance.
export async function loadTestModules(entries) {
  const webRoot = fileURLToPath(new URL('..', import.meta.url));
  const directory = await mkdtemp(join(webRoot, '.test-modules-'));
  try {
    const result = await build({
      stdin: {
        contents: entries.map((entry, index) => `export * as entry${index} from ${JSON.stringify(entry)};`).join('\n'),
        resolveDir: webRoot,
        sourcefile: 'test-entry.ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      packages: 'external',
      jsx: 'automatic',
      define: { 'import.meta.env': '{}' },
      plugins: [{
        name: 'ignore-test-styles',
        setup(builder) {
          builder.onResolve({ filter: /\.css$/ }, (args) => ({ path: args.path, namespace: 'test-styles' }));
          builder.onLoad({ filter: /.*/, namespace: 'test-styles' }, () => ({ contents: '', loader: 'js' }));
        },
      }],
    });
    const output = join(directory, 'entry.mjs');
    await writeFile(output, result.outputFiles[0].contents);
    return await import(pathToFileURL(output).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
