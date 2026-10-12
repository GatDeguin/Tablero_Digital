# VELORA GT 2.0 Implementation Plan

**Goal:** Actualizar el tablero adjunto con fiabilidad, legibilidad y acabado visual sin perder funciones.
**Architecture:** Núcleo puro y formatos en core.mjs; LocalVault para snapshots; adapters de ciclo de vida; controlador existente; renderer WebGL/Canvas. Build embebe módulos en HTML y genera PWA.
**Stack:** JavaScript, Web Worker, IndexedDB, Web Locks opcional, Canvas, WebGL, Web Animations; Node tests y Playwright Python.
**Spec:** docs/v2/DESIGN.md

## Global constraints
Sin dependencias runtime remotas. Demo no persiste. Desconocido no es cero. Mantener backup versión 1 compatible con campos opcionales nuevos. Preservar cortes de señal.

## Review focus
Checkpoint reciente truncado; reload durante movimiento; eventos viejos tras pausa; botón iniciar GPS repetido/fin con mensajes en vuelo; diálogos que sobreviven a cambios de estado; tamaño táctil y odómetro móvil.

## Task 1 — Núcleo y almacenamiento
- [x] Escribir regresiones timestamps, speed, backups, recuperación y SafetyLatch.
- [x] Ejecutar para observar fallos y guardar evidencia.
- [x] Implementar contratos puros y recuperación de checkpoint.
- [x] Verificar suite completa y casos de almacenamiento.

## Task 2 — Flujos de interfaz
- [x] Integrar SafetyLatch, guardas, cierre GPS, wake y persistencia.
- [x] Añadir detalle de recorrido y controles principales compactos.
- [x] Probar navegación, demo, importaciones, foco y errores.

## Task 3 — Materialidad, motion y adaptación
- [x] Refinar materiales y ocultar agujas sin dato.
- [x] Corregir controles/ODO en disposiciones móviles.
- [x] Medir y capturar navegación normal/reducida.

## Task 4 — PWA y entrega
- [x] Pruebas del contrato de actualización controlada antes de implementar.
- [x] Generar HTML y paquete completo; actualizar docs y matriz 16 técnicas.
- [x] Ejecutar pruebas de entrega, revisar capturas, hashes y límites.
