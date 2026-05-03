import './health.js';
import './server-controls.js';
import './logs.js';
import './config.js';

import { initStatusHealthFeature } from './health.js';
import { initServerControlsFeature } from './server-controls.js';
import { initStatusLogFeature } from './logs.js';
import { initStatusConfigFeature } from './config.js';

export const initStatusFeature = () => {
  initStatusHealthFeature();
  initServerControlsFeature();
  initStatusLogFeature();
  initStatusConfigFeature();
};
