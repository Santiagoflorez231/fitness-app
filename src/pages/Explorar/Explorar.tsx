import { useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
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

const PAGE_SIZE = 50;
const ALL = 'all';

const Explorar: React.FC = () => {
  const { exercises, filters, loading } = useExercises();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [selectedEquipment, setSelectedEquipment] = useState<string>(ALL);
  const [selectedTarget, setSelectedTarget] = useState<string>(ALL);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
            placeholder="Buscar ejercicio…"
            debounce={300}
            value={searchTerm}
            onIonInput={(event) => setSearchTerm(event.detail.value ?? '')}
          />
        </IonToolbar>
        <IonToolbar>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
            <IonSelect
              interface="popover"
              value={selectedCategory}
              onIonChange={(event) => setSelectedCategory(event.detail.value as string)}
              interfaceOptions={{ header: 'Categoría' }}
              aria-label="Categoría"
              style={{ flex: '1 1 30%', minWidth: '110px' }}
            >
              <IonSelectOption value={ALL}>Todas las categorías</IonSelectOption>
              {filters.categories.map((category) => (
                <IonSelectOption key={category} value={category}>
                  {capitalize(category)}
                </IonSelectOption>
              ))}
            </IonSelect>
            <IonSelect
              interface="popover"
              value={selectedEquipment}
              onIonChange={(event) => setSelectedEquipment(event.detail.value as string)}
              interfaceOptions={{ header: 'Equipo' }}
              aria-label="Equipo"
              style={{ flex: '1 1 30%', minWidth: '110px' }}
            >
              <IonSelectOption value={ALL}>Todo el equipo</IonSelectOption>
              {filters.equipment.map((equipment) => (
                <IonSelectOption key={equipment} value={equipment}>
                  {capitalize(equipment)}
                </IonSelectOption>
              ))}
            </IonSelect>
            <IonSelect
              interface="popover"
              value={selectedTarget}
              onIonChange={(event) => setSelectedTarget(event.detail.value as string)}
              interfaceOptions={{ header: 'Músculo objetivo' }}
              aria-label="Músculo objetivo"
              style={{ flex: '1 1 30%', minWidth: '110px' }}
            >
              <IonSelectOption value={ALL}>Todos los músculos</IonSelectOption>
              {filters.targets.map((target) => (
                <IonSelectOption key={target} value={target}>
                  {capitalize(target)}
                </IonSelectOption>
              ))}
            </IonSelect>
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
              <IonNote>
                {filteredExercises.length.toLocaleString('es-ES')}{' '}
                {filteredExercises.length === 1 ? 'ejercicio' : 'ejercicios'}
              </IonNote>
            </div>

            {filteredExercises.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                }}
              >
                <IonIcon icon={searchOutline} style={{ fontSize: '3rem' }} color="medium" />
                <p>Sin resultados</p>
                <IonButton onClick={handleClearFilters}>Limpiar filtros</IonButton>
              </div>
            ) : (
              <>
                <IonList>
                  {visibleExercises.map((exercise) => (
                    <IonItem
                      key={exercise.id}
                      routerLink={`/tabs/explorar/${exercise.id}`}
                      detail
                    >
                      <ExerciseAvatar target={exercise.target} category={exercise.category} />
                      <IonLabel className="ion-text-wrap" style={{ marginInlineStart: '0.75rem' }}>
                        <h2>{exercise.name}</h2>
                        <p>
                          {capitalize(exercise.target)} · {capitalize(exercise.equipment)}
                        </p>
                      </IonLabel>
                    </IonItem>
                  ))}
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
