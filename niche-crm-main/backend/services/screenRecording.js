// WebRTC screen recording service
const fs = require('fs');
const path = require('path');

const recordingsDir = path.join(__dirname, '../../recordings');

if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

function saveRecording(filename, data) {
    const filepath = path.join(recordingsDir, filename);
    fs.writeFileSync(filepath, data);
    return filepath;
}

module.exports = { saveRecording };