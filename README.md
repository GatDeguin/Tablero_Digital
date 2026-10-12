# VELORA GT 2.0 — Touring

Tablero GPS complementario, audio local y computadora de viaje. Edición refinada sobre el HTML VELORA GT 1.0 adjuntado por el usuario. No sustituye los instrumentos del auto ni acredita seguridad para conducción.

## Abrir y publicar

**HTML único:** `VELORA_GT.html` contiene CSS, JavaScript, motor Worker y geometría; el núcleo no necesita descargar librerías, fuentes ni imágenes. Abrir el archivo permite explorar la interfaz y la demo. Para ubicación usá la dirección HTTPS publicada, autorizá ubicación y mantené la app visible.

**GitHub Pages:** subir `index.html`, `sw.js`, `manifest.webmanifest`, `.nojekyll` y `assets/` a la raíz de la rama publicada; también puede subirse todo el proyecto. En Settings → Pages, elegir la rama y la carpeta raíz. La app no está publicada por esta entrega.

Antes de reemplazar una instalación previa, exportá un respaldo JSON desde la app antigua. Mantené la misma dirección de origen y carpeta para conservar el espacio de almacenamiento. Los respaldos v1 son compatibles; un cambio de navegador, perfil, dominio o carpeta puede abrir un almacenamiento diferente. No se migra información entre dispositivos automáticamente.

## Inicio rápido

Configurá con el vehículo estacionado. DEMO permite explorar sin activar ubicación ni alterar ODO/Trips/historial; los cambios de ambiente hechos en demo se revierten al salir. INICIAR GPS solicita ubicación y abre una sesión; FINALIZAR GPS drena las muestras pendientes del Worker y cierra el viaje. No se agregan kilómetros sobre intervalos sin observación.

El velocímetro utiliza velocidad del dispositivo cuando existe; si falta, la estima con posiciones aceptadas y lo indica. ODO GPS = base manual informativa + distancia aceptada por esta aplicación. Trip A/B se reinician con confirmación y se pueden deshacer durante 30 segundos. Ningún control cambia el vehículo.

## Pantallas y mandos

- **VIAJE:** distancia, tiempo observado, media, máxima, altitud y traza esquemática. Sin cartografía propia, tráfico ni navegación giro a giro. El rumbo es de desplazamiento, no una brújula magnética.
- **REGISTRO:** contadores, respaldo, hasta 20 viajes habituales y exportaciones. VER inspecciona puntos, segmentos y tiempo en movimiento. Eliminar un recorrido requiere confirmación y no modifica ODO/Trips. Las trazas largas se simplifican conservando los cortes detectados; el total no se recalcula por esa simplificación.
- **AUDIO:** archivos locales y enlaces oficiales Spotify/YouTube. El audio local tiene reproducción/pausa, anterior/siguiente, volumen, búsqueda y Media Session cuando se admite. Los archivos se vuelven a seleccionar al reabrir; no se copian a IndexedDB. Los mandos del tablero no controlan universalmente los reproductores remotos.
- **DESTINO:** guardar estacionamiento con una posición aceptada y reciente; compartir coordenadas; abrir navegación externa. La distancia al estacionamiento es en línea recta, no por calles.
- **AJUSTES:** ambiente carbono/día/ámbar, km/h o mph, aviso manual, movimiento reducido, calidad gráfica, brillo de interfaz, base ODO, exportación/recuperación y borrado. Instalar, solicitar persistencia y aplicar una actualización están sujetos a capacidades del navegador.

En teléfono horizontal, MÁS abre la botonera secundaria dentro de la pantalla; no se ocultan funciones para hacerlas caber. El odómetro, A/B y rumbo tienen una banda compacta visible. FOCO prioriza instrumentación y conserva INICIAR/FINALIZAR GPS en el carril superior. En vertical, la disposición admite desplazamiento de página: no se miniaturizan todos los controles para hacerlos entrar en un solo alto.

## Bloqueo de conducción

Una velocidad aceptada superior a 5 km/h activa el bloqueo de ajustes y medios externos. Para liberar automáticamente, se exige tiempo de detención observado, precisión adecuada y estabilidad posicional: al menos 5 segundos con velocidad del dispositivo o 12 segundos con estimación por posiciones. Un dato malo reinicia esa evidencia, no el bloqueo.

El bloqueo se conserva en el respaldo local, incluso si se recarga. En Diagnóstico hay una confirmación manual de estacionamiento, sólo con GPS finalizado. Esto es una precaución de interfaz, no un detector infalible: con ubicación apagada, permisos denegados, datos borrados o un proceso nuevo no puede saber si estás conduciendo. No manipules el teléfono en movimiento.

