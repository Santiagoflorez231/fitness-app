import { useEffect, useMemo, useState } from 'react';
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
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { searchOutline } from 'ionicons/icons';
import { useExercises } from '../../hooks/useExercises';
import ExerciseAvatar, { capitalize } from '../../components/ExerciseAvatar';
import type { Exercise } from '../../types/exercise';
import { normalize } from '../../utils/text';
import './Explorar.css';

const PAGE_SIZE = 50;
const ALL = 'all';
/** Número de filas iniciales que reciben la animación de entrada escalonada. */
const STAGGER_COUNT = 8;
const STAGGER_STEP_MS = 20;

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

const Explorar: React.FC = () => {
  const { exercises, filters, loading } = useExercises();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [selectedEquipment, setSelectedEquipment] = useState<string>(ALL);
  const [selectedTarget, setSelectedTarget] = useState<string>(ALL);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Se incrementa en cada cambio de filtro/búsqueda para forzar el remount
  // (y por tanto la animación de entrada) de las primeras filas.
  const [filterVersion, setFilterVersion] = useState(0);

  const normalizedSearch = useMemo(() => normalize(searchTerm), [searchTerm]);

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
      if (normalizedSearch && !normalize(exercise.name).includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [exercises, selectedCategory, selectedEquipment, selectedTarget, normalizedSearch]);

  // Reinicia la paginación cada vez que cambian los criterios de filtrado/búsqueda.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setFilterVersion((previous) => previous + 1);
  }, [selectedCategory, selectedEquipment, selectedTarget, normalizedSearch]);

  const visibleExercises = filteredExercises.slice(0, visibleCount);
  const hasMore = visibleCount < filteredExercises.length;

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(ALL);
    setSelectedEquipment(ALL);
    setSelectedTarget(ALL);
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              paddingTop: '4rem',
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            <div className="ion-padding-horizontal ion-padding-top">
              <p className="carga-overline explorar-counter" key={filterVersion}>
                {filteredExercises.length.toLocaleString('es-ES')}{' '}
                {filteredExercises.length === 1 ? 'ejercicio' : 'ejercicios'}
              </p>
            </div>

            {filteredExercises.length === 0 ? (
              <div className="explorar-empty">
                <IonIcon icon={searchOutline} className="explorar-empty-icon" />
                <p className="explorar-empty-text">Sin resultados</p>
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
                          size={44}
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
