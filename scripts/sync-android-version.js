#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const versionFile = path.join(root, "version.build.json");
const packageFile = path.join(root, "package.json");
const gradleFile = path.join(root, "android", "app", "build.gradle");

if (!fs.existsSync(gradleFile)) {
  console.log("[version] Projeto Android ainda não gerado — prebuild aplicará a versão.");
  process.exit(0);
}

const { versionCode } = JSON.parse(fs.readFileSync(versionFile, "utf8"));
const { version } = JSON.parse(fs.readFileSync(packageFile, "utf8"));

let gradle = fs.readFileSync(gradleFile, "utf8");

if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+"[^"]+"/.test(gradle)) {
  console.warn("[version] Campos versionCode/versionName não encontrados em build.gradle.");
  process.exit(0);
}

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

fs.writeFileSync(gradleFile, gradle);
console.log(`[version] Android sincronizado: ${version} (build ${versionCode})`);
