import { app } from '../../shared.js';

const { state } = app;
const el = (id) => document.getElementById(id);
const modal = el('partner-detail-modal');
const qualityModal = el('partner-quality-modal');
const switchModal = el('partner-skill-switch-modal');
const detail = { generation: 0, uid: null, recordId: null, data: null, pending: false, trigger: null, sort: 'name', order: 'asc' };
const t = (key, params) => app.translate(`dashboard.${key}`, params);
const escape = app.escapeHtml;
const numberKeys = (map) => Object.keys(map ?? {}).map(Number).sort((a, b) => a - b);
const stat = (current, max, cls = '') => app.renderCompositeStatValue({ currentValue: current, maxValue: max, currentClass: cls });
const editable = (field, value, max, skillId = '') => `<span class="equip-detail-stat-value is-editable" tabindex="0" role="button" data-partner-edit="${field}" data-skill-id="${skillId}" data-current="${value}" data-max="${max}">${stat(value, max, field === 'breakthrough' ? `equip-detail-bt-tier-${value}` : '')}</span>`;

const render = () => {
  const data = detail.data;
  if (!data) return;
  const record = data.record;
  const entry = state.partnerEntriesMap[record.TemplateId] ?? {};
  const stars = data.star_schedule_options_map[record.Quality] ?? [];
  const star = record.Quality < 6
    ? Math.max(0, stars.reduce((found, threshold, index) => record.StarSchedule >= threshold ? index : found, 0))
    : 0;
  const card = el('partner-detail-card');
  card.dataset.quality = record.Quality;
  card.dataset.btTier = record.BreakThrough;
  el('partner-detail-icon').src = entry.Icon ? `.${entry.Icon}` : '';
  el('partner-detail-icon').alt = entry.Name ?? '';
  el('partner-detail-name').textContent = entry.Name ?? '--';
  const quality = el('partner-detail-quality');
  quality.className = `partner-detail-quality character-quality ${app.getCharacterQualityClass(record.Quality)}`;
  quality.textContent = app.getCharacterQualityDisplayLabel(record.Quality, star);
  quality.disabled = detail.pending || !stars.length;
  el('partner-detail-description').textContent = app.stripMarkupText(entry.Desc ?? '');
  const limits = data.breakthrough_level_limit_map;
  const exp = data.level_exp_map[record.BreakThrough]?.[record.Level] ?? 0;
  const active = data.skills.find((skill) => skill.Type === 1);
  const passive = data.skills.filter((skill) => skill.Type === 2);
  const capacity = data.quality_entries_map[record.Quality]?.SkillColumnCount ?? 0;
  const enabled = passive.filter((skill) => skill.IsWear).length;
  el('partner-detail-content').innerHTML = `
    <div class="equip-detail-section"><div class="equip-detail-section-title"><span>${t('equipDetailEnhancementLabel')}</span></div>
      <div class="equip-detail-enhancement">
        <div class="equip-detail-stat"><span class="equip-detail-stat-label">${t('equipDetailBreakthrough')}</span>${editable('breakthrough', record.BreakThrough, Math.max(...numberKeys(limits)))}</div>
        <div class="equip-detail-stat"><span class="equip-detail-stat-label">${t('equipDetailLevel')}</span>${editable('level', record.Level, limits[record.BreakThrough] ?? 0)}</div>
        <div class="equip-detail-stat"><span class="equip-detail-stat-label">${t('equipDetailExp')}</span><span class="equip-detail-stat-value is-editable" tabindex="0" role="button" data-partner-edit="exp" data-current="${record.Exp}" data-max="${Math.max(0, exp - (record.Level === limits[record.BreakThrough] ? 0 : 1))}">${record.Exp} / ${exp}</span></div>
      </div>
    </div>
    <div class="equip-detail-section"><div class="equip-detail-section-title"><span>${t('partnerActiveSkills')}</span></div>
      <div class="weapon-detail-skill-panel"><div class="partner-active-heading"><div class="weapon-detail-skill-name">${escape(active?.Name ?? '--')} ${active ? `<span class="partner-active-level">(${editable('skill', active.Level, active.MaxLevel, active.skill_id)})</span>` : ''}</div><button type="button" class="status-action-button status-action-button-config" id="partner-switch-open">${t('partnerSwitch')}</button></div><div class="weapon-detail-skill-description">${escape(app.stripMarkupText(active?.Desc ?? ''))}</div></div>
    </div>
    <div class="equip-detail-section"><div class="equip-detail-section-title"><span>${t('partnerPassiveSkills')} (${enabled} / ${capacity})</span></div>
      <table class="accounts-table partner-passive-table"><thead><tr><th>${t('partnerSkillName')}</th><th>${t('equipDetailLevel')}</th><th>${t('partnerEnabled')}</th></tr></thead><tbody>${passive.map((skill) => `<tr><td><span tabindex="0" data-partner-skill-description="${escape(app.stripMarkupText(skill.Desc ?? ''))}">${escape(skill.Name ?? String(skill.skill_id))}</span></td><td>${editable('skill', skill.Level, skill.MaxLevel, skill.skill_id)}</td><td><label class="equip-detail-awake-toggle"><input type="checkbox" class="equip-detail-awake-checkbox" data-partner-passive="${skill.skill_id}" aria-label="${escape(skill.Name ?? '')}" ${skill.IsWear ? 'checked' : ''} ${!skill.IsWear && enabled >= capacity ? 'disabled' : ''}><span aria-hidden="true">${skill.IsWear ? '✓' : ''}</span></label></td></tr>`).join('')}</tbody></table>
    </div>`;
  if (detail.pending) card.querySelectorAll('button, input').forEach((control) => { control.disabled = true; });
};

