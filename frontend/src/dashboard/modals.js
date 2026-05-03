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
    controlModalEyebrow.textContent = '提示';
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
    title = '操作提示',
    eyebrow = '提示',
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

app.openSuccessModal = (message, title = '操作成功') => {
  app.openControlModal(message, {
    title,
    eyebrow: '操作成功',
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
    logoutButton.textContent = '退出登录';
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
    logoutButton.textContent = '正在退出...';
  }

  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    window.location.assign('/login');
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
};
