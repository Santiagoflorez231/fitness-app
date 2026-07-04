export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  target: string;
  muscle_group: string;
  secondary_muscles: string[];
  media_id: string | null;
  steps: { en: string[]; es: string[] };
}

export interface ExerciseFilters {
  categories: string[];
  equipment: string[];
  targets: string[];
}
