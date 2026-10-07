import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test, onTestFinished } from "vitest";
const require = createRequire(import.meta.url);
const updatePackage = require("../../src/plugins/browser/utils/updatePackage.js");
const { changeProvider } = require("../../src/plugins/system/utils/changeProvider.js");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "synthia-hooks-"));
  onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (relative, text) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };
  write("config.xml", '<widget version="1.0.0" id="world.synthia.acode" />');
  return { root, write, context: { opts: { projectRoot: root } } };
}

test("native browser and terminal imports follow the full Synthia package id", () => {
  const f = fixture();
  const paths = ["com/foxdebug/browser/Menu.java", "com/foxdebug/acode/rk/exec/terminal/AlpineDocumentProvider.java"];
  const files = paths.map(p => f.write(`platforms/android/app/src/main/java/${p}`, "import com.foxdebug.acode.R;\nclass Example {}"));
  updatePackage(f.context);
  for (const file of files) assert.match(fs.readFileSync(file, "utf8"), /import world\.synthia\.acode\.R;/);
  // A second prepare must be harmless.
  updatePackage(f.context);
  for (const file of files) assert.match(fs.readFileSync(file, "utf8"), /import world\.synthia\.acode\.R;/);
});

test("provider hooks preserve terminal authority and patch only FileProvider", () => {
  const f = fixture();
  const file = f.write("platforms/android/app/src/main/AndroidManifest.xml", '<application><provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.cdv.core.file.provider"/><provider android:name="TerminalProvider" android:authorities="world.synthia.acode.documents"/><provider android:authorities="com.foxdebug.provider" android:name="androidx.core.content.FileProvider"/></application>');
  changeProvider(false, f.context);
  let content = fs.readFileSync(file, "utf8");
  assert.match(content, /authorities="world\.synthia\.acode\.documents"/);
  assert.ok(content.includes('authorities="${applicationId}.cdv.core.file.provider"'));
  assert.match(content, /authorities="world\.synthia\.acode\.provider"/);
  changeProvider(true, f.context);
  content = fs.readFileSync(file, "utf8");
  assert.match(content, /authorities="world\.synthia\.acode\.documents"/);
  assert.ok(content.includes('authorities="${applicationId}.cdv.core.file.provider"'));
  assert.match(content, /authorities="com\.foxdebug\.provider"/);
});

test("first prepare can reset before AndroidManifest exists", () => {
  const f = fixture();
  assert.doesNotThrow(() => changeProvider(true, f.context));
});
