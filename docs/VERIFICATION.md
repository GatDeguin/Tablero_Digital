# VELORA GT 2.0 — Verificación de entrega

Fecha de ejecución: 12 de octubre de 2026. Baseline: HTML adjunto `VELORA_GT(1).html`, idéntico al HTML de la distribución anterior. Alcance: actualización funcional y visual, no homologación ni prueba de conducción real.

## Resultado observado

**59 pruebas unitarias Node: 59 aprobadas, 0 fallidas.** Incluyen núcleo geodésico, formatos, validación, recuperación de checkpoint, bloqueo, almacenamiento con adaptador, ciclo de Wake Lock, renderer, empaquetado y Service Worker simulado.

**57 comprobaciones de navegador: 37 en la suite principal y 20 en la ampliada, todas aprobadas.** Además, dos regresiones enfocadas verifican odómetro móvil y control GPS en modo foco. Chromium 144.0.7559.96, headless, Playwright 1.57.0, HTML propio cargado con `set_content`. No se registraron excepciones JavaScript no controladas en las suites.

Se reprodujeron 16 fallos del núcleo antes de corregirlos. Se añadieron pruebas rojo/verde de almacenamiento (4), Wake Lock (incluida denegación síncrona), agujas sin dato (2), actualización Service Worker (3) y regresiones de revisión de cola superpuesta/bloqueo con precisión reducida (2). Los archivos `*-red.txt` son evidencia histórica del defecto anterior, no fallos de la entrega final.

## Correcciones verificadas

| Área | Cambio y evidencia |
|---|---|
| Recuperación | La copia compacta reciente se concilia con trazas completas; no borra las del mismo viaje ni resucita recorridos eliminados. Se comprueban colas con y sin superposición. |
| Cronología | Se rechazan muestras atrasadas incluso después de `stale`, fechas invertidas, puntos no cronológicos y velocidades fuera de rango. |
| GPS | El primer intervalo de puesta en movimiento suma desplazamiento aceptado; la posición descartada no se usa para estacionar. Señal perdida retira velocidad, precisión, altitud y rumbo. |
| Bloqueo | Se exige tiempo detenido, no cantidad de eventos. Persiste en checkpoint y recarga simulada; precisión reducida no ignora velocidad alta aceptada. |
| Finalización | Una barrera del Worker consume muestras ya recibidas antes de cerrar sesión. La prueba envía muestra y finalización en el mismo evento. |
| Confirmaciones | Escape cancela; cambios de estado invalidan confirmaciones; operaciones de datos pendientes impiden iniciar un GPS nuevo. |
| Audio | WAV real de prueba decodificado, tiempo avanza, pausa, volumen y seek efectivos. Reabrir AUDIO retira el estado de un embed ya desmontado. |
| Historial | Detalle de puntos registrado, GPX/CSV y eliminación confirmada; borrar una traza no cambia ODO. |
| Demo | Contadores e historial reales aislados; preferencias visuales de exploración se revierten al salir. |
| Render/UX | Biseles y agujas revisados en Canvas; las agujas no aparentan medir cero sin datos. ODO/Trips móviles visibles, modo foco conserva GPS. |
| Recursos | El render queda en reposo al asentarse con movimiento reducido. Wake Lock libera una concesión tardía si el usuario ya canceló. |
| Seguridad | Hash del script en CSP comprobado para ambos HTML; sin eval, sin scripts inline arbitrarios, sin fuentes remotas ni credenciales. URLs de medios normalizadas y restringidas. |
| Actualizaciones | El Service Worker no llama `skipWaiting` al instalar, no cambia silenciosamente el shell de una versión y atiende activación explícita. |

## Qué se simuló y qué se ejecutó

Se ejecutó el HTML construido, su controlador real, un Web Worker real, Canvas 2D, eventos y reproducción/decodificación de un archivo WAV real generado para la prueba. Se inyectaron explícitamente GPS, reloj asociado a muestras, checkpoint de memoria y contención de Web Locks. La suite de almacenamiento usa adaptadores, no IndexedDB físico del navegador; la del Service Worker usa cachés/respuestas simuladas.

Un intento de navegar al servidor HTTP local devolvió `ERR_BLOCKED_BY_ADMINISTRATOR`. No se modificó esa política. Se utilizó carga del HTML propio con `set_content` para pruebas independientes; no equivale a un despliegue HTTPS ni a instalación PWA. Los selectores de prueba se adaptaron al CSP sin desactivarlo: se observa el estado desde el harness, no se habilita `unsafe-eval` en producción.

## Verificación visual

Capturas de escritorio 1440×940 y 1920×1080; móvil 390×844 y 320×568; horizontal 844×390 y 640×360; tablet 768×1024; foco horizontal. Sin desborde horizontal en esos escenarios. Se midieron al menos 44×44 CSS px en controles principales de GPS, transporte y navegación en los cinco tamaños de la suite ampliada. La vista vertical admite scroll. No se afirma que todo el texto sea legible a cualquier distancia de conducción.

Se inspeccionaron las capturas del producto ejecutado, no imágenes de concepto. El renderer efectivo en este entorno fue Canvas 2D. El modo WebGL con shader y mallas está implementado, pero no se pudo verificar su compilación/ejecución en una GPU disponible. No se atribuye a las capturas un render 3D que no produjeron.

## Limitaciones y estado final

**Implementado y comprobado bajo las condiciones anteriores:** flujos principales, audio local, formatos, filtros y contratos de sensores simulados, recuperación pura, protección de datos con fixtures, responsive, control de movimiento y construcción.

**Implementado con validación real pendiente:** GPS físico (túneles, arranque, deriva, pérdida de señal, diferentes frecuencias), IndexedDB/Web Locks reales y escenarios multipestaña, GPU WebGL, concesión nativa de Wake Lock, instalación/recarga y actualización PWA en el dispositivo, streaming autenticado, Safari/iOS/Android, accesibilidad con lectores y auditoría de contraste completa, rendimiento/batería/temperatura en sesiones prolongadas.

**No implementado ni anunciado como disponible:** WASM activo, OBD, datos del motor/combustible/RPM, cartografía o tráfico propio, navegación giro a giro, Spotify OAuth/SDK universal, IA, sincronización cloud, garantía de GPS en segundo plano. Rust sólo se entrega como referencia fuente opcional no compilada.

Los 12 ejes de revisión del prompt se cubren con código y pruebas proporcionales: funcionalidad, arquitectura, diseño, UX, accesibilidad, rendimiento, persistencia, seguridad, portabilidad, robustez, mantenibilidad y completitud. Las carencias de prueba física no se convierten en calificaciones o certificaciones ficticias.

## Reproducibilidad

`node build.mjs`; `npm test`; `python tests/browser_v2.py`; `python tests/browser_extended.py`; `python tests/ui_regressions.py`. Dependencias de pruebas en README; ninguna dependencia npm/runtime para usar la app. Logs, capturas y resultados JSON en `docs/v2/`.

## Fuentes técnicas consultadas

- W3C Geolocation: https://www.w3.org/TR/geolocation/ — semántica de muestras, permisos y límites de la fuente de ubicación.
- MDN Web Locks: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API — exclusión por origen cuando existe soporte.
- MDN skipWaiting: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting — transición del worker en espera.
- MDN StorageManager.persist: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist — solicitud, no garantía incondicional de persistencia.
