/**
 * Inline the Volcano Engine brand mark into lib/client.js.
 *
 * The client bundle must stay self-contained (DSH serves it as one script), so
 * the mark travels as a data URI. The placeholder below is replaced with the
 * base64 of assets/volcengine-mark-64.png.
 *
 * Usage: node scripts/embed-logo.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MARK = join(ROOT, 'assets', 'volcengine-mark-64.png')
const CLIENT = join(ROOT, 'lib', 'client.js')
const PLACEHOLDER = '__VOLCENGINE_MARK_BASE64__'

const base64 = readFileSync(MARK).toString('base64')
const source = readFileSync(CLIENT, 'utf8')

if (!source.includes(PLACEHOLDER)) {
  // Already embedded (or the placeholder was renamed): report and stop.
  const alreadyEmbedded = /data:image\/png;base64,[A-Za-z0-9+/=]{500,}/.test(source)
  console.log(alreadyEmbedded
    ? '[embed-logo] mark already embedded — nothing to do'
    : `[embed-logo] placeholder ${PLACEHOLDER} not found in lib/client.js`)
  process.exit(alreadyEmbedded ? 0 : 1)
}

writeFileSync(CLIENT, source.replace(PLACEHOLDER, base64), 'utf8')
console.log(`[embed-logo] embedded ${base64.length} base64 chars from assets/volcengine-mark-64.png`)
