# VELORA GT 2.0 — Touring refinement

Base: el HTML adjunto coincide byte por byte con la versión 1.0 del paquete original. Se preserva su arquitectura local-first, carcasa, instrumentación, audio y aislamiento de demo. Se aplica el prompt adjunto de ingeniería y motion, sin introducir dependencias runtime.

## Prioridades y decisiones
1. Integridad: un checkpoint compacto nunca debe sustituir silenciosamente una traza completa. Recuperación por identidad de viaje y timestamp; no se reintroducen viajes borrados. Validación estricta y escrituras serializadas. Exclusión de escritores con Web Locks donde existe, segunda pestaña de solo lectura.
2. Telemetría: timestamps monótonos incluso tras interrupciones; rechazo de velocidad nativa imposible y altitud de precisión inválida; no acumular desplazamientos desconocidos. El estado sin medición no dibuja una aguja que aparente medir cero. Tiempo de detención verificable, no sólo número de eventos.
3. Seguridad de uso: el bloqueo persiste al recargar; muestras imprecisas no desbloquean. Las confirmaciones sensibles se invalidan al cambiar el estado. GPS/música que ya están activos conservan controles de finalización/pausa. No se pretende detectar ni prevenir todas las distracciones.
4. UX: odómetro y contadores visibles también en móvil; controles principales >=44 CSS px; lectura numérica estable; historial con inspección de trazas y eliminación confirmada; modo foco mantiene acceso a detener GPS. Mantener instrumentos estables, sin cámaras decorativas.
5. Render: iluminación analítica de materiales 3D refinada; luz interactiva sólo detenido, reducida e inactiva en movimiento reducido; fallback 2D con las mismas lecturas. No afirmar GPU física, HDRI ni ray tracing.
6. PWA: no aplicar nuevas versiones durante viajes. Caché versionado de shell, activación solicitada en pantalla de ajustes; no cachear proveedores remotos. Instalación explícita donde el navegador lo ofrece.
7. Portabilidad: HTML único y ZIP Pages; JS Worker funcional. Rust de referencia separado, sin atribuir WASM no compilado. IA, OBD, backend, threads WASM y cartografía quedan fuera por ausencia de necesidad o fuente.

## Aceptación
Pruebas de regresión deben fallar en v1 y pasar en v2. Ejecutar núcleo, persistencia bajo adaptadores identificados, lógica service-worker y navegador (sensores simulados). Inspeccionar capturas escritorio/móvil vertical/horizontal/tablet y movimiento reducido. Declarar limitaciones del navegador de pruebas: navegación de red local bloqueada por política; no modificarla.
