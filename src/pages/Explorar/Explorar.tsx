import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { searchOutline } from 'ionicons/icons';
import { useExercises } from '../../hooks/useExercises';
import { useMostUsedExercises } from '../../hooks/useMostUsedExercises';
import ExerciseAvatar, {
  capitalize,
  colorForCategory,
  familyForCategory,
  initialsForTarget,
  textColorForCategory,
  type AvatarFamily,
} from '../../components/ExerciseAvatar';
import MuscleMap from '../../components/muscle-map/MuscleMap';
import { normalizeMuscle, REGION_LABEL, type RegionId } from '../../components/muscle-map/muscleRegions';
import CargaSkeleton from '../../components/CargaSkeleton';
import type { Exercise } from '../../types/exercise';
import { normalize } from '../../utils/text';
import mediaGym from '../../data/mediaGym.json';
import './Explorar.css';

const PAGE_SIZE = 50;
const ALL = 'all';
/** Número de filas iniciales que reciben la animación de entrada escalonada. */
const STAGGER_COUNT = 8;
const STAGGER_STEP_MS = 20;
/** Cuántos ejercicios muestra cada carril horizontal (sección 4). */
const RAIL_SIZE = 10;

/** Miniaturas 180×180 por exerciseId (Gymvisual vía dataset, M1). */
const MEDIA_GYM = mediaGym as Record<string, { thumb: string; gif: string }>;

/** 6 familias musculares del browse de cabecera, en el orden pedido. */
const FAMILIES: { id: AvatarFamily; label: string }[] = [
  { id: 'empuje', label: 'Empuje' },
  { id: 'tiron', label: 'Tirón' },
  { id: 'pierna', label: 'Pierna' },
  { id: 'core', label: 'Core' },
  { id: 'brazos', label: 'Brazos' },
  { id: 'cardio', label: 'Cardio' },
];

interface ChipOption {
  value: string;
  label: string;
}

interface FilterChipProps {
  label: string;
  value: string;
  active: boolean;
  ariaLabel: string;
  header: string;
  options: ChipOption[];
  onChange: (value: string) => void;
}

/**
 * Chip-píldora persistente que ancla un IonSelect invisible superpuesto: el
 * chip muestra la etiqueta/valor elegido y el IonSelect (opacity 0, cubre
 * todo el chip) abre el popover nativo de opciones al tocar.
 */
const FilterChip: React.FC<FilterChipProps> = ({
  label,
  value,
  active,
  ariaLabel,
  header,
  options,
  onChange,
}) => (
  <div className={`explorar-chip${active ? ' explorar-chip-active' : ''}`}>
    <span>{label}</span>
    <IonSelect
      className="explorar-chip-select"
      interface="popover"
      value={value}
      onIonChange={(event) => onChange(event.detail.value as string)}
      interfaceOptions={{ header }}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <IonSelectOption key={option.value} value={option.value}>
          {option.label}
        </IonSelectOption>
      ))}
    </IonSelect>
  </div>
);

interface FamilyCardProps {
  id: AvatarFamily;
  label: string;
  active: boolean;
  onToggle: (id: AvatarFamily) => void;
}

/** Card de browse por familia muscular (cabecera de Explorar, sección 1). */
const FamilyCard: React.FC<FamilyCardProps> = ({ id, label, active, onToggle }) => (
  <button
    type="button"
    className={`explorar-family-card${active ? ' explorar-family-card-active' : ''}`}
    style={{
      backgroundColor: `var(--carga-avatar-${id}-bg)`,
      color: `var(--carga-avatar-${id}-text)`,
    }}
    onClick={() => onToggle(id)}
    aria-pressed={active}
  >
    {label}
  </button>
);

interface ExplorarRailCardProps {
  exercise: Exercise;
}

