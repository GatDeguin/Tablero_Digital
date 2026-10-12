# Referencia Rust opcional, NO activa en VELORA GT 2.0

El núcleo ejecutado es `src/core.mjs` en JavaScript/Worker. Este directorio conserva una referencia de distancia de gran círculo y rumbo inicial. No incluye un binario WASM compilado y no participa de la ejecución del HTML.

Para explorar con un toolchain Rust instalado: `cargo test`; `rustup target add wasm32-unknown-unknown`; `cargo build --release --target wasm32-unknown-unknown`. Estas instrucciones no se ejecutaron en este entorno y no certifican compatibilidad. Antes de integrarlo hay que definir el contrato, probar paridad con el núcleo JS, incrustar un binario auténtico, adaptar CSP y medir si aporta una ventaja. Compilar estas dos funciones no convierte todo el filtro de telemetría a Rust.
