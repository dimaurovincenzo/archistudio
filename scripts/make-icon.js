// Renders the ArchiStudio app icon (macOS squircle) to build/icon.png.
// Usage: electron scripts/make-icon.js
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const SVG = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a2130"/>
      <stop offset="1" stop-color="#10141d"/>
    </linearGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)" stroke="#3a455e" stroke-width="8"/>
  <path d="M300 340 L640 420 M340 390 L380 700 M660 460 L430 660" stroke="#3a455e" stroke-width="26" stroke-linecap="round"/>
  <circle cx="290" cy="330" r="72" fill="#22d3ee"/>
  <circle cx="660" cy="430" r="72" fill="#6366f1"/>
  <circle cx="410" cy="710" r="72" fill="#f59e0b"/>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, useContentSize: true })
  await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:transparent">${SVG}</body>`))
  await new Promise((r) => setTimeout(r, 400))
  const img = await win.webContents.capturePage()
  const out = path.join(__dirname, '..', 'build')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'icon.png'), img.toPNG())
  console.log('[icon] written to build/icon.png')
  app.quit()
})