/** Card compacta de carril horizontal (sección 4): thumb arriba, nombre debajo. */
const ExplorarRailCard: React.FC<ExplorarRailCardProps> = ({ exercise }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = MEDIA_GYM[exercise.id]?.thumb;
  const showThumb = thumb !== undefined && !imgFailed;

  return (
    <Link to={`/tabs/explorar/${exercise.id}`} className="explorar-rail-card">
      <div className="explorar-rail-thumb">
        {showThumb ? (
          <img
            src={`${import.meta.env.BASE_URL}${thumb}`}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="carga-num explorar-rail-thumb-fallback"
            style={{
              backgroundColor: colorForCategory(exercise.category),
              color: textColorForCategory(exercise.category),
            }}
          >
            {initialsForTarget(exercise.target)}
          </div>
        )}
      </div>
      <span className="explorar-rail-name">{exercise.name}</span>
    </Link>
  );
};

interface ExplorarRailProps {
  title: string;
  exercises: Exercise[];
}

/** Carril horizontal con scroll lateral; se oculta solo si no hay ejercicios. */
const ExplorarRail: React.FC<ExplorarRailProps> = ({ title, exercises }) => {
  if (exercises.length === 0) {
    return null;
  }
  return (
    <section className="explorar-rail-section">
      <p className="carga-overline explorar-rail-title">{title}</p>
      <div className="explorar-rail-row">
        {exercises.map((exercise) => (
          <ExplorarRailCard key={exercise.id} exercise={exercise} />
        ))}
      </div>
    </section>
  );
};

