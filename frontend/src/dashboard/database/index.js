import './accounts.js';
import './account-modals.js';
import './item-management.js';
import './weapon-management.js';
import './item-add-modal.js';
import './weapon-add-modal.js';
import './item-modals.js';
import './player-profile.js';
import './portrait-picker.js';

import { initDatabaseAccountsFeature } from './accounts.js';
import { initDatabaseAccountModalFeature } from './account-modals.js';
import { initDatabaseItemManagementFeature } from './item-management.js';
import { initDatabaseWeaponManagementFeature } from './weapon-management.js';
import { initDatabaseItemAddModalFeature } from './item-add-modal.js';
import { initDatabaseWeaponAddModalFeature } from './weapon-add-modal.js';
import { initDatabaseItemModalFeature } from './item-modals.js';
import { initDatabasePlayerProfileFeature } from './player-profile.js';
import { initDatabasePortraitPickerFeature } from './portrait-picker.js';

export const initDatabaseFeature = () => {
  initDatabaseAccountsFeature();
  initDatabaseAccountModalFeature();
  initDatabaseItemManagementFeature();
  initDatabaseWeaponManagementFeature();
  initDatabaseItemAddModalFeature();
  initDatabaseWeaponAddModalFeature();
  initDatabaseItemModalFeature();
  initDatabasePlayerProfileFeature();
  initDatabasePortraitPickerFeature();
};
