const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('c:/Users/hendr/OneDrive/Documents/AG-2026/AIBILL-RADIUS-main/src/app/api', (filePath) => {
    if (!filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // We look for await [var].connect()
    // It's usually "await conn.connect()" or "await api.connect()"
    
    const apiMatch = content.match(/await\s+api\.connect\(\);?/);
    const connMatch = content.match(/await\s+conn\.connect\(\);?/);
    
    let modified = false;
    
    if (apiMatch && !content.includes("api.on('error'")) {
        content = content.replace(/(await\s+api\.connect\(\);?)/g, "$1\n          api.on('error', (err: any) => console.warn('Trapped routeros error:', err.message || err));");
        modified = true;
    }
    
    if (connMatch && !content.includes("conn.on('error'")) {
        content = content.replace(/(await\s+conn\.connect\(\);?)/g, "$1\n          conn.on('error', (err: any) => console.warn('Trapped routeros error:', err.message || err));");
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched:', filePath);
    }
});