const closeChild = (child) => {
  child.hidden = true;
  hideTooltip();
  app.setBodyModalOpen(!modal.hidden);
  if (!modal.hidden) el('partner-detail-card').focus();
};
app.closePartnerDetailModal = () => {
  const wasOpen = !modal.hidden || !qualityModal.hidden || !switchModal.hidden;
  detail.generation += 1;
  modal.hidden = true;
  qualityModal.hidden = true;
  switchModal.hidden = true;
  detail.data = null;
  detail.pending = false;
  hideTooltip();
  if (wasOpen) {
    app.setBodyModalOpen(['character-detail-modal', 'character-partner-switch-modal'].some((id) => el(id) && !el(id).hidden));
    if (detail.trigger?.isConnected) detail.trigger.focus();
    else if (el('character-partner-switch-modal') && !el('character-partner-switch-modal').hidden) el('character-partner-switch-search').focus();
  }
};
app.handlePartnerDetailEscape = () => {
  if (!switchModal.hidden) { closeChild(switchModal); return true; }
  if (!qualityModal.hidden) { closeChild(qualityModal); return true; }
  if (!modal.hidden) { app.closePartnerDetailModal(); return true; }
  return false;
};
app.openPartnerDetailModal = async (recordId, trigger) => {
  if (!app.canAccessPartnerManagement()) return;
  detail.uid = state.selectedAccountUid;
  detail.recordId = recordId;
  detail.trigger = trigger;
  detail.data = null;
  detail.pending = false;
  const generation = ++detail.generation;
  modal.hidden = false;
  el('partner-detail-name').textContent = app.translate('common.loading');
  el('partner-detail-quality').disabled = true;
  el('partner-detail-quality').textContent = '';
  el('partner-detail-icon').removeAttribute('src');
  el('partner-detail-description').textContent = '';
  delete el('partner-detail-card').dataset.quality;
  el('partner-detail-content').innerHTML = '';
  app.setBodyModalOpen(true);
  el('partner-detail-card').focus();
  try {
    const data = await app.apiFetch(`/api/database-partners/selected/${recordId}/extra-info`);
    if (generation !== detail.generation || detail.uid !== state.selectedAccountUid) return;
    detail.data = data;
    render();
  } catch (error) {
    if (generation !== detail.generation) return;
    app.closePartnerDetailModal();
    app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.partnerFailed'));
  }
};

