import { IonAvatar } from '@ionic/react';

/**
 * Familia muscular derivada de `category`, usada para el duotono del avatar.
 * Ver docs/design-carga.md — variables --carga-avatar-<familia>-bg/text
 * definidas en src/theme/carga.css (con override de tema en prefers-color-scheme).
 */
export type AvatarFamily = 'empuje' | 'tiron' | 'pierna' | 'core' | 'brazos' | 'cardio';

const FAMILY_BY_CATEGORY: Record<string, AvatarFamily> = {
  chest: 'empuje',
  shoulders: 'empuje',
  back: 'tiron',
  'lower arms': 'tiron',
  neck: 'tiron',
  'upper legs': 'pierna',
  'lower legs': 'pierna',
  waist: 'core',
  'upper arms': 'brazos',
  cardio: 'cardio',
};

/** Familia por defecto para categorías fuera del dataset conocido. */
const DEFAULT_FAMILY: AvatarFamily = 'brazos';

/**
 * Familia muscular de una categoría del dataset. Exportada para que
 * src/coach/volume.ts (balance de volumen semanal, Progreso R4) reutilice
 * exactamente el mismo mapeo que los avatares en vez de duplicarlo.
 */
export function familyForCategory(category: string): AvatarFamily {
  return FAMILY_BY_CATEGORY[category.trim().toLowerCase()] ?? DEFAULT_FAMILY;
}

/** Color de fondo (duotono, consciente del tema) derivado de la familia muscular. */
export function colorForCategory(category: string): string {
  return `var(--carga-avatar-${familyForCategory(category)}-bg)`;
}

/** Color de texto/iniciales a juego con colorForCategory (mismo matiz duotono). */
export function textColorForCategory(category: string): string {
  return `var(--carga-avatar-${familyForCategory(category)}-text)`;
}

/** Iniciales (máx. 2 caracteres) derivadas del músculo objetivo. */
export function initialsForTarget(target: string): string {
  const words = target.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Pone en mayúscula la primera letra (el dataset viene todo en minúsculas). */
export function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface ExerciseAvatarProps {
  target: string;
  category: string;
  /** Tamaño en píxeles del círculo. Por defecto 40 (tamaño de lista). */
  size?: number;
}

/** Avatar circular duotono: iniciales del target sobre fondo de la familia muscular de la categoría. */
const ExerciseAvatar: React.FC<ExerciseAvatarProps> = ({ target, category, size = 40 }) => {
  const backgroundColor = colorForCategory(category);
  const color = textColorForCategory(category);
  const initials = initialsForTarget(target);

  return (
    <IonAvatar style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      <div
        className="carga-num"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'var(--app-radius-full)',
          backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          fontSize: `${size * 0.36}px`,
        }}
      >
        {initials}
      </div>
    </IonAvatar>
  );
};

export default ExerciseAvatar;
