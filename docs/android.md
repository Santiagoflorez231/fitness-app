# Empaquetado Android

CARGA usa Capacitor 8 para envolver el build web (`dist/`) en un proyecto
Android nativo (`android/`, ya generado en el repo con `npx cap add android`).
Esta guía es para compilar un APK de la app en un dispositivo Android real.

## Por qué en un dispositivo real

- **Hápticos** (`@capacitor/haptics`): en el navegador (`npm run dev`) no
  vibran; solo funcionan en el APK instalado en un teléfono.
- **SQLite nativo** (`@capacitor-community/sqlite`): en Android usa el plugin
  nativo (SQLite del sistema), no `jeep-sqlite`/IndexedDB como en web. La capa
  de persistencia (`src/db/sqlite.ts`) ya distingue la plataforma con
  `Capacitor.getPlatform()`, así que no requiere cambios de código para
  funcionar en el teléfono — pero conviene probarla ahí al menos una vez.

## Requisitos (para compilar, no para editar el código web)

1. **JDK 21** (Gradle JDK recomendado por `@capacitor-community/sqlite`).
2. **Android SDK**, cualquiera de estas dos vías:
   - **Android Studio** (recomendado, más simple): instala el SDK, las
     platform-tools y un emulador/soporte USB automáticamente.
   - **cmdline-tools** standalone: `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"`
     y define `ANDROID_HOME`/`ANDROID_SDK_ROOT` + `local.properties` con
     `sdk.dir=<ruta al SDK>`.
3. Un teléfono Android con **depuración USB activada** (Ajustes > Opciones de
   desarrollador > Depuración USB), o un emulador AVD.

En esta máquina de desarrollo **no hay JDK ni Android SDK instalados**
(`java` no está en el PATH y no se encontró Android Studio). `npx cap add
android` y `npx cap sync android` no los necesitan — solo copian/generan el
proyecto Gradle — pero compilar el APK (`gradlew assembleDebug`) sí, y falla
con:

```
ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

Instala Android Studio (incluye JDK embebido) o un JDK 21 + Android
cmdline-tools para poder continuar desde el paso "Compilar" más abajo.

## Flujo de trabajo

Cada vez que cambies código en `src/` y quieras probarlo en Android:

```bash
npm run build              # recompila dist/
npx cap sync android       # copia dist/ a android/app/src/main/assets/public
                            # y sincroniza plugins nativos
```

`npx cap sync` = `npx cap copy` + `npx cap update`. Si solo cambiaste código
web (sin tocar plugins nativos), basta con `npx cap copy android`.

### Opción A: abrir en Android Studio (recomendado)

```bash
npx cap open android
```

Desde Android Studio: conecta el teléfono por USB (o inicia un emulador) y
pulsa "Run". Android Studio compila, instala y abre la app automáticamente.

### Opción B: compilar el APK debug por línea de comandos

```bash
cd android
./gradlew assembleDebug        # Linux/macOS
.\gradlew.bat assembleDebug    # Windows PowerShell
```

El APK queda en:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Instalar el APK en el teléfono

- **Con el teléfono conectado por USB** (depuración USB activada):
  ```bash
  cd android
  ./gradlew installDebug
  # o: adb install -r app/build/outputs/apk/debug/app-debug.apk
  ```
- **Sin cable**: transfiere `app-debug.apk` al teléfono (por cable, Drive,
  etc.) y ábrelo desde el explorador de archivos del teléfono. Android pedirá
  permitir "instalar apps de origen desconocido" la primera vez.

## Ajustes aplicados en `android/` para @capacitor-community/sqlite

Siguiendo el README del plugin (`node_modules/@capacitor-community/sqlite/README.md`,
sección "Android Quirks"):

- `android/app/src/main/AndroidManifest.xml`: `android:allowBackup="false"`,
  `android:fullBackupContent="false"` y
  `android:dataExtractionRules="@xml/data_extraction_rules"`. Esto excluye la
  base de datos (y el resto de datos locales) del backup automático de
  Android y de la transferencia dispositivo-a-dispositivo, evitando que
  Android intente respaldar/restaurar el archivo SQLite por su cuenta
  mientras el plugin lo tiene abierto.

  **Nota/decisión**: esto también significa que Android ya NO hará backup
  automático de los datos de la app al reinstalarla o cambiar de teléfono.
  Como la app ya tiene su propio export/import de respaldo
  (`src/db/backup.ts`), se sigue la recomendación del plugin tal cual, pero
  es una decisión de producto (no solo técnica) que vale la pena confirmar.

- `android/app/src/main/res/xml/data_extraction_rules.xml`: creado nuevo,
  excluye los dominios `database`, `sharedpref`, `external` y `root` de
  cloud-backup y device-transfer.

- `android/variables.gradle` ya generado por `cap add android` cumple de
  sobra los mínimos que pide el plugin (`minSdkVersion 24` / `compileSdkVersion
  36` / `targetSdkVersion 36`, vs. los 23/35/35 mínimos recomendados); no hizo
  falta tocarlo.

- El plugin menciona un posible error de build
  (`x files found with path 'build-data.properties'`) que se arregla
  añadiendo un bloque `packagingOptions { exclude 'build-data.properties' }`
  en `android/app/build.gradle`. **No se aplicó preventivamente** porque el
  README lo presenta como un fix condicional ("en caso de que te salga este
  error") y no se pudo verificar si ocurre en esta máquina (no hay JDK para
  compilar). Si `gradlew assembleDebug` falla con ese mensaje, añadir ese
  bloque dentro de `android { ... }` en `android/app/build.gradle`.

## Estado de esta verificación

- `npm run build` — OK.
- `npx cap add android` — OK, generó `android/`.
- `npx cap sync android` — OK, sin errores, detectó los 5 plugins nativos
  instalados (`@capacitor-community/sqlite`, `@capacitor/app`,
  `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`).
- `gradlew assembleDebug` — **no verificado**: esta máquina no tiene JDK ni
  Android SDK instalados. No se pudo confirmar que el proyecto compila un
  APK real; solo que el scaffold de Gradle se generó correctamente.