const mutate = async (action, payload) => {
  if (detail.pending || !detail.data || detail.uid !== state.selectedAccountUid || !app.canAccessPartnerManagement()) return false;
  const generation = detail.generation;
  const uid = detail.uid;
  const recordId = detail.recordId;
  detail.pending = true;
  render();
  document.querySelectorAll('#partner-quality-modal button, #partner-quality-modal select, #partner-skill-switch-modal button').forEach((control) => { control.disabled = true; });
  try {
    const data = await app.apiFetch(`/api/database-partners/selected/${recordId}/${action}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (generation !== detail.generation || uid !== state.selectedAccountUid) return false;
    detail.data = data;
    await app.loadSelectedAccountPartners();
    if (generation === detail.generation && uid === state.selectedAccountUid) await app.refreshCharacterPartnerEquipment?.();
    return generation === detail.generation && uid === state.selectedAccountUid;
  } catch (error) {
    if (generation === detail.generation && !app.isMutationRiskCancelled(error)) app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.partnerFailed'));
    return false;
  } finally {
    if (generation === detail.generation) {
      detail.pending = false;
      render();
      document.querySelectorAll('#partner-quality-modal button, #partner-quality-modal select, #partner-skill-switch-modal button').forEach((control) => { control.disabled = false; });
      if (!qualityModal.hidden) syncStars();
      if (!switchModal.hidden) renderSwitch();
    }
  }
};

const edit = (target) => {
  if (detail.pending || target.querySelector('input')) return;
  const field = target.dataset.partnerEdit;
  const skillId = Number(target.dataset.skillId);
  const min = field === 'level' || field === 'skill' ? 1 : 0;
  const max = Number(target.dataset.max);
  if (max < min) return;
  const input = document.createElement('input');
  input.type = 'text'; input.inputMode = 'numeric'; input.className = 'equip-detail-inline-input'; input.value = target.dataset.current;
  target.classList.add('is-editing');
  target.innerHTML = ''; target.appendChild(input); input.focus(); input.select();
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); render(); }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!/^\d+$/.test(input.value.trim()) || !Number.isSafeInteger(Number(input.value)) || Number(input.value) < min || Number(input.value) > max) {
      app.openNoticeModal(t('partnerRangeInvalid', { min, max })); return;
    }
    void mutate(field === 'skill' ? 'skill-level' : 'enhance', field === 'skill' ? { skill_id: skillId, value: Number(input.value) } : { field, value: Number(input.value) });
  });
  input.addEventListener('blur', () => { if (!detail.pending && !modal.hidden) render(); });
};

const syncStars = () => {
  const quality = Number(el('partner-quality-select').value);
  const options = detail.data.star_schedule_options_map[quality] ?? [];
  const selected = Number(el('partner-star-select').value) || 0;
  el('partner-star-select').innerHTML = options.map((_, index) => `<option value="${index}">${index}</option>`).join('');
  el('partner-star-select').value = String(Math.min(selected, options.length - 1));
  el('partner-star-select').disabled = options.length <= 1 || detail.pending;
  el('partner-quality-select').className = `character-quality-edit-select ${app.getCharacterQualityClass(quality)}`;
};

const renderSwitch = () => {
  const pid = detail.data.record.TemplateId;
  const groups = state.partnerMainSkillGroupIdsMap[pid] ?? [];
  const keyword = el('partner-switch-search').value.trim().toLowerCase();
  const rows = [...new Map((state.partnerEntriesMap[pid]?.RecommendElement ?? []).flatMap((element) => state.partnerElementSkillEntiersMap[element] ?? [])
    .filter((row) => groups.includes(row.skill_group_id)).map((row) => [row.skill_id, row])).values()]
    .filter((row) => [row.name, app.stripMarkupText(row.Desc)].some((value) => String(value).toLowerCase().includes(keyword)))
    .sort((a, b) => (String(a[detail.sort]).localeCompare(String(b[detail.sort]), state.locale) || a.skill_id - b.skill_id) * (detail.order === 'asc' ? 1 : -1));
  const current = detail.data.skills.find((skill) => skill.Type === 1)?.skill_id;
  el('partner-switch-body').innerHTML = rows.map((row) => `<tr><td>${escape(row.name)}</td><td><span class="partner-add-description" tabindex="0" data-partner-skill-description="${escape(app.stripMarkupText(row.Desc))}">${escape(app.stripMarkupText(row.Desc))}</span></td><td><button type="button" class="status-action-button status-action-button-config" data-partner-use="${row.skill_id}" ${current === row.skill_id || detail.pending ? 'disabled' : ''}>${t(current === row.skill_id ? 'partnerInUse' : 'partnerUse')}</button></td></tr>`).join('');
  el('partner-switch-empty').hidden = rows.length > 0;
  switchModal.querySelectorAll('[data-partner-switch-sort]').forEach((button) => {
    const arrow = button.querySelector('.column-sort-arrow'); arrow.hidden = button.dataset.partnerSwitchSort !== detail.sort; arrow.classList.toggle('desc', detail.order === 'desc');
  });
};

let tooltipTimer;
const hideTooltip = () => { window.clearTimeout(tooltipTimer); const tip = el('partner-skill-tooltip'); if (tip) tip.hidden = true; };
const showTooltip = (target) => {
  hideTooltip();
  tooltipTimer = window.setTimeout(() => {
    if (!target.isConnected) return;
    const tip = el('partner-skill-tooltip'); tip.textContent = target.dataset.partnerSkillDescription; tip.hidden = false;
    const rect = target.getBoundingClientRect(); const size = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - size.width - 12))}px`;
    tip.style.top = `${Math.max(12, rect.bottom + size.height + 8 < window.innerHeight ? rect.bottom + 8 : rect.top - size.height - 8)}px`;
  }, 180);
};

