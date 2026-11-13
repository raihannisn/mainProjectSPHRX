#!/usr/bin/env node
/**
 * Production build for the SPHEREx web frontend service.
 *
 * Copies only public runtime assets into dist/, excluding internal design
 * documents (DESIGN*.md, plan-*.md, ui_ux_*.md), screenshots, drawings, and
 * the design manifest. `spherex-expedition.html` is copied as `index.html`
 * so the root path `/` resolves without a service-level rewrite.
 *
 * The HTML is self-contained (no external asset references — verified by
 * grep during Phase 2), so a single-file copy is sufficient.
 */
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, 'dist')
const source = join(root, 'spherex-expedition.html')

if (!existsSync(source)) {
  console.error('build.mjs: spherex-expedition.html not found')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
copyFileSync(source, join(outDir, 'index.html'))

console.log('build.mjs: copied spherex-expedition.html -> dist/index.html')
