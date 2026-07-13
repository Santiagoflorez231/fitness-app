/**
 * Punto único para "compartir" contenido desde CARGA (E2, resumen-celebración
 * de Entrenar). Hoy: copia el texto al portapapeles vía `navigator.clipboard`
 * -- no hay red, no hay diálogo nativo. El llamador es responsable de
 * mostrar su propio toast de confirmación ("Copiado.").
 *
 * TODO(T1 Android-pack, docs/renovacion-plan-v2.md): cuando el APK tenga
 * @capacitor/share cableado, sustituir el cuerpo por `Share.share({ text })`
 * en nativo (con este mismo fallback de portapapeles en web, mismo patrón
 * que src/utils/haptics.ts) -- la firma de esta función no cambia, así que
 * la migración es aditiva y no toca a los llamadores (Entrenar.tsx).
 */
export async function shareSummary(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
