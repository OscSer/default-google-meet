const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const buildDir = 'build';
const extensionDir = 'extension';
const outputFile = path.join(buildDir, 'extension.zip');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Create output stream
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
  zlib: { level: 9 }, // Maximum compression
});

// Listen for archive events
output.on('close', () => {
  console.log(`Extension packaged: ${outputFile} (${archive.pointer()} bytes)`);
});

archive.on('error', err => {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add extension directory contents to the archive
archive.directory(extensionDir, false);

// Finalize the archive
archive.finalize();
