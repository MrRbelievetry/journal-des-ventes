const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor');

const files = [
  ['pdfjs-dist', 'build/pdf.min.js', 'pdf.min.js'],
  ['pdfjs-dist', 'build/pdf.worker.min.js', 'pdf.worker.min.js'],
  ['jspdf', 'dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
  ['jspdf-autotable', 'dist/jspdf.plugin.autotable.min.js', 'jspdf.plugin.autotable.min.js'],
  ['xlsx', 'dist/xlsx.full.min.js', 'xlsx.full.min.js']
];

fs.mkdirSync(vendorDir, { recursive: true });

for (const [packageName, relativeFile, toFile] of files) {
  const packageRoot = path.join(root, 'node_modules', packageName);
  const source = path.join(packageRoot, relativeFile);
  const target = path.join(vendorDir, toFile);
  fs.copyFileSync(source, target);
  console.log(`${packageName}/${relativeFile} -> vendor/${toFile}`);
}
