/**
 * Vocabulario háptico de CARGA — la app se siente en la mano.
 *
 * Mismo patrón de import dinámico que RestTimer.vibrateShort: en web el
 * plugin puede no estar disponible y no debe romper nada (no-op silencioso).
 * Según la doc del plugin (@capacitor/haptics 8), en dispositivos sin motor
 * háptico las llamadas resuelven sin efecto, así que no hacen falta guards.
 *
 * Regla de diseño (docs/design-carga.md): lo funcional es rápido y seco;
 * solo los logros celebran. Serie = golpe seco. PR = notificación de éxito.
 */

/** Golpe seco y ligero al confirmar una serie. */
export async function hapticSetDone(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Sin soporte: no-op.
  }
}

/** Feedback de logro al batir un PR (el equivalente háptico del pr-pop). */
export async function hapticPr(): Promise<void> {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Sin soporte: no-op.
  }
}
