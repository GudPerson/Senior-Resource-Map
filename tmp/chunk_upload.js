const fs = require('fs');
const readline = require('readline');

// subregionId is 186
const subregionId = 186;
const filePath = '/Users/sweetbuns/Documents/New project/tmp/SG Postal codes.csv';

async function processFile() {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const postalCodes = new Set();
    let firstLine = true;
    for await (const line of rl) {
      if (firstLine) {
        firstLine = false;
        continue;
      }
      const parts = line.split(',');
      if (parts.length >= 2) {
        const code = parts[1].trim();
        if (code && code !== 'postalCode' && code.length > 0) {
          // Normalize to 6 digits (Singapore standard)
          let normalized = code.padStart(6, '0');
          postalCodes.add(normalized);
        }
      }
    }

    const codesArray = Array.from(postalCodes);
    console.log(JSON.stringify(codesArray));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

processFile();
