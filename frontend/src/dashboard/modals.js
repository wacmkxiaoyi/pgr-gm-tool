import { app } from './shared.js';

const { dom, state } = app;
const {
  controlModal,
  controlModalMessage,
  controlModalIcon,
  controlModalEyebrow,
  controlModalCloseTargets,
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

app.closeControlModal = () => {
  if (!controlModal || controlModal.hidden) {
    return;
  }

  controlModal.hidden = true;
  app.setBodyModalOpen(false);

  if (controlModalIcon instanceof HTMLElement) {
    controlModalIcon.textContent = '!';
    controlModalIcon.classList.remove('is-success');
  }

  if (controlModalEyebrow instanceof HTMLElement) {
    controlModalEyebrow.textContent = app.translate('dashboard.modalEyebrowDefault');
    controlModalEyebrow.classList.remove('is-success');
  }

  if (state.lastFocusedControl instanceof HTMLElement) {
    state.lastFocusedControl.focus();
  }
};

app.openControlModal = (message, options = {}) => {
  if (!controlModal || !controlModalMessage) {
    return;
  }

  const titleElement = controlModal.querySelector('#server-modal-title');
  const {
    title = app.translate('dashboard.modalTitleDefault'),
    eyebrow = app.translate('dashboard.modalEyebrowDefault'),
    icon = '!',
    tone = 'default',
  } = options;

  state.lastFocusedControl = document.activeElement;
  if (titleElement instanceof HTMLElement) {
    titleElement.textContent = title;
  }
  if (controlModalIcon instanceof HTMLElement) {
    controlModalIcon.textContent = icon;
    controlModalIcon.classList.toggle('is-success', tone === 'success');
  }
  if (controlModalEyebrow instanceof HTMLElement) {
    controlModalEyebrow.textContent = eyebrow;
    controlModalEyebrow.classList.toggle('is-success', tone === 'success');
  }
  controlModalMessage.textContent = message;
  controlModal.hidden = false;
  app.setBodyModalOpen(true);

  const primaryButton = controlModal.querySelector('.login-modal-button');
  if (primaryButton instanceof HTMLElement) {
    primaryButton.focus();
  }
};

app.openSuccessModal = (message, title = app.translate('dashboard.modalSuccessTitle')) => {
  app.openControlModal(message, {
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

  if (state.lastLogoutFocusedControl instanceof HTMLElement) {
    state.lastLogoutFocusedControl.focus();
  }
};

app.openLogoutConfirmModal = () => {
  if (!(logoutConfirmModal instanceof HTMLElement)) {
    return;
  }

  state.lastLogoutFocusedControl = document.activeElement;
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
  controlModalCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeControlModal);
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
