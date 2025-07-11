import * as fs from 'fs';
import * as path from 'path';

const logDir = './log';

// Clear logs
if (fs.existsSync(logDir)) {
  fs.readdirSync(logDir).forEach((file) => {
    fs.writeFileSync(path.join(logDir, file), '', { flag: 'w' }); // Truncate each log file
  });
  console.log('Logs cleared.');
} else {
  fs.mkdirSync(logDir, { recursive: true });
  console.log('Log directory created.');
}
