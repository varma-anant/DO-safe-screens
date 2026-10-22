import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptsDir, '..')
const repoDir = path.resolve(frontendDir, '..')
const distDir = path.join(frontendDir, '.singlefile-dist')
const outputFile = path.join(repoDir, 'do-safe-screens.html')

const fonts = [
  {
    family: 'Inter',
    weight: '400 700',
    url: 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2',
  },
  {
    family: 'JetBrains Mono',
    weight: '400 500',
    url: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwgknk-4.woff2',
  },
]

const files = await readdir(path.join(distDir, 'assets'))
const jsFiles = files.filter((name) => name.endsWith('.js'))
const cssFiles = files.filter((name) => name.endsWith('.css'))

if (jsFiles.length !== 1 || cssFiles.length !== 1) {
  throw new Error(`Expected one JavaScript and one CSS bundle; found ${jsFiles.length} JS and ${cssFiles.length} CSS files.`)
}

let html = await readFile(path.join(distDir, 'index.html'), 'utf8')
const appCss = await readFile(path.join(distDir, 'assets', cssFiles[0]), 'utf8')
const js = (await readFile(path.join(distDir, 'assets', jsFiles[0]), 'utf8')).replace(/<\/script/gi, '<\\/script')

const fontCss = await Promise.all(fonts.map(async (font) => {
  const response = await fetch(font.url)
  if (!response.ok) throw new Error(`Could not download ${font.family}: HTTP ${response.status}`)
  const encoded = Buffer.from(await response.arrayBuffer()).toString('base64')
  return `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};font-display:swap;src:url(data:font/woff2;base64,${encoded}) format('woff2')}`
}))
const css = `${fontCss.join('')}\n${appCss}`

// Everything required by the application is embedded. The Google Font links are
// removed so a recipient can double-click the file without network access; the app's
// existing system-font fallbacks preserve the same layout and typography hierarchy.
html = html
  .replace(/\s*<link rel="icon"[^>]*>/g, '')
  .replace(/\s*<link rel="preconnect"[^>]*>/g, '')
  .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
  .replace(/<link\b[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script\b[^>]*src="\.\/assets\/[^"]+\.js"[^>]*><\/script>/, () => `<script type="module">${js}</script>`)
  .replace('<title>DO SAFE Unified</title>', '<title>DO SAFE Unified — Standalone</title>')

if (/\.\/assets\//.test(html)) throw new Error('Generated HTML still contains external asset references.')

await writeFile(outputFile, html)
const size = Buffer.byteLength(html)
console.log(`Created ${outputFile} (${(size / 1024 / 1024).toFixed(2)} MB)`)
