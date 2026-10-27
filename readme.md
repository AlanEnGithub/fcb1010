# FCB1010 UnO Editor

Editor web modular para la pedalera **Behringer FCB1010** con firmware
[**UnO**](https://www.fcb1010.eu/) (1.x). Corre 100% en el navegador con
**Web MIDI** — sin backend.

## Qué incluye

- **Presets** — 10 bancos × 10 pedales (o 19×5 + 5 stomps en modo stompbox)
- **PC1–PC5, CC1/CC2, Note, Exp A/B, relés**
- **UnO**: stompbox global (fila superior/inferior), Direct Select, canales MIDI,
  merge, running status, tap tempo, block PC, latch/invert de switches,
  CC toggle/momentary, valores alternos, enlaces preset→stomp
- **MIDI**: detectar firmware, recibir/enviar dump SysEx, opción chunked (UnO ≥1.0.3)
- **Archivos**: importar / exportar `.syx`
- UI en **español**

Detalle del protocolo: [docs/sysex-format.md](docs/sysex-format.md).

> **Nota UnO:** el modo stompbox es *global* en el firmware (no por banco). La UI
> es modular: al activarlo reorganiza la grilla. Direct Select y Stompbox son
> excluyentes.

## Cómo correr

Requisitos: Node 20+, navegador Chromium (Chrome / Edge) con permiso SysEx.

```bash
cd ~/Code/fcb1010   # o la carpeta del repo
npm install
npm run dev         # http://localhost:5173
```

Otros comandos:

```bash
npm test            # tests de pack/unpack + overlay UnO
npm run build       # build de producción en dist/
npm run preview     # servir el build
```

## Cómo conectar la pedalera

1. Cableá **MIDI OUT de la FCB1010 → MIDI IN** de tu interfaz USB-MIDI.
2. Cableá **MIDI OUT de la interfaz → MIDI IN** de la FCB1010.
3. Encendé la pedalera.
4. Abrí el editor en Chrome/Edge, elegí los puertos **Entrada** y **Salida**.
5. Pulsá **Detectar firmware** (debería mostrar UnO 1.0.x o Behringer).
6. **Recibir dump** pide el setup a la pedalera (UnO ≥1.0.3 no requiere armar SysEx a mano).
7. Editá presets / global y **Enviar a pedal** (confirma y verifica re-leyendo).

### Si la interfaz USB es inestable

En UnO **≥ 1.0.3** activá *SysEx en chunks*. Muchas placas baratas fallan con el
dump único de 2352 bytes.

### Dump manual desde la pedalera

1. Mantener **DOWN** al encender (~2.5 s) → config global.
2. **UP** hasta la fila CONFIG.
3. Pedal **6** = enviar SysEx.
4. Salir con DOWN largo.

## Stack

Vite + React + TypeScript · Web MIDI API nativa · Vitest

## Licencia / afiliación

Proyecto independiente. Behringer® y FCB1010® son marcas de sus dueños.
UnO es firmware de terceros ([fcb1010.eu](https://www.fcb1010.eu/)).
