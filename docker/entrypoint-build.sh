#!/bin/bash
set -e

echo ""
echo "=========================================="
echo "  📦 Build APK - Minha Agenda"
echo "=========================================="
echo ""

ANDROID_DIR="/app/android"
ANDROID_CACHE_DIR="/root/.android-cache"

restore_android_cache() {
  mkdir -p "$ANDROID_CACHE_DIR"
  if [ -n "$(ls -A "$ANDROID_CACHE_DIR" 2>/dev/null)" ]; then
    echo "♻️  Restaurando cache do projeto Android..."
    mkdir -p "$ANDROID_DIR"
    rsync -a --delete "$ANDROID_CACHE_DIR"/ "$ANDROID_DIR"/
  fi
}

save_android_cache() {
  if [ -d "$ANDROID_DIR" ]; then
    echo "💾 Salvando cache do projeto Android..."
    mkdir -p "$ANDROID_CACHE_DIR"
    rsync -a --delete "$ANDROID_DIR"/ "$ANDROID_CACHE_DIR"/
  fi
}

trap save_android_cache EXIT
restore_android_cache

cd /app

echo "🔢 Incrementando versão do build..."
node scripts/bump-android-version.js

CONFIG_HASH=$(
  cat /app/app.json \
      /app/app.config.js \
      /app/babel.config.js \
      /app/package.json \
      /app/package-lock.json \
      /app/assets/images/icon.png \
      /app/assets/images/android-icon-foreground.png \
      /app/assets/images/android-icon-monochrome.png \
      /app/assets/images/notification-icon.png \
      /app/assets/images/splash-icon.png 2>/dev/null \
    | sha256sum | cut -d' ' -f1
)
CACHED_HASH=""
[ -f "$ANDROID_DIR/.build-config-hash" ] && CACHED_HASH=$(cat "$ANDROID_DIR/.build-config-hash")

NEEDS_PREBUILD=false
FORCE_CLEAN=false

if [ "$CLEAN_PREBUILD" = "1" ]; then
  NEEDS_PREBUILD=true
  FORCE_CLEAN=true
  echo "🔄 Prebuild forçado (CLEAN_PREBUILD=1)..."
elif [ ! -f "$ANDROID_DIR/gradlew" ]; then
  NEEDS_PREBUILD=true
  FORCE_CLEAN=true
  echo "🔨 Primeiro build — gerando projeto Android..."
elif [ "$CONFIG_HASH" != "$CACHED_HASH" ]; then
  NEEDS_PREBUILD=true
  FORCE_CLEAN=true
  echo "🔨 Config nativa alterada — regerando projeto Android..."
else
  echo "⚡ Prebuild em cache (use --clean-prebuild para regerar)."
fi

if [ "$NEEDS_PREBUILD" = true ]; then
  if [ "$FORCE_CLEAN" = true ]; then
    echo "🧹 Limpando projeto Android..."
    rm -rf "$ANDROID_DIR"
    if [ -d "$ANDROID_CACHE_DIR" ]; then
      find "$ANDROID_CACHE_DIR" -mindepth 1 -delete 2>/dev/null || true
    fi
  fi

  echo "🔨 Executando expo prebuild..."
  npx expo prebuild --platform android --no-install

  echo "$CONFIG_HASH" > "$ANDROID_DIR/.build-config-hash"
fi

echo "🔧 Configurando Android SDK..."
mkdir -p android
echo "sdk.dir=${ANDROID_HOME}" > android/local.properties

GRADLE_PROPS="android/gradle.properties"
touch "$GRADLE_PROPS"

append_gradle_prop() {
  local key=$1
  local value=$2
  if ! grep -q "^${key}=" "$GRADLE_PROPS" 2>/dev/null; then
    echo "${key}=${value}" >> "$GRADLE_PROPS"
  fi
}

append_gradle_prop "org.gradle.parallel" "true"
append_gradle_prop "org.gradle.caching" "true"
append_gradle_prop "org.gradle.configureondemand" "true"
append_gradle_prop "org.gradle.jvmargs" "-Xmx4096m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError"

echo "🔢 Sincronizando versão no projeto Android..."
node scripts/sync-android-version.js

echo ""
echo "🧬 Gerando artefatos de codegen..."
cd android
chmod +x ./gradlew
./gradlew generateCodegenArtifactsFromSchema --no-daemon || true

echo ""
echo "🏗️  Compilando APK..."
./gradlew assembleRelease \
  --no-daemon \
  --build-cache \
  --parallel \
  -x lint \
  -x test

echo ""
echo "📋 Copiando APK..."
mkdir -p /app/build

APK_PATH=$(find /app/android/app/build/outputs/apk -name "*.apk" -type f | head -1)

if [ -z "$APK_PATH" ]; then
  echo "❌ Erro: APK não encontrado!"
  exit 1
fi

cp "$APK_PATH" /app/build/app.apk

echo ""
echo "=========================================="
echo "  ✅ APK gerado com sucesso!"
echo "  📱 Arquivo: ./build/app.apk"
echo "  📏 Tamanho: $(du -h /app/build/app.apk | cut -f1)"
echo "=========================================="
echo ""
