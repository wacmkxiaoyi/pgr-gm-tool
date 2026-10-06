import { app } from '../../shared.js';

const { state } = app;
const el = (id) => document.getElementById(id);
const modal = el('character-partner-switch-modal');
const escape = app.escapeHtml;
const t = (key) => app.translate(`dashboard.${key}`);
const view = { generation: 0, uid: null, characterId: null, items: [], current: null, selected: null, sort: 'quality', order: 'desc', pending: false, loading: false, trigger: null };
const entry = (item) => state.partnerEntriesMap[item.TemplateId] ?? {};
const quality = (item) => `<span class="character-quality ${app.getCharacterQualityClass(item.Quality)}">${escape(app.getCharacterQualityDisplayLabel(item.Quality, item.Star))}</span>`;
const media = (item) => app.renderEquipMediaCell(entry(item).Icon, entry(item).Name ?? '--', true, `character-icon-tier-${item.Quality}`);
const tooltip = (item) => escape(JSON.stringify({ type: 'partner', ...item, name: entry(item).Name ?? '--', description: app.stripMarkupText(entry(item).Desc ?? '') }));

app.renderCharacterDetailPartnerSlot = (item) => {
  const container = el('character-detail-pet');
  if (!container) return;
  const data = item ? entry(item) : {};
  container.innerHTML = `<button type="button" class="character-detail-weapon-trigger" data-character-partner-trigger aria-label="${escape(t('characterPartnerSwitchTitle'))}" ${item ? `data-character-detail-equip-slot data-equip-tooltip-text="${tooltip(item)}"` : ''}>
    <div class="character-detail-slot character-detail-slot-medium ${item ? `character-detail-equip-slot character-partner-slot character-icon-tier-${item.Quality}` : 'is-empty'}">
      ${item ? data.Icon ? `<img class="character-detail-equip-icon" src=".${escape(data.Icon)}" alt="${escape(data.Name ?? '')}">` : '<span class="character-detail-equip-icon-fallback"></span>' : ''}
    </div></button>`;
};

const render = () => {
  const keyword = el('character-partner-switch-search').value.trim().toLocaleLowerCase();
  const items = view.items.map((item) => {
    const name = String(entry(item).Name ?? '');
    const owner = app.getCharacterNameByCharacterId(item.CharacterId);
    const priority = !keyword || name.toLocaleLowerCase().includes(keyword) ? 0 : owner.toLocaleLowerCase().includes(keyword) ? 1 : 2;
    return { item, name, owner, priority };
  }).filter((row) => row.priority < 2).sort((a, b) => {
    const field = view.sort;
    const primary = field === 'name' || field === 'character'
      ? (field === 'name' ? a.name : a.owner).localeCompare(field === 'name' ? b.name : b.owner, state.locale)
      : field === 'quality' ? a.item.Quality - b.item.Quality || a.item.Star - b.item.Star : a.item.EnhancementLevel - b.item.EnhancementLevel;
    return a.priority - b.priority || primary * (view.order === 'asc' ? 1 : -1) || a.name.localeCompare(b.name, state.locale) || a.item.record_id - b.item.record_id;
  });
  el('character-partner-switch-current').innerHTML = view.current
    ? `<button type="button" class="character-equip-switch-current-card" data-partner-candidate-detail="${view.current.record_id}" data-character-detail-equip-slot data-equip-tooltip-text="${tooltip(view.current)}">${media(view.current)}<span class="character-equip-switch-current-tag">${t('characterEquipSwitchCurrent')}</span></button>`
    : `<div class="character-equip-switch-current-empty">${t('characterEquipSwitchCurrentEmpty')}</div>`;
  el('character-partner-switch-body').innerHTML = items.map(({ item }) => `<tr class="character-weapon-switch-row${view.selected === item.record_id ? ' is-selected' : ''}" tabindex="0" data-partner-candidate="${item.record_id}">
    <td><span tabindex="0" data-character-detail-equip-slot data-equip-tooltip-text="${tooltip(item)}">${media(item)}</span></td>
    <td>${app.renderEquipMediaCell(app.getCharacterIconByCharacterId(item.CharacterId), app.getCharacterNameByCharacterId(item.CharacterId), false)}</td>
    <td>${quality(item)}</td><td>${app.renderEquipEnhancementLevel({ ...item, Breakthrough: item.BreakThrough })}</td>
    <td><div class="accounts-row-actions"><button type="button" class="status-action-button ${view.selected === item.record_id ? 'status-action-button-stop' : 'status-action-button-config'}" data-partner-candidate-select="${item.record_id}">${t(view.selected === item.record_id ? 'characterWeaponSwitchSelected' : 'characterWeaponSwitchSelect')}</button><button type="button" class="status-action-button status-action-button-log" data-partner-candidate-detail="${item.record_id}">${t('characterWeaponSwitchDetail')}</button></div></td></tr>`).join('');
  el('character-partner-switch-empty').hidden = view.loading || items.length > 0;
  el('character-partner-switch-save').disabled = view.pending || view.loading || !view.selected;
  modal.querySelectorAll('[data-partner-candidate-sort]').forEach((button) => {
    const arrow = button.querySelector('.column-sort-arrow');
    arrow.hidden = button.dataset.partnerCandidateSort !== view.sort;
    arrow.textContent = view.order === 'asc' ? '▲' : '▼';
  });
};

