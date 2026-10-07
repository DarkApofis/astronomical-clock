# Cielo

Planetario en tiempo real: el cielo visible desde tu ubicación, ahora o en cualquier momento entre los años 1000 y 3000. Sin backend ni login — todo se calcula en el dispositivo.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + bundle to dist/
```

## Qué hay

- **Domo** (`src/components/Dome.tsx`): proyección azimutal equidistante del hemisferio visible (cénit al centro, N arriba, E a la izquierda). ~2 000 estrellas hasta magnitud 5,2 y líneas de constelaciones en un `<canvas>`; Sol, Luna (fase real) y planetas, horizonte, eclíptica y anillos de altitud en SVG.
- **Efemérides** (`src/astro/sky.ts`): [astronomy-engine](https://github.com/cosinekitty/astronomy) para Sol, Luna y planetas (posición, fase, salida/puesta, distancia, magnitud). Las estrellas usan RA/Dec J2000 con una conversión propia a alt/az por frame.
- **Control de tiempo** (`src/components/TimeControl.tsx`): scrubber con escalas Min / Horas / Días / Meses / Años, play/pausa y 1× / 60× / 3600×. Arrastrar la manija mueve el tiempo 1:1 sin inercia; al soltar hay una desaceleración corta (power2.out, 400 ms) y la ventana se recentra. Flechas / Shift+flechas para mover con teclado.
- **Panel del astro** (desktop) / **bottom sheet** (móvil): altitud, acimut, salida, puesta, distancia, magnitud; en la Luna, fase dibujada, % iluminado y edad. *Centrar* hace zoom ×2 sobre el astro; *Seguir* lo mantiene centrado mientras corre el tiempo.
- **Día / crepúsculo / noche** interpolados de forma continua con la altura del Sol; franja naranja hacia el lado del Sol entre −12° y +10°.
- **Ubicación**: geolocalización del navegador; si se deniega, selector con ciudades populares y búsqueda (lista local sin conexión + geocodificador de Open-Meteo con conexión). Se recuerda en `localStorage`.
- **Sin conexión**: aviso discreto; la app sigue funcionando.
- Atajos: `C` constelaciones, `Espacio` play/pausa.

Las animaciones siguen las notas de movimiento del diseño (GSAP; solo transform y opacity salvo el trazo del horizonte) y se reducen a fundidos de 150 ms con `prefers-reduced-motion`.

*Reloj* y *Sistema solar* aparecen deshabilitados: no están diseñados todavía.

## Datos

Catálogo de estrellas y líneas de constelaciones derivados de [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3-Clause, ver `src/data/LICENSE-d3-celestial`).