export const initPartnerDetailFeature = () => {
  const tip = document.createElement('div'); tip.id = 'partner-skill-tooltip'; tip.className = 'equip-detail-tooltip partner-description-tooltip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  document.querySelectorAll('[data-partner-detail-close]').forEach((target) => target.addEventListener('click', app.closePartnerDetailModal));
  document.querySelectorAll('[data-partner-quality-close]').forEach((target) => target.addEventListener('click', () => closeChild(qualityModal)));
  document.querySelectorAll('[data-partner-switch-close]').forEach((target) => target.addEventListener('click', () => closeChild(switchModal)));
  modal.addEventListener('click', (event) => {
    const target = event.target.closest('[data-partner-edit]'); if (target) edit(target);
    if (event.target.closest('#partner-switch-open') && !detail.pending) { detail.sort = 'name'; detail.order = 'asc'; el('partner-switch-search').value = ''; renderSwitch(); switchModal.hidden = false; app.setBodyModalOpen(true); el('partner-switch-search').focus(); }
  });
  modal.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-partner-edit]')) { event.preventDefault(); edit(event.target); } });
  modal.addEventListener('change', (event) => { const target = event.target.closest('[data-partner-passive]'); if (target) void mutate('passive', { skill_id: Number(target.dataset.partnerPassive), enabled: target.checked }); });
  el('partner-detail-quality').addEventListener('click', () => {
    if (!detail.data || detail.pending) return;
    el('partner-quality-select').innerHTML = numberKeys(detail.data.quality_entries_map).map((quality) => `<option value="${quality}">${escape(app.getCharacterQualityLabel(quality))}</option>`).join('');
    el('partner-quality-select').value = detail.data.record.Quality;
    syncStars();
    const options = detail.data.star_schedule_options_map[detail.data.record.Quality] ?? [];
    el('partner-star-select').value = Math.max(0, options.reduce((found, threshold, index) => detail.data.record.StarSchedule >= threshold ? index : found, 0));
    qualityModal.hidden = false; app.setBodyModalOpen(true); el('partner-quality-select').focus();
  });
  el('partner-quality-select').addEventListener('change', syncStars);
  el('partner-quality-confirm').addEventListener('click', async () => { if (await mutate('quality', { quality: Number(el('partner-quality-select').value), star: Number(el('partner-star-select').value) })) closeChild(qualityModal); });
  el('partner-switch-search').addEventListener('input', renderSwitch);
  switchModal.addEventListener('click', async (event) => {
    const sort = event.target.closest('[data-partner-switch-sort]');
    if (sort) { detail.order = detail.sort === sort.dataset.partnerSwitchSort && detail.order === 'asc' ? 'desc' : 'asc'; detail.sort = sort.dataset.partnerSwitchSort; renderSwitch(); }
    const use = event.target.closest('[data-partner-use]');
    if (use && !use.disabled && await mutate('main-skill', { skill_id: Number(use.dataset.partnerUse) })) closeChild(switchModal);
  });
  for (const root of [modal, switchModal]) {
    for (const type of ['mouseover', 'focusin']) root.addEventListener(type, (event) => { const target = event.target.closest('[data-partner-skill-description]'); if (target) showTooltip(target); });
    for (const type of ['mouseout', 'focusout']) root.addEventListener(type, hideTooltip);
  }
  window.addEventListener('scroll', hideTooltip, true); window.addEventListener('resize', hideTooltip);
};
