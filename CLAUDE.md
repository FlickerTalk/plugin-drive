# plugin-drive

Plugin **Mi drive** de FlickerTalk (`Plan.md §53–§58`, plan del drive fase A, 2026-09-27). Repo
propio; el paquete lo firma y publica el catálogo (`FlickerTalk/web`).

- `module.json`: `com.flickertalk.drive`, componente `ft-drive`, permisos `drive` y
  `send: propose`, abre `*/*`, `minCoreVersion` 1.1.0.
- `dist/index.js`: el web component y las funciones puras (tamaños, iconos, migas) exportadas
  para los tests. `dist/i18n.js`: 21 idiomas con huecos `{name}`.
- Sin build. `npm test` (Vitest + happy-dom, con un núcleo falso en `index.test.js`).

## Reglas

- **Ni un byte de fichero pasa por el marco**: subir es `ft.drive.upload` (el selector lo abre
  la app), guardar desde el chat es `ft.drive.keep` (por el `ref`), abrir/guardar/enviar son ids.
  Tokens, clave del drive y frase de recuperación viven en el núcleo o en la cabeza del usuario:
  **la frase nunca pasa por el marco** (2026-09-28). Crear el drive y abrir uno de otro teléfono
  se hace en Ajustes → Copia de seguridad de la app; el plugin lo dice y no pide nada (el núcleo
  rechaza `setup` y `unlock` desde un plugin). Versión 1.1.0.
- Todo estado es el del núcleo (`ft.drive.status`); el plugin no guarda nada en `ft.store`.
- Estados honestos: lo pendiente se enseña con su motivo; un fallo se dice, nunca se finge.
- Iconos: solo los que presta el núcleo (`./icon/<nombre>.svg`). Textos: solo del catálogo, cada
  clave nueva en los 21 idiomas en el mismo cambio (el test lo exige).
- Código y comentarios en inglés; `.md` en español.