Los reproductores externos se retiran al detectar movimiento, salir de AUDIO o esconder la app. Se conservan controles para pausar audio local y finalizar GPS. Una confirmación pendiente se invalida si cambió el estado GPS que la originó.

## Guardado, recuperación y privacidad

IndexedDB guarda snapshots completos serializados y una copia anterior. Un checkpoint de emergencia mantiene totales y una cola de hasta 64 puntos del viaje activo. Al reabrir se concilian por identidad y timestamp con la copia completa; un checkpoint reciente ya no borra por sí solo las trazas completas. Los viajes que faltan en el estado nuevo no se resucitan. Si no existe superposición entre cola y traza anterior, se marca un corte.

Si IndexedDB falla, el indicador muestra CHECKPOINT o MEMORIA, no una conservación completa ficticia. Una cola no puede recuperar puntos que nunca se guardaron. El cierre abrupto del proceso o el borrado de datos puede perder observaciones. Solicitá persistencia desde Ajustes cuando se ofrezca y exportá JSON regularmente. Los respaldos contienen coordenadas.

Web Locks, cuando está disponible, conserva un solo escritor por aplicación: una segunda ventana abre de solo lectura. Si esa API no está disponible, no se garantiza exclusión entre pestañas; usá una sola. No se supone soporte de Web Locks sin detectarlo.

La restauración valida versión, valores finitos, rangos, fechas, orden de puntos e identidad. El importador limita la entrada a 64 MiB, hasta 50 entradas compatibles en un respaldo y 3.000 puntos por viaje; esto es un límite de validación, no una recomendación de tamaño para teléfonos. La aplicación conserva habitualmente 20 viajes al cerrar nuevas sesiones: exportá antes de alcanzar ese número.

Los datos GPS no se envían a un servidor propio. Cargar un reproductor externo establece conexión con ese proveedor; compartir estacionamiento o abrir Maps/Waze transmite el destino elegido. No hay analítica, IA ficticia, cuentas ni claves secretas en el HTML. Spotify/YouTube necesitan conectividad y sus requisitos de cuenta/contenido; no se verificó streaming autenticado en esta entrega.

## PWA y actualizaciones

El HTML independiente no registra Service Worker. La distribución Pages sí incluye manifest y caché de recursos locales. La nueva versión no ejecuta `skipWaiting` automáticamente al instalar: anuncia una actualización disponible para aceptarla en Ajustes, con GPS/demo finalizados, guarda y recarga. Cerrar todas las ventanas permite la activación normal del navegador. No se cachean reproductores de terceros.

Una PWA no garantiza ubicación en segundo plano. El navegador puede suspender los sensores al ocultar o bloquear pantalla; Wake Lock solicita mantenerla encendida, pero puede ser rechazado o revocado. La app no intenta evadir esas restricciones.

## Tecnología y edición

Motor activo: **JavaScript en Web Worker**, con alternativa directa. Render: mallas WebGL, iluminación analítica de metal y reflejos procedurales; fallback Canvas 2D con biseles, sombras y vidrio dibujados. El render WebGL no se verificó en GPU real en este entorno. No hay ray tracing, HDRI, WebGPU ni WASM activo. `rust/` contiene una referencia opcional no compilada ni integrada. A una muestra GPS por actualización no se presupone ventaja de Rust; no se inventan aceleraciones.

Fuentes por responsabilidad: `src/core.mjs`, `storage.js`, `platform.js`, `renderer.js`, `app.js`, `style.css` y `template.html`. `node build.mjs` genera el HTML único y la distribución Pages sin dependencias npm. Node 20 o posterior.

```bash
node build.mjs
npm test
python -m pip install -r requirements-test.txt
python -m playwright install chromium
python tests/browser_v2.py
python tests/browser_extended.py
python tests/ui_regressions.py
```

Los scripts admiten `BROWSER_EXECUTABLE` para indicar Chromium/Chrome. Las pruebas de navegador utilizan fixtures explícitos para GPS/reloj/checkpoint/contención de locks. No son una prueba de sensores ni de IndexedDB real. No se requieren dependencias de desarrollo para utilizar la app publicada.

La CSP autoriza el hash del script integrado y los orígenes de medios admitidos, sin `unsafe-eval`. Para cambiar el JavaScript, editá `src/` y reconstruí: modificar directamente el script del HTML sin actualizar su hash puede bloquearlo. No se incluye un sandbox de ejecución arbitraria ni secretos en WASM.

## Evidencia y límites

Consultar `docs/VERIFICATION.md`, `docs/MOTION.md` y `docs/v2/`. No se declara conformidad WCAG completa ni aptitud de producción automotriz. Faltan ensayos de GPS físico, GPU, sesiones largas en móvil, navegadores iOS/Android reales e instalación/recarga PWA. Las comprobaciones del Service Worker verifican su lógica con un adaptador; no sustituyen una instalación real.
