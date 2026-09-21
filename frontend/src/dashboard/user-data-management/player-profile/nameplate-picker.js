import { app } from '../../shared.js';

const { dom, state } = app;
const {
  nameplatePickerOpenButton,
  nameplatePickerModal,
  nameplatePickerTitle,
  nameplatePickerEyebrow,
  nameplatePickerCurrent,
  nameplatePickerGrid,
  nameplatePickerConfirmButton,
  nameplatePickerCloseTargets,
} = dom;

const getEntries = () => Object.values(state.nameplateEntiresMap ?? {})
  .filter((entry) => Number.isFinite(Number(entry?.Id)))
  .sort((left, right) => Number(left.Id) - Number(right.Id));

const getPreview = (entry) => {
  if (!entry) return '<span class="nameplate-picker-empty-preview">--</span>';
  const title = app.escapeHtml(String(entry.Title || ''));
  if (Number(entry.IconType) === 1) {
    return entry.Icon ? `<img src=".${entry.Icon}" alt="">` : '<span class="nameplate-picker-empty-preview">--</span>';
  }
  return `${entry.BackBoard ? `<img class="nameplate-picker-backboard" src=".${entry.BackBoard}" alt="">` : '<span class="nameplate-picker-empty-preview">--</span>'}${entry.OutLineColor ? `<img class="nameplate-picker-outline" src=".${entry.OutLineColor}" alt="">` : ''}<span class="nameplate-picker-title-text">${title}</span>`;
};

app.getNameplateQualityEffectClass = (quality) => {
  const normalizedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 0;
  if (normalizedQuality >= 6) return 'fashion-quality-tier-6';
  if (normalizedQuality >= 5) return 'fashion-quality-tier-5';
  if (normalizedQuality >= 4) return 'fashion-quality-tier-4';
  if (normalizedQuality >= 3) return 'fashion-quality-tier-3';
  if (normalizedQuality >= 2) return 'fashion-quality-tier-2';
  return '';
};

app.closeNameplatePicker = () => {
  if (!(nameplatePickerModal instanceof HTMLElement) || nameplatePickerModal.hidden) {
    state.nameplatePickerState = null;
    return;
  }
  nameplatePickerModal.hidden = true;
  app.setBodyModalOpen(false);
  state.nameplatePickerState = null;
  state.lastNameplatePickerTrigger?.focus?.({ preventScroll: true });
};

app.renderNameplatePicker = () => {
  if (!(nameplatePickerGrid instanceof HTMLElement) || !state.nameplatePickerState) return;
  const currentId = Number.isFinite(Number(state.playerProfileData?.current_wear_nameplate))
    ? Number(state.playerProfileData.current_wear_nameplate) : null;
  const currentEntry = getEntries().find((entry) => Number(entry.Id) === currentId);
  const unlocked = new Set((state.playerProfileData?.unlock_nameplates ?? []).map(Number));
  if (nameplatePickerTitle instanceof HTMLElement) nameplatePickerTitle.textContent = app.translate('runtime.nameplatePickerTitle');
  if (nameplatePickerEyebrow instanceof HTMLElement) nameplatePickerEyebrow.textContent = app.translate('runtime.nameplatePickerEyebrow');
  if (nameplatePickerCurrent instanceof HTMLElement) {
    nameplatePickerCurrent.innerHTML = `<span>${app.escapeHtml(app.translate('runtime.nameplatePickerCurrent'))}</span><strong>${app.escapeHtml(String(currentEntry?.Name || '--'))}</strong>`;
  }
  if (nameplatePickerConfirmButton instanceof HTMLButtonElement) {
    nameplatePickerConfirmButton.disabled = Boolean(state.nameplatePickerState.pending);
  }
  nameplatePickerGrid.innerHTML = getEntries().map((entry) => {
    const id = Number(entry.Id);
    const isSelected = state.nameplatePickerState.selectedId === id;
    const isLocked = !unlocked.has(id);
    const tooltip = JSON.stringify({ type: 'nameplate', name: entry.Name, title: entry.Title, quality: entry.NameplateQuality, description: entry.Description });
    return `<button type="button" class="nameplate-picker-item${isSelected ? ' is-selected' : ''}" data-nameplate-id="${id}" data-character-detail-equip-slot data-equip-tooltip-text="${app.escapeHtml(tooltip)}" aria-pressed="${isSelected ? 'true' : 'false'}"><span class="nameplate-picker-preview ${app.getNameplateQualityEffectClass(entry.NameplateQuality)}">${getPreview(entry)}${isLocked ? '<span class="character-detail-fashion-slot-lock" aria-hidden="true">🔒</span>' : ''}</span><strong>${app.escapeHtml(String(entry.Name || id))}</strong></button>`;
  }).join('');
};

app.openNameplatePicker = () => {
  if (!(nameplatePickerModal instanceof HTMLElement)) return;
  const currentId = Number.isFinite(Number(state.playerProfileData?.current_wear_nameplate)) ? Number(state.playerProfileData.current_wear_nameplate) : null;
  state.lastNameplatePickerTrigger = document.activeElement;
  state.nameplatePickerState = { selectedId: currentId, pending: false };
  nameplatePickerModal.hidden = false;
  app.setBodyModalOpen(true);
  app.renderNameplatePicker();
  nameplatePickerGrid?.querySelector('.is-selected, button')?.focus();
};

const submit = async () => {
  if (!state.nameplatePickerState || !(nameplatePickerConfirmButton instanceof HTMLButtonElement)) return;
  if (state.nameplatePickerState.pending) return;
  state.nameplatePickerState.pending = true;
  nameplatePickerConfirmButton.disabled = true;
  try {
    const payload = await app.apiFetch('/api/database-players/selected', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'current_wear_nameplate', value: state.nameplatePickerState.selectedId ?? 0 }),
    });
    app.closeNameplatePicker();
    app.renderPlayerProfile(payload);
  } catch (error) {
    state.nameplatePickerState.pending = false;
    nameplatePickerConfirmButton.disabled = false;
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.playerProfileUpdateFailed'));
  }
};

export const initDatabaseNameplatePickerFeature = () => {
  nameplatePickerOpenButton?.addEventListener('click', app.openNameplatePicker);
  nameplatePickerCloseTargets.forEach((target) => target.addEventListener('click', app.closeNameplatePicker));
  ['mouseover', 'mousemove', 'mouseout', 'focusin', 'focusout'].forEach((eventName) => {
    nameplatePickerModal?.addEventListener(eventName, app.handleCharacterDetailEquipTooltipEvent);
  });
  nameplatePickerGrid?.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-nameplate-id]') : null;
    if (!(button instanceof HTMLButtonElement) || !state.nameplatePickerState) return;
    const id = Number(button.dataset.nameplateId);
    const currentId = Number(state.playerProfileData?.current_wear_nameplate);
    state.nameplatePickerState.selectedId = id === currentId ? null : id;
    app.renderNameplatePicker();
  });
  nameplatePickerConfirmButton?.addEventListener('click', () => { void submit(); });
};
