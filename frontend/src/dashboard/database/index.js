import './accounts.js';
import './account-modals.js';
import './player-profile.js';
import './portrait-picker.js';

import { initDatabaseAccountsFeature } from './accounts.js';
import { initDatabaseAccountModalFeature } from './account-modals.js';
import { initDatabasePlayerProfileFeature } from './player-profile.js';
import { initDatabasePortraitPickerFeature } from './portrait-picker.js';

export const initDatabaseFeature = () => {
  initDatabaseAccountsFeature();
  initDatabaseAccountModalFeature();
  initDatabasePlayerProfileFeature();
  initDatabasePortraitPickerFeature();
};