/**
 * PRNG determinista (mulberry32) sembrado una sola vez al cargar el módulo:
 * los carriles "Peso corporal"/"Con barra" muestran un subconjunto aleatorio
 * pero ESTABLE mientras la app sigue abierta (no se reordena en cada render
 * ni al cambiar de filtro; solo cambia si se recarga la app).
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SESSION_SEED = Date.now();

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const Explorar: React.FC = () => {
  const { exercises, filters, loading } = useExercises();
  const { entries: mostUsedEntries } = useMostUsedExercises();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [selectedEquipment, setSelectedEquipment] = useState<string>(ALL);
  const [selectedTarget, setSelectedTarget] = useState<string>(ALL);
  const [selectedFamily, setSelectedFamily] = useState<AvatarFamily | null>(null);
  const [muscleBrowseOpen, setMuscleBrowseOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Se incrementa en cada cambio de filtro/búsqueda para forzar el remount
  // (y por tanto la animación de entrada) de las primeras filas.
  const [filterVersion, setFilterVersion] = useState(0);

  const normalizedSearch = useMemo(() => normalize(searchTerm), [searchTerm]);

  const filtersActive =
    normalizedSearch !== '' ||
    selectedCategory !== ALL ||
    selectedEquipment !== ALL ||
    selectedTarget !== ALL ||
    selectedFamily !== null ||
    selectedRegion !== null;

  const filteredExercises = useMemo<Exercise[]>(() => {
    return exercises.filter((exercise) => {
      if (selectedCategory !== ALL && exercise.category !== selectedCategory) {
        return false;
      }
      if (selectedEquipment !== ALL && exercise.equipment !== selectedEquipment) {
        return false;
      }
      if (selectedTarget !== ALL && exercise.target !== selectedTarget) {
        return false;
      }
      if (selectedFamily !== null && familyForCategory(exercise.category) !== selectedFamily) {
        return false;
      }
      if (selectedRegion !== null && normalizeMuscle(exercise.target) !== selectedRegion) {
        return false;
      }
      if (normalizedSearch && !normalize(exercise.name).includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [exercises, selectedCategory, selectedEquipment, selectedTarget, selectedFamily, selectedRegion, normalizedSearch]);

  // Reinicia la paginación cada vez que cambian los criterios de filtrado/búsqueda.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setFilterVersion((previous) => previous + 1);
  }, [selectedCategory, selectedEquipment, selectedTarget, selectedFamily, selectedRegion, normalizedSearch]);

  const visibleExercises = filteredExercises.slice(0, visibleCount);
  const hasMore = visibleCount < filteredExercises.length;

  // Carriles horizontales (sección 4): solo tienen sentido sin búsqueda/filtros.
  const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const mostUsedExercises = useMemo(
    () => mostUsedEntries.map((entry) => exerciseById.get(entry.exerciseId)).filter((e): e is Exercise => e !== undefined),
    [mostUsedEntries, exerciseById],
  );
  const bodyweightExercises = useMemo(
    () => seededShuffle(exercises.filter((exercise) => exercise.equipment === 'body weight'), SESSION_SEED + 1).slice(0, RAIL_SIZE),
    [exercises],
  );
  const barbellExercises = useMemo(
    () => seededShuffle(exercises.filter((exercise) => exercise.equipment === 'barbell'), SESSION_SEED + 2).slice(0, RAIL_SIZE),
    [exercises],
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(ALL);
    setSelectedEquipment(ALL);
    setSelectedTarget(ALL);
    setSelectedFamily(null);
    setSelectedRegion(null);
    setMuscleBrowseOpen(false);
  };

  const handleFamilyToggle = (family: AvatarFamily) => {
    setSelectedFamily((previous) => (previous === family ? null : family));
  };

  const handleRegionClick = (region: RegionId) => {
    setSelectedRegion((previous) => (previous === region ? null : region));
  };

  const handleInfinite = (event: CustomEvent<void>) => {
    window.setTimeout(() => {
      setVisibleCount((previous) => Math.min(previous + PAGE_SIZE, filteredExercises.length));
      (event.target as HTMLIonInfiniteScrollElement).complete();
    }, 150);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Explorar</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            className="explorar-searchbar"
            placeholder="Buscar ejercicio…"
            debounce={300}
            value={searchTerm}
            onIonInput={(event) => setSearchTerm(event.detail.value ?? '')}
          />
        </IonToolbar>
        <IonToolbar>
          <div className="explorar-family-row">
            {FAMILIES.map((family) => (
              <FamilyCard
                key={family.id}
                id={family.id}
                label={family.label}
                active={selectedFamily === family.id}
                onToggle={handleFamilyToggle}
              />
            ))}
          </div>
        </IonToolbar>
        <IonToolbar>
          <div className="explorar-chip-row">
            <FilterChip
              label={selectedCategory === ALL ? 'Categoría' : capitalize(selectedCategory)}
              value={selectedCategory}
              active={selectedCategory !== ALL}
              ariaLabel="Categoría"
              header="Categoría"
              options={[
                { value: ALL, label: 'Todas las categorías' },
                ...filters.categories.map((category) => ({
                  value: category,
                  label: capitalize(category),
                })),
              ]}
              onChange={setSelectedCategory}
            />
            <FilterChip
              label={selectedEquipment === ALL ? 'Equipo' : capitalize(selectedEquipment)}
              value={selectedEquipment}
              active={selectedEquipment !== ALL}
              ariaLabel="Equipo"
              header="Equipo"
              options={[
                { value: ALL, label: 'Todo el equipo' },
                ...filters.equipment.map((equipment) => ({
                  value: equipment,
                  label: capitalize(equipment),
                })),
              ]}
              onChange={setSelectedEquipment}
            />
            <FilterChip
              label={selectedTarget === ALL ? 'Músculo' : capitalize(selectedTarget)}
              value={selectedTarget}
              active={selectedTarget !== ALL}
              ariaLabel="Músculo objetivo"
              header="Músculo objetivo"
              options={[
                { value: ALL, label: 'Todos los músculos' },
                ...filters.targets.map((target) => ({
                  value: target,
                  label: capitalize(target),
                })),
              ]}
              onChange={setSelectedTarget}
            />
            <button
              type="button"
              className={`explorar-chip explorar-chip-toggle${muscleBrowseOpen || selectedRegion !== null ? ' explorar-chip-active' : ''}`}
              onClick={() => setMuscleBrowseOpen((value) => !value)}
              aria-pressed={muscleBrowseOpen}
            >
              Por músculo
            </button>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Explorar</IonTitle>
          </IonToolbar>
        </IonHeader>

        {loading ? (
          <div className="explorar-skeleton-wrap">
            <CargaSkeleton variant="block" height={44} />
            <div className="explorar-skeleton-family-row">
              {Array.from({ length: 6 }).map((_, index) => (
                <CargaSkeleton key={index} variant="block" width={84} height={52} />
              ))}
            </div>
            <div className="explorar-skeleton-rows">
              {Array.from({ length: 6 }).map((_, index) => (
                <CargaSkeleton key={index} variant="row" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {muscleBrowseOpen && (
              <div className="explorar-muscle-panel carga-card">
                <div className="explorar-muscle-panel-header">
                  <p className="carga-overline">Explorar por músculo</p>
                  <button
                    type="button"
                    className="explorar-muscle-panel-close"
                    onClick={() => setMuscleBrowseOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>
                <MuscleMap
                  mode="highlight"
                  primary={[]}
                  secondary={[]}
                  isCardio={false}
                  selected={selectedRegion ?? undefined}
                  onRegionClick={handleRegionClick}
                />
                {selectedRegion && (
                  <div className="explorar-muscle-panel-selected">
                    <span>Filtrando por {REGION_LABEL[selectedRegion]}</span>
                    <button type="button" onClick={() => setSelectedRegion(null)}>
                      Limpiar
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="ion-padding-horizontal ion-padding-top">
              <p className="carga-overline explorar-counter" key={filterVersion}>
                {filteredExercises.length.toLocaleString('es-ES')}{' '}
                {filteredExercises.length === 1 ? 'ejercicio' : 'ejercicios'}
              </p>
            </div>

            {!filtersActive && (
              <>
                <ExplorarRail title="Más usados por ti" exercises={mostUsedExercises} />
                <ExplorarRail title="Peso corporal" exercises={bodyweightExercises} />
                <ExplorarRail title="Con barra" exercises={barbellExercises} />
              </>
            )}

            {filteredExercises.length === 0 ? (
              <div className="explorar-empty">
                <IonIcon icon={searchOutline} className="explorar-empty-icon" />
                <p className="explorar-empty-text">Nada por aquí. Prueba otro filtro.</p>
                <button
                  type="button"
                  className="explorar-empty-clear"
                  onClick={handleClearFilters}
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <>
                <IonList>
                  {visibleExercises.map((exercise, index) => {
                    const animated = index < STAGGER_COUNT;
                    return (
                      <IonItem
                        key={animated ? `${filterVersion}-${exercise.id}` : exercise.id}
                        className={`explorar-row${animated ? ' explorar-row-enter' : ''}`}
                        style={animated ? { animationDelay: `${index * STAGGER_STEP_MS}ms` } : undefined}
                        routerLink={`/tabs/explorar/${exercise.id}`}
                        detail={false}
                        lines="full"
                      >
                        <ExerciseAvatar
                          target={exercise.target}
                          category={exercise.category}
                          size={56}
                          shape="square"
                          exerciseId={exercise.id}
                        />
                        <IonLabel className="ion-text-wrap" style={{ marginInlineStart: '12px' }}>
                          <h2 className="explorar-row-name">{exercise.name}</h2>
                          <p className="explorar-row-meta">
                            {capitalize(exercise.target)} · {capitalize(exercise.equipment)}
                          </p>
                        </IonLabel>
                      </IonItem>
                    );
                  })}
                </IonList>

                <IonInfiniteScroll
                  onIonInfinite={handleInfinite}
                  threshold="100px"
                  disabled={!hasMore}
                >
                  <IonInfiniteScrollContent loadingText="Cargando más ejercicios…" />
                </IonInfiniteScroll>
              </>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Explorar;
