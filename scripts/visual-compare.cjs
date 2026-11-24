const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const PORT = 8089;
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url?.split('?')[0] || '/';
      const filePath = path.join(ROOT, urlPath === '/' ? 'dist/index.html' : urlPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

async function run() {
  const stepName = process.argv[2] || 'step1_base';
  const outDir = path.join(ROOT, 'visual_tests', 'output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Ensure latest build exists
  console.log('Building project before capturing screenshots...');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

  const server = await startServer();
  console.log(`Server started on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    executablePath: fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  });

  const page = await context.newPage();

  async function capture(url, theme, outName) {
    // Set theme in localStorage before page load
    await page.goto(`http://localhost:${PORT}/legacy/index.html`);
    await page.evaluate((th) => {
      localStorage.setItem('set_v1', JSON.stringify({ theme: th, lang: 'ru' }));
    }, theme);

    await page.goto(url, { waitUntil: 'networkidle' });
    // Ensure document has attribute
    await page.evaluate((th) => {
      document.documentElement.setAttribute('data-theme', th);
    }, theme);

    // Give squircle ResizeObserver and layout a moment to settle
    await page.waitForTimeout(600);

    if (stepName === 'step4_add') {
      // Open add sheet
      await page.click('[data-act="expense"]');
      await page.waitForTimeout(600);
    } else if (stepName === 'step4_dp') {
      // Open add sheet then date picker
      await page.click('[data-act="expense"]');
      await page.waitForTimeout(400);
      await page.click('#a-date');
      await page.waitForTimeout(600);
    }

    const outPath = path.join(outDir, outName);
    await page.screenshot({ path: outPath, fullPage: false });
    return outPath;
  }

  try {
    console.log('Capturing Legacy Dark...');
    const legDark = await capture(`http://localhost:${PORT}/legacy/index.html`, 'dark', 'temp_legacy_dark.png');

    console.log('Capturing React Dark...');
    const reactDark = await capture(`http://localhost:${PORT}/dist/index.html`, 'dark', 'temp_react_dark.png');

    console.log('Capturing Legacy Light...');
    const legLight = await capture(`http://localhost:${PORT}/legacy/index.html`, 'light', 'temp_legacy_light.png');

    console.log('Capturing React Light...');
    const reactLight = await capture(`http://localhost:${PORT}/dist/index.html`, 'light', 'temp_react_light.png');

    // Stitch
    const outDark = path.join(outDir, `${stepName}_dark.png`);
    const outLight = path.join(outDir, `${stepName}_light.png`);

    console.log('Stitching dark comparison...');
    execSync(`python3 "${path.join(ROOT, 'scripts', 'stitch.py')}" "${legDark}" "${reactDark}" "${outDark}" "Dark Theme"`, { stdio: 'inherit' });

    console.log('Stitching light comparison...');
    execSync(`python3 "${path.join(ROOT, 'scripts', 'stitch.py')}" "${legLight}" "${reactLight}" "${outLight}" "Light Theme"`, { stdio: 'inherit' });

    // Clean temp
    [legDark, reactDark, legLight, reactLight].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    console.log('Done! Visual comparisons generated:');
    console.log(`- ${outDark}`);
    console.log(`- ${outLight}`);
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
