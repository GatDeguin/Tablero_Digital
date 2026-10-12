# VELORA GT 2.0 — Motion semántico

Se evaluaron las 16 técnicas del prompt adjunto. La instrumentación permanece anclada; el estado del dominio nunca depende de una animación. Una medida desconocida retira las agujas, no comunica un cero ficticio.

| Técnica | Decisión | Ubicación y significado | Riesgo | Alternativa reducida | Verificación |
|---|---|---|---|---|---|
| Morph | Omitir | No hay cambio de forma necesario de una entidad | Distraer o deformar datos | Sin efecto | Revisión de código |
| Stagger | Omitir | Los mandos deben estar disponibles inmediatamente | Espera artificial | Aparición inmediata | Navegación repetida |
| Spring | Aplicar | Asentamiento del botón pulsado, solución amortiguada sin rebote | Transformaciones concurrentes | Cancelación inmediata | Ciclos de pulsación / modo reducido |
| Easing | Aplicar | Agujas visuales amortiguadas; lectura numérica real inmediata | Aparentar sobrepaso | Valor visual final directo | Núcleo separado de presentación |
| Crossfade | Adaptar | Fundido de entrada de pantalla tras sustitución atómica; no doble pantalla interactiva | Doble foco/lectura | Cambio directo | 20 ciclos de ida y vuelta |
| Shared element | Omitir | Instrumentos persistentes no necesitan clones entre vistas | Clones accesibles huérfanos | DOM estable | Una sola pantalla activa |
| Magnification | Omitir | Objetivos táctiles estables, sin crecer al acercarse | Movimiento de blancos | Foco visible | Tamaños y tacto |
| Blur | Omitir como transición | No se desenfocan medidas ni controles; las sombras de material son estáticas | Pérdida de legibilidad | Mismos datos nítidos | Capturas |
| Mask | Adaptar sólo a render | Recorte estático de esferas/vidrio en fallback; no revelado animado | Ocultar lecturas | Lectura HTML no recortada | Cuatro composiciones y tamaños extra |
| Variable font | Omitir | No hay fuente variable embebida con ejes verificados | Falsa implementación | Fuentes del sistema | Sin archivos de fuentes |
| Layout animation | Omitir | Modo foco cambia disposición de forma inmediata | Mover escalas al conducir | Cambio estable | GPS sigue alcanzable |
| Clip path | Omitir como transición | No se añade una segunda técnica de recorte | Clipping de foco | Presentación completa | Teclado y captura |
| Path morph | Omitir | No se interpolan rutas o mediciones inexistentes | Inventar datos | Actualización por muestra | Cortes conservados en GPX |
| Stroke draw | Adaptar | Se agrega traza por muestras reales aceptadas; no un recorrido animado precalculado | Dibujar sobre pérdidas GPS | La misma traza estática | Exportación y detalle histórico |
| Perspective | Adaptar a profundidad | Mallas 3D y luz contextual; proyección ortográfica, sin cámara móvil ni simulación de parallax | Inestabilidad de números/objetivos | Canvas 2D y luz fija | Fallback revisado; GPU pendiente |
| Particles | Omitir | No aportan a la lectura de conducción | Distracción y batería | Sin partículas | No emisor ni bucle ornamental |

## Tokens y contratos

Feedback breve: 120 ms. Contexto: 180 ms. Entrada de pantalla: 160 ms. Asentamiento del pulsador: 380 ms con desplazamiento máximo de 1,8 CSS px. Aguja: interpolación exponencial de constante temporal 120 ms, sin overshoot. Ningún valor numérico procede de esa interpolación.

Pulsador: interacción → acción inmediata → asentamiento → reposo. Una nueva pulsación cancela la anterior; el rechazo de `finished` se captura. CSS no escribe simultáneamente su transformación de presión.

Pantalla: se desmonta contenido previo (incluyendo iframe), se instala el nuevo estado y luego se anima su entrada. La anterior deja de ser interactiva inmediatamente. El foco de confirmaciones va a Cancelar; Escape cancela y se devuelve el foco a un control apropiado. Un cambio de GPS invalida autorizaciones obsoletas.

Dato GPS: validación → actualización del dominio → número inmediato → asentamiento de aguja. Una muestra inválida o señal perdida retira el dato y las agujas. La traza respeta discontinuidades. Un máximo inicial sin medida aparece desconocido.

Movimiento reducido: se respeta al iniciar y al cambiar durante la sesión. Se cancelan animaciones JS y se asienta el renderer, además de desactivar transiciones CSS. No es una versión más rápida del mismo movimiento.

Render: `requestAnimationFrame` sólo continúa mientras se asientan instrumentos o llega una interacción. Se detiene al ocultar el documento. La luz contextual responde al ratón sobre los instrumentos sólo sin bloqueo de conducción y sin movimiento reducido. Es iluminación procedural, no seguimiento facial ni movimiento de cámara. Eco/Auto/High limitan DPR; no hay promesa de 60 FPS.