app.closeCharacterPartnerSwitchModal = () => {
  const wasOpen = !modal.hidden;
  view.generation += 1;
  modal.hidden = true;
  if (wasOpen) {
    app.closePartnerDetailModal?.();
    app.hideCharacterDetailEquipTooltip();
    app.setBodyModalOpen(!el('character-detail-modal').hidden);
    if (view.trigger?.isConnected) view.trigger.focus();
    else if (!el('character-detail-modal').hidden) el('character-detail-pet').querySelector('button')?.focus();
  }
  view.items = []; view.current = null; view.selected = null; view.pending = false; view.loading = false;
};
app.handleCharacterPartnerSwitchEscape = () => {
  if (modal.hidden) return false;
  app.closeCharacterPartnerSwitchModal();
  return true;
};
app.loadCharacterPartnerSwitchCandidates = async () => {
  const generation = view.generation;
  const uid = view.uid;
  const characterId = view.characterId;
  view.loading = true; render();
  try {
    const data = await app.apiFetch(`/api/database-characters/selected/${characterId}/partner-candidates`);
    if (generation !== view.generation || uid !== state.selectedAccountUid || modal.hidden) return;
    view.items = data.items ?? []; view.current = data.current_partner;
    if (!view.items.some((item) => item.record_id === view.selected)) view.selected = view.current?.record_id ?? null;
  } catch (error) {
    if (generation !== view.generation || uid !== state.selectedAccountUid) return;
    app.closeCharacterPartnerSwitchModal();
    app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.partnerFailed'));
  } finally {
    if (generation === view.generation) { view.loading = false; render(); }
  }
};
app.refreshCharacterPartnerEquipment = async () => {
  const characterId = state.currentCharacterDetailItem?.record_id;
  if (characterId && !el('character-detail-modal').hidden) await app.loadCharacterDetailExtraInfo(characterId);
  if (!modal.hidden) await app.loadCharacterPartnerSwitchCandidates();
};
const open = (trigger) => {
  if (!state.currentCharacterDetailItem || !app.canAccessPartnerManagement()) return;
  view.generation += 1; view.uid = state.selectedAccountUid; view.characterId = state.currentCharacterDetailItem.record_id;
  view.trigger = trigger; view.items = []; view.current = null; view.selected = null;
  view.sort = 'quality'; view.order = 'desc'; view.pending = false;
  el('character-partner-switch-search').value = '';
  app.hideCharacterDetailEquipTooltip();
  modal.hidden = false; app.setBodyModalOpen(true);
  void app.loadCharacterPartnerSwitchCandidates();
  el('character-partner-switch-search').focus();
};
const save = async () => {
  if (view.pending || view.loading || !view.selected || !app.canAccessPartnerManagement()) return;
  const generation = view.generation;
  const uid = view.uid;
  const characterId = view.characterId;
  view.pending = true; render();
  try {
    await app.apiFetch(`/api/database-characters/selected/${characterId}/partner`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ PartnerRecordId: view.selected }),
    });
    if (generation !== view.generation || uid !== state.selectedAccountUid) return;
    await app.refreshCharacterPartnerEquipment();
    if (generation !== view.generation || uid !== state.selectedAccountUid) return;
    await app.loadSelectedAccountPartners();
    if (generation !== view.generation || uid !== state.selectedAccountUid) return;
    app.closeCharacterPartnerSwitchModal();
    app.openSuccessModal(t('characterPartnerSwitchSaved'));
  } catch (error) {
    if (generation === view.generation && uid === state.selectedAccountUid && !app.isMutationRiskCancelled(error)) app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.partnerFailed'));
  } finally {
    if (generation === view.generation) { view.pending = false; render(); }
  }
};

export const initCharacterPartnerSwitchFeature = () => {
  el('character-detail-pet').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-character-partner-trigger]');
    if (trigger) open(trigger);
  });
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-character-partner-close]')) { app.closeCharacterPartnerSwitchModal(); return; }
    if (view.pending || view.loading) return;
    const detail = event.target.closest('[data-partner-candidate-detail]');
    if (detail) { app.hideCharacterDetailEquipTooltip(); void app.openPartnerDetailModal(Number(detail.dataset.partnerCandidateDetail), detail); return; }
    const sort = event.target.closest('[data-partner-candidate-sort]');
    if (sort) {
      view.order = view.sort === sort.dataset.partnerCandidateSort && view.order === 'asc' ? 'desc' : 'asc';
      view.sort = sort.dataset.partnerCandidateSort; render(); return;
    }
    const row = event.target.closest('[data-partner-candidate]');
    if (row && !view.pending) { view.selected = Number(row.dataset.partnerCandidate); render(); }
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); app.closeCharacterPartnerSwitchModal(); }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-partner-candidate]')) {
      event.preventDefault(); view.selected = Number(event.target.dataset.partnerCandidate); render();
    }
  });
  for (const type of ['mouseover', 'mouseout', 'mousemove', 'focusin', 'focusout']) modal.addEventListener(type, app.handleCharacterDetailEquipTooltipEvent);
  el('character-partner-switch-search').addEventListener('input', render);
  el('character-partner-switch-save').addEventListener('click', () => { void save(); });
};
