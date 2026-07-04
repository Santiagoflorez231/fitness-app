import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { barbell, list, stopwatch, trendingUp } from 'ionicons/icons';
import Explorar from './pages/Explorar/Explorar';
import ExerciseDetail from './pages/ExerciseDetail/ExerciseDetail';
import Rutinas from './pages/Rutinas/Rutinas';
import RoutineEditor from './pages/RoutineEditor/RoutineEditor';
import Entrenar from './pages/Entrenar/Entrenar';
import Progreso from './pages/Progreso/Progreso';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
/* Nuestros tokens (variables.css) ya definen ambos temas: el palette de
   Ionic pisaría esos valores, así que no se importa. */

/* Fuentes locales CARGA (Archivo + IBM Plex Sans) */
import './theme/fonts';

/* Theme variables */
import './theme/variables.css';

/* Estilos globales del sistema de diseño CARGA */
import './theme/carga.css';

/* Tailwind CSS (solo theme + utilities, sin preflight) */
import './theme/tailwind.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/">
          <Redirect to="/tabs/explorar" />
        </Route>
        <Route path="/tabs">
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/tabs/explorar">
                <Explorar />
              </Route>
              <Route exact path="/tabs/explorar/:id">
                <ExerciseDetail />
              </Route>
              <Route exact path="/tabs/rutinas">
                <Rutinas />
              </Route>
              <Route exact path="/tabs/rutinas/nueva">
                <RoutineEditor />
              </Route>
              <Route exact path="/tabs/rutinas/editar/:id">
                <RoutineEditor />
              </Route>
              <Route exact path="/tabs/entrenar">
                <Entrenar />
              </Route>
              <Route exact path="/tabs/progreso">
                <Progreso />
              </Route>
              <Route exact path="/tabs">
                <Redirect to="/tabs/explorar" />
              </Route>
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              <IonTabButton tab="explorar" href="/tabs/explorar">
                <IonIcon icon={barbell} />
                <IonLabel>Explorar</IonLabel>
              </IonTabButton>
              <IonTabButton tab="rutinas" href="/tabs/rutinas">
                <IonIcon icon={list} />
                <IonLabel>Rutinas</IonLabel>
              </IonTabButton>
              <IonTabButton tab="entrenar" href="/tabs/entrenar">
                <IonIcon icon={stopwatch} />
                <IonLabel>Entrenar</IonLabel>
              </IonTabButton>
              <IonTabButton tab="progreso" href="/tabs/progreso">
                <IonIcon icon={trendingUp} />
                <IonLabel>Progreso</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
