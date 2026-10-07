const fs = require("node:fs");
const path = require("node:path");

function updatePackage(context = {}) {
  // Cordova supplies the project root; plugin source may live under src/ or plugins/.
  const root = context.opts?.projectRoot || process.cwd();
  const config = fs.readFileSync(path.join(root, "config.xml"), "utf8");
  const packageName = /<widget\b[^>]*\bid=["']([\w.]+)["']/.exec(config)?.[1];
  if (!packageName) throw new Error("Could not extract widget id from config.xml");
  for (const relative of [
    "com/foxdebug/browser/Menu.java",
    "com/foxdebug/acode/rk/exec/terminal/AlpineDocumentProvider.java",
  ]) {
    const file = path.join(root, "platforms/android/app/src/main/java", relative);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, source.replace(/\bimport\s+(?:com\.foxdebug\.acode(?:free)?|world\.synthia\.acode(?:free)?)\.R;/g, `import ${packageName}.R;`));
  }
}

module.exports = updatePackage;
if (require.main === module) updatePackage();
