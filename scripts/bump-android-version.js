#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const versionFile = path.join(root, "version.build.json");
const packageFile = path.join(root, "package.json");
const appJsonFile = path.join(root, "app.json");

function bumpPatch(version) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Semver inválido: ${version}`);
  }

  parts[2] += 1;
  return parts.join(".");
}

const meta = fs.existsSync(versionFile)
  ? JSON.parse(fs.readFileSync(versionFile, "utf8"))
  : { versionCode: 0 };

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const appJson = JSON.parse(fs.readFileSync(appJsonFile, "utf8"));

const previousCode = meta.versionCode;
const previousVersion = pkg.version;
const nextVersion = bumpPatch(previousVersion);

meta.versionCode += 1;
pkg.version = nextVersion;
appJson.expo.version = nextVersion;

fs.writeFileSync(versionFile, `${JSON.stringify(meta, null, 2)}\n`);
fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
fs.writeFileSync(appJsonFile, `${JSON.stringify(appJson, null, 2)}\n`);

console.log(
  `[version] ${previousVersion} → ${nextVersion} | build ${previousCode} → ${meta.versionCode}`
);
