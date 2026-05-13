import { app } from './shared.js';

const { dom, state } = app;
const {
  noticeModal,
  noticeModalMessage,
  noticeModalIcon,
  noticeModalEyebrow,
  noticeModalCloseTargets,
  logoutConfirmModal,
  logoutConfirmCloseTargets,
  logoutConfirmSubmitButton,
  logoutButton,
  playerMutationRiskModal,
  playerMutationRiskDontShow,
  playerMutationRiskConfirmButton,
  playerMutationRiskCloseTargets,
  playerMutationRiskResetButton,
} = dom;

app.closeNoticeModal = () => {
  if (!noticeModal || noticeModal.hidden) {
    return;
  }

  noticeModal.hidden = true;
  app.setBodyModalOpen(false);

  if (noticeModalIcon instanceof HTMLElement) {
    noticeModalIcon.textContent = '!';
    noticeModalIcon.classList.remove('is-success');
  }

  if (noticeModalEyebrow instanceof HTMLElement) {
    noticeModalEyebrow.textContent = app.translate('dashboard.modalEyebrowDefault');
    noticeModalEyebrow.classList.remove('is-success');
  }

  if (state.lastNoticeTrigger instanceof HTMLElement) {
    state.lastNoticeTrigger.focus();
  }
};

app.openNoticeModal = (message, options = {}) => {
  if (!noticeModal || !noticeModalMessage) {
    return;
  }

  const titleElement = noticeModal.querySelector('#notice-modal-title');
  const {
    title = app.translate('dashboard.modalTitleDefault'),
    eyebrow = app.translate('dashboard.modalEyebrowDefault'),
    icon = '!',
    tone = 'default',
  } = options;

  state.lastNoticeTrigger = document.activeElement;
  if (titleElement instanceof HTMLElement) {
    titleElement.textContent = title;
  }
  if (noticeModalIcon instanceof HTMLElement) {
    noticeModalIcon.textContent = icon;
    noticeModalIcon.classList.toggle('is-success', tone === 'success');
  }
  if (noticeModalEyebrow instanceof HTMLElement) {
    noticeModalEyebrow.textContent = eyebrow;
    noticeModalEyebrow.classList.toggle('is-success', tone === 'success');
  }
  noticeModalMessage.textContent = message;
  noticeModal.hidden = false;
  app.setBodyModalOpen(true);

  const primaryButton = noticeModal.querySelector('.shared-modal-button');
  if (primaryButton instanceof HTMLElement) {
    primaryButton.focus();
  }
};

app.openSuccessModal = (message, title = app.translate('dashboard.modalSuccessTitle')) => {
  app.openNoticeModal(message, {
    title,
    eyebrow: app.translate('dashboard.modalSuccessEyebrow'),
    icon: '✓',
    tone: 'success',
  });
};

app.closeLogoutConfirmModal = () => {
  if (!(logoutConfirmModal instanceof HTMLElement) || logoutConfirmModal.hidden) {
    return;
  }

  logoutConfirmModal.hidden = true;
  app.setBodyModalOpen(false);

  if (logoutButton instanceof HTMLButtonElement) {
    logoutButton.disabled = false;
    logoutButton.textContent = app.translate('dashboard.logout');
  }

  if (state.lastLogoutTrigger instanceof HTMLElement) {
    state.lastLogoutTrigger.focus();
  }
};

app.openLogoutConfirmModal = () => {
  if (!(logoutConfirmModal instanceof HTMLElement)) {
    return;
  }

  state.lastLogoutTrigger = document.activeElement;
  logoutConfirmModal.hidden = false;
  app.setBodyModalOpen(true);

  if (logoutConfirmSubmitButton instanceof HTMLButtonElement) {
    logoutConfirmSubmitButton.focus();
  }
};

app.submitLogout = async () => {
  if (!(logoutConfirmSubmitButton instanceof HTMLButtonElement)) {
    return;
  }

  logoutConfirmSubmitButton.disabled = true;
  if (logoutButton instanceof HTMLButtonElement) {
    logoutButton.disabled = true;
    logoutButton.textContent = app.translate('dashboard.logoutPending');
  }

  try {
    await app.apiFetch('/api/logout', {
      method: 'POST',
    });
  } finally {
    window.location.assign('/login');
  }
};

app.openPlayerMutationRiskModal = () => {
  if (!(playerMutationRiskModal instanceof HTMLElement)) {
    return;
  }

  if (playerMutationRiskDontShow instanceof HTMLInputElement) {
    playerMutationRiskDontShow.checked = false;
  }

  playerMutationRiskModal.hidden = false;
  app.setBodyModalOpen(true);

  if (playerMutationRiskConfirmButton instanceof HTMLButtonElement) {
    playerMutationRiskConfirmButton.focus();
  }
};

app.closePlayerMutationRiskModal = () => {
  if (!(playerMutationRiskModal instanceof HTMLElement) || playerMutationRiskModal.hidden) {
    return;
  }

  playerMutationRiskModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.mutationRiskResolve) {
    state.mutationRiskResolve(false);
    state.mutationRiskResolve = null;
  }
};

app.initSharedModals = () => {
  noticeModalCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeNoticeModal);
  });

  logoutConfirmCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeLogoutConfirmModal);
  });

  if (logoutConfirmSubmitButton instanceof HTMLButtonElement) {
    logoutConfirmSubmitButton.addEventListener('click', () => {
      void app.submitLogout();
    });
  }

  playerMutationRiskCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closePlayerMutationRiskModal);
  });

  if (playerMutationRiskConfirmButton instanceof HTMLButtonElement) {
    playerMutationRiskConfirmButton.addEventListener('click', () => {
      if (playerMutationRiskDontShow instanceof HTMLInputElement && playerMutationRiskDontShow.checked) {
        localStorage.setItem(app.constants.SKIP_MUTATION_RISK_KEY, '1');
      }

      if (playerMutationRiskModal instanceof HTMLElement) {
        playerMutationRiskModal.hidden = true;
      }
      app.setBodyModalOpen(false);

      if (playerMutationRiskResetButton instanceof HTMLElement) {
        playerMutationRiskResetButton.hidden = localStorage.getItem(app.constants.SKIP_MUTATION_RISK_KEY) !== '1';
      }

      if (state.mutationRiskResolve) {
        state.mutationRiskResolve(true);
        state.mutationRiskResolve = null;
      }
    });
  }

  if (playerMutationRiskResetButton instanceof HTMLElement) {
    playerMutationRiskResetButton.hidden = localStorage.getItem(app.constants.SKIP_MUTATION_RISK_KEY) !== '1';
    playerMutationRiskResetButton.addEventListener('click', () => {
      app.resetPlayerMutationRiskSkip();
      app.openSuccessModal(app.translate('runtime.playerEditConfirmRiskResetTip'));
    });
  }
};
