#!/bin/bash
# ================================================================
# Build APK da Minha Agenda via Docker
# ================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REBUILD_IMAGE=false
CLEAN_PREBUILD=false
NO_CACHE=""

for arg in "$@"; do
  case $arg in
    --rebuild-image) REBUILD_IMAGE=true ;;
    --clean-prebuild) CLEAN_PREBUILD=true ;;
    --no-cache) NO_CACHE="--no-cache"; REBUILD_IMAGE=true ;;
  esac
done

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║   📱 Build APK - Minha Agenda            ║"
echo "║   via Docker (otimizado)                 ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

mkdir -p build

if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker não está rodando. Inicie o Docker e tente novamente.${NC}"
  exit 1
fi

IMAGE_ID=$(docker compose images -q build-apk 2>/dev/null || true)

if [ "$REBUILD_IMAGE" = true ] || [ -z "$IMAGE_ID" ]; then
  echo -e "${BLUE}🐳 Construindo imagem Docker...${NC}"
  docker compose build $NO_CACHE build-apk
else
  echo -e "${GREEN}⚡ Reutilizando imagem Docker (use --rebuild-image após mudar deps)${NC}"
fi

echo ""
CLEAN_PREBUILD=$([ "$CLEAN_PREBUILD" = true ] && echo 1 || echo 0) \
  docker compose run --rm build-apk

if [ -f "./build/app.apk" ]; then
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗"
  echo "║   ✅ Build concluído com sucesso!         ║"
  echo "╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  📱 APK: ${BLUE}./build/app.apk${NC}"
  echo -e "  📏 Tamanho: $(du -h ./build/app.apk | cut -f1)"
  echo ""
  echo -e "  ${YELLOW}Para instalar no dispositivo:${NC}"
  echo "  adb install ./build/app.apk"
  echo ""
else
  echo ""
  echo -e "${RED}❌ Erro: APK não foi gerado. Verifique os logs acima.${NC}"
  exit 1
fi
