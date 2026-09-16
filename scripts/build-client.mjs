/**
 * Build the dsh-volcengine-usage client bundle.
 *
 * Takes the ESM source at lib/client/index.mjs and produces a
 * `window.__ModuleLoader__.load({…})` bundle at lib/client.js.
 *
 * Usage:
 *   node scripts/build-client.mjs          # build
 *   node scripts/build-client.mjs --check  # check only (compare hash)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ENTRY = join(ROOT, 'lib', 'client', 'index.mjs')
const OUT = join(ROOT, 'lib', 'client.js')
const CHECK = process.argv.includes('--check')

async function main() {
  if (!existsSync(ENTRY)) {
    console.log('[build] no ESM source at lib/client/index.mjs — skipping, lib/client.js is shipped as pre-built')
    process.exit(0)
  }

  let esbuild
  try {
    esbuild = await import('esbuild')
  } catch {
    console.error('[build] esbuild is required to rebuild the client bundle: pnpm install -D esbuild')
    process.exit(CHECK ? 1 : 0)
  }

  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    globalName: '__dshVolceUsage',
    minify: false,
    write: false,
  })

  const code = result.outputFiles[0].text
  const wrapped = [
    'window.__ModuleLoader__.load({',
    '  id: "dsh-volcengine-usage",',
    '  factory: (require) => {',
    '    var module = { exports: {} };',
    '    var exports = module.exports;',
    '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    '',
    code,
    '',
    '    exports.name = "dsh-volcengine-usage"',
    '    return module.exports',
    '  }',
    '})',
  ].join('\n')

  if (CHECK) {
    const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
    const existingHash = createHash('sha256').update(existing).digest('hex').slice(0, 12)
    const builtHash = createHash('sha256').update(wrapped).digest('hex').slice(0, 12)
    if (existingHash !== builtHash) {
      console.error(`[build] CHECK FAILED: lib/client.js hash ${existingHash} !== built ${builtHash}`)
      process.exit(1)
    }
    console.log(`[build] check passed: lib/client.js (${existingHash}) is up to date`)
  } else {
    writeFileSync(OUT, wrapped, 'utf8')
    console.log(`[build] wrote ${OUT} (${wrapped.length} bytes)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})