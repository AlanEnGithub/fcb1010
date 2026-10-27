# Formato SysEx FCB1010 / UnO

Fuentes: especificación Behringer del dump, parser MIT
[riban-bw/fcb1010](https://github.com/riban-bw/fcb1010), manuales
[FCB/UnO ControlCenter](https://www.fcb1010.uno/downloads/FCB_UnO_ControlCenter_manual.pdf) y
[UnO v1.0.4](https://www.fcb1010.eu/downloads/FCB_UnO_v1_0_4_UserGuide.pdf).

## Wire format

Dump completo: **2352 bytes**.

| Offset | Bytes | Significado |
| ------ | ----- | ----------- |
| 0 | `F0` | inicio SysEx |
| 1–3 | `00 20 32` | ID Behringer |
| 4 | `01` | device id |
| 5 | `0C` | modelo FCB1010 |
| 6 | `0F` | función patchdump |
| 7–2350 | datos | 2344 bytes empaquetados 7-bit |
| 2351 | `F7` | fin SysEx |

Cada bloque de 7 bytes de memoria se envía como 8 bytes MIDI: 7 datos (bit7=0) +
1 byte con los MSBs.

Memoria interna descomprimida: **2051 bytes**.

## Presets (0–1599)

100 presets × 16 bytes. El bit7 suele ser “deshabilitado”, salvo relés.

| Byte | Contenido | Bit7 |
| ---- | --------- | ---- |
| 0–4 | PC1–PC5 | PC deshabilitado |
| 5 | CC1 número | CC1 deshabilitado |
| 6 | CC1 valor | **relé 1 on** |
| 7 | CC2 número | CC2 deshabilitado |
| 8 | CC2 valor | **relé 2 on** |
| 9 | ExpA CC | ExpA deshabilitado |
| 10–11 | ExpA min/max | (UnO overlay: tri-state expresión) |
| 12 | ExpB CC | ExpB deshabilitado |
| 13–14 | ExpB min/max | (UnO overlay: tri-state expresión) |
| 15 | Note | Note deshabilitado |

## Globales stock (2016–2050)

| Offset | Contenido |
| ------ | --------- |
| 2016–2025 | canales MIDI PC1…Note (0–15) |
| 2032 | bits relé global |
| 2033 | bit1 Direct Select, bit2 Running Status, bit4 MIDI Merge |
| 2034–2043 | copia de canales |
| 2044–2047 | calibración Exp A/B |

## Extensión UnO (1600–2015)

No hay mapa público oficial. Este editor usa un **overlay opcional** con
marcador `UNO1` en 2008–2011:

- 2000: flags globales UnO (stompbox, fila, block PC, taptempo, latch/invert)
- 2001: Note On velocity
- 1600 + n×4: por preset → CC1 alt, CC2 alt, flags de modo/relé, enlaces stomp

Si el dump no tiene el marcador y el área no parece de fábrica (`0xFF`/`0x7F`),
los bytes se **preservan** sin reinterpretar.

## Comandos

| Mensaje | Uso |
| ------- | --- |
| `F0 00 20 32 01 0C 4F F7` | pedir dump |
| `F0 00 20 32 01 0C 40 F7` | pedir versión |
| `F0 00 20 32 01 0C 5n F7` | pedir chunk n (UnO ≥1.0.3) |

**No enviar** `… 0C 0F F7` vacío: deja la pedalera en recepción SysEx.

## Procedimiento manual

1. MIDI OUT pedal → MIDI IN interface; MIDI OUT interface → MIDI IN pedal.
2. UnO ≥1.0.3: recepción siempre habilitada.
3. Transmitir desde el pedal: config global (DOWN al encender) → UP hasta CONFIG → pedal **6**.
4. Stock / UnO ≤1.0.2: armar recepción con pedal **7** antes de enviar.
