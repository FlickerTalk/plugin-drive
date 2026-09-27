# plugin-drive

**Mi drive** para [FlickerTalk](https://flickertalk.com). Los ficheros del usuario, sellados en
el teléfono, en su propio Google Drive (plan del drive, fase A, 2026-09-27).

Todo lo que importa lo hace el **núcleo** (`app/crates/ft-vault`): el login por el navegador del
sistema, el sellado (XChaCha20-Poly1305 por trozos, una clave por fichero derivada de la clave del
drive), la subida reanudable a Google Drive y la cola de lo que espera red. Este plugin es solo
las estanterías: carpetas, ficheros, lo pendiente. **Nunca ve un byte de un fichero, un token ni
el código de recuperación.** Nuestro servidor no participa (`§100`).

## Qué hace

- Conectar Google Drive, crear el drive (y enseñar el código de recuperación **una sola vez**) o
  abrir el drive de otro teléfono con su código.
- Carpetas (crear, renombrar, quitar), migas de pan.
- Subir ficheros del selector del sistema a la carpeta abierta.
- **Guardar desde el chat**: «Abrir con» → Mi drive en cualquier fichero de una burbuja (`opens:
  ["*/*"]`). El plugin recibe el nombre y el tipo, no los bytes, y lo guarda con `ft.drive.keep`
  por la referencia del mensaje: vale para un vídeo de 1 GB.
- Abrir un fichero en el visor del sistema, guardarlo en Descargas o **enviarlo a la
  conversación** (`send: propose`: llega al compositor y lo envía el usuario).
- Lo que espera red se ve con su motivo, y se reintenta o se descarta. Nunca se marca como
  guardado lo que no subió.
- Uso del drive y cuota de la nube, si el proveedor la dice.

La copia de seguridad del teléfono (historial + ficheros) va por el mismo drive, pero desde
Ajustes → Copia de seguridad de la app, no desde el plugin.

## Qué usa del núcleo

`ft.drive.*` (permiso `drive`): `status`, `connect`, `setup`, `unlock`, `list`, `mkdir`, `rename`,
`move`, `remove`, `upload`, `keep`, `open`, `save`, `send`, `retry`, `cancel`. Y `onOpen`
(`file` con nombre y tipo, `ref`, `lang`). Necesita el núcleo **1.1.0**. El contrato está en
[plugin-sdk](https://github.com/FlickerTalk/plugin-sdk).

## Desarrollo

```sh
npm install
npm test
```

`dist/index.js` registra el web component `ft-drive`; `dist/i18n.js` lleva los 21 idiomas. Sin
build. El paquete `.ftplugin` lo firma el catálogo de FlickerTalk; no se construye aquí.

## Licencia

MIT.
