const fs = require("node:fs");
const path = require("node:path");

function changeProvider(reset = false, context = {}) {
  const root = context.opts?.projectRoot || process.cwd();
  const file = path.join(root, "platforms/android/app/src/main/AndroidManifest.xml");
  if (!fs.existsSync(file)) return; // First prepare has not generated it yet.
  const config = fs.readFileSync(path.join(root, "config.xml"), "utf8");
  const packageName = /<widget\b[^>]*\bid=["']([\w.]+)["']/.exec(config)?.[1];
  if (!packageName) throw new Error("Could not extract widget id from config.xml");
  const authority = reset ? "com.foxdebug.provider" : `${packageName}.provider`;
  const manifest = fs.readFileSync(file, "utf8");
  // Patch only this plugin's FileProvider. Other providers have their own authorities.
  const updated = manifest.replace(/<provider\b[^>]*>/g, tag => {
    if (!/\bandroid:name=["']androidx\.core\.content\.FileProvider["']/.test(tag)) return tag;
    const current = /\bandroid:authorities=["']([^"']+)["']/.exec(tag)?.[1];
    if (!["com.foxdebug.provider", `${packageName}.provider`].includes(current)) return tag;
    return tag.replace(/(\bandroid:authorities=["'])[^"']*(["'])/, `$1${authority}$2`);
  });
  fs.writeFileSync(file, updated);
}

module.exports = { changeProvider };
