#!/bin/sh
set -eu
# Localiza el repositorio aunque se invoque el script desde otra carpeta.
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# En macOS utiliza las instalaciones habituales, respetando las variables ya definidas.
if [ -z "${ANDROID_HOME:-}" ] && [ "$(uname -s)" = Darwin ]; then
  ANDROID_HOME="$HOME/Library/Android/sdk"
  export ANDROID_HOME
fi
if [ -z "${JAVA_HOME:-}" ] && [ "$(uname -s)" = Darwin ]; then
  JAVA_HOME=$(/usr/libexec/java_home -v 17)
  export JAVA_HOME
fi
if [ ! -d "${ANDROID_HOME:-}/platform-tools" ]; then
  echo 'Configura ANDROID_HOME con la ubicación del SDK Android.' >&2
  exit 1
fi
cd "$PROJECT_ROOT"
# Genera Android solo si falta: conservarlo permite reutilizar las tareas de Gradle.
# Los cambios de configuración o dependencias nativas requieren otro Expo prebuild.
if [ ! -d apps/mobile/android ]; then
  pnpm --filter @jaguar/mobile exec expo prebuild --platform android --no-install
fi
cd apps/mobile/android
# APK de pruebas con JavaScript incluido, sin Metro. Compilar solo ARM64 ahorra tiempo;
# JAGUAR_ANDROID_ARCHS permite elegir otras arquitecturas. La firma actual es de depuración.
./gradlew "-Dorg.gradle.jvmargs=${JAGUAR_GRADLE_JVM_ARGS:--Xmx2048m -XX:MaxMetaspaceSize=1024m}" assembleRelease "-PreactNativeArchitectures=${JAGUAR_ANDROID_ARCHS:-arm64-v8a}" --console=plain
printf '\nAPK local de pruebas: %s\n' "$PWD/app/build/outputs/apk/release/app-release.apk"
