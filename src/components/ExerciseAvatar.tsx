import { IonAvatar } from '@ionic/react';

/** Paleta de colores para los avatares placeholder, elegida por contraste con texto blanco. */
const AVATAR_PALETTE = [
  '#5260ff',
  '#3dc2ff',
  '#2dd36f',
  '#ffc409',
  '#eb445a',
  '#7044ff',
  '#00b894',
  '#ff7043',
  '#0cabaf',
  '#8e7cc3',
];

/** Hash simple (djb2-like) para derivar un índice determinista a partir de un string. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Color de fondo determinista para una categoría dada. */
export function colorForCategory(category: string): string {
  const index = hashString(category) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
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

/** Avatar circular placeholder: iniciales del target sobre un color derivado de la categoría. */
const ExerciseAvatar: React.FC<ExerciseAvatarProps> = ({ target, category, size = 40 }) => {
  const backgroundColor = colorForCategory(category);
  const initials = initialsForTarget(target);

  return (
    <IonAvatar style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 600,
          fontSize: `${size * 0.38}px`,
        }}
      >
        {initials}
      </div>
    </IonAvatar>
  );
};

export default ExerciseAvatar;
