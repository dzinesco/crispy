import { copyFileSync } from 'fs'
// Browsers still request /favicon.ico; keep a real file in dist so nginx
// does not SPA-fallback to index.html. PNG bytes in an .ico path are fine.
copyFileSync('public/favicon-32.png', 'public/favicon.ico')
