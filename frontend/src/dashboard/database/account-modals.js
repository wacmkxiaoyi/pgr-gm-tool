import { app } from '../shared.js';

const { dom, state } = app;
const {
  accountDeleteModal,
  accountDeleteMessage,
  accountDeleteCloseTargets,
  accountDeleteConfirmButton,
  accountPasswordModal,
  accountPasswordTarget,
  accountPasswordInput,
  accountPasswordConfirmInput,
  accountPasswordFeedback,
  accountPasswordCloseTargets,
  accountPasswordConfirmButton,
} = dom;

app.setAccountPasswordFeedback = (message, tone = '') => {
  if (!(accountPasswordFeedback instanceof HTMLElement)) {
    return;
  }

  accountPasswordFeedback.textContent = message;
  accountPasswordFeedback.className = 'account-password-feedback';
  if (tone) {
    accountPasswordFeedback.classList.add(tone);
  }
};

app.resetAccountPasswordForm = () => {
  if (accountPasswordInput instanceof HTMLInputElement) {
    accountPasswordInput.value = '';
  }
  if (accountPasswordConfirmInput instanceof HTMLInputElement) {
    accountPasswordConfirmInput.value = '';
  }
  app.setAccountPasswordFeedback(app.translate('runtime.accountPasswordDefaultFeedback'));
};

app.closeAccountPasswordModal = () => {
  state.pendingPasswordAccount = null;
  app.resetAccountPasswordForm();
  if (!(accountPasswordModal instanceof HTMLElement) || accountPasswordModal.hidden) {
    return;
  }

  accountPasswordModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastPasswordTrigger instanceof HTMLElement) {
    state.lastPasswordTrigger.focus();
  }
};

app.openAccountPasswordModal = (account, trigger) => {
  if (!(accountPasswordModal instanceof HTMLElement)) {
    return;
  }

  state.pendingPasswordAccount = account;
  state.lastPasswordTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  if (accountPasswordTarget instanceof HTMLElement) {
    const username = typeof account?.username === 'string' && account.username ? account.username : app.translate('common.notAvailable');
    accountPasswordTarget.textContent = app.translate('runtime.accountPasswordTarget', {
      uid: account.uid ?? app.translate('common.notAvailable'),
      username,
    });
  }
  app.resetAccountPasswordForm();
  accountPasswordModal.hidden = false;
  app.setBodyModalOpen(true);

  if (accountPasswordInput instanceof HTMLInputElement) {
    accountPasswordInput.focus();
  }
};

app.getAccountPasswordValidationMessage = () => {
  const password = accountPasswordInput instanceof HTMLInputElement ? accountPasswordInput.value : '';
  const confirmPassword = accountPasswordConfirmInput instanceof HTMLInputElement ? accountPasswordConfirmInput.value : '';

  if (password.length < 6) {
    return { valid: false, message: app.translate('runtime.accountPasswordTooShort') };
  }

  if (password !== confirmPassword) {
    return { valid: false, message: app.translate('runtime.accountPasswordMismatch') };
  }

  return { valid: true, message: app.translate('runtime.accountPasswordValid') };
};

app.updateAccountPasswordValidationState = () => {
  const validation = app.getAccountPasswordValidationMessage();
  app.setAccountPasswordFeedback(validation.message, validation.valid ? 'is-valid' : 'is-error');
  return validation.valid;
};

app.submitAccountPasswordReset = async () => {
  if (!state.pendingPasswordAccount || !(accountPasswordConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  const valid = app.updateAccountPasswordValidationState();
  if (!valid) {
    return;
  }

  const targetUid = state.pendingPasswordAccount.uid;
  const password = accountPasswordInput instanceof HTMLInputElement ? accountPasswordInput.value : '';
  accountPasswordConfirmButton.disabled = true;

  try {
    await app.apiFetch('/api/database-accounts/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: state.pendingPasswordAccount.uid, password }),
    });

    app.closeAccountPasswordModal();
    app.openSuccessModal(app.translate('runtime.accountPasswordResetSuccess', { uid: targetUid }), app.translate('runtime.accountPasswordResetSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.setAccountPasswordFeedback(app.apiErrorMessage(error, 'runtime.accountPasswordResetFailed'), 'is-error');
  } finally {
    accountPasswordConfirmButton.disabled = false;
  }
};

app.closeAccountDeleteModal = () => {
  state.pendingDeleteAccount = null;
  if (!(accountDeleteModal instanceof HTMLElement) || accountDeleteModal.hidden) {
    return;
  }

  accountDeleteModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastAccountDeleteTrigger instanceof HTMLElement) {
    state.lastAccountDeleteTrigger.focus();
  }
};

app.openAccountDeleteModal = (account, trigger) => {
  if (!(accountDeleteModal instanceof HTMLElement) || !(accountDeleteMessage instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteAccount = account;
  state.lastAccountDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  const username = typeof account?.username === 'string' && account.username ? account.username : app.translate('common.notAvailable');
  accountDeleteMessage.textContent = app.translate('runtime.accountDeleteConfirm', {
    uid: account.uid ?? app.translate('common.notAvailable'),
    username,
  });
  accountDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (accountDeleteConfirmButton instanceof HTMLButtonElement) {
    accountDeleteConfirmButton.focus();
  }
};

app.removeAccountRow = (uid) => {
  if (!(dom.databaseAccountsBody instanceof HTMLElement)) {
    return;
  }

  const row = dom.databaseAccountsBody.querySelector(`button[data-account-action="select"][data-account-uid="${uid}"]`)?.closest('tr');
  if (row instanceof HTMLElement) {
    row.remove();
  }

  const remainingRows = dom.databaseAccountsBody.querySelectorAll('tr').length;
  if (remainingRows === 0) {
    app.setAccountsState(app.translate('runtime.accountDeleteRemainingEmpty'), 'is-empty');
  }

  app.updateAccountSelectionUi();
};

app.confirmDeleteAccount = async () => {
  if (!state.pendingDeleteAccount || !(accountDeleteConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  const account = state.pendingDeleteAccount;
  const targetUid = account.uid;
  accountDeleteConfirmButton.disabled = true;

  try {
    if (app.normalizeAccountUid(account.uid) === state.selectedAccountUid) {
      await app.clearSelectedAccount();
    }

    await app.apiFetch(`/api/database-accounts/${targetUid}`, {
      method: 'DELETE',
    });

    app.removeAccountRow(account.uid);
    app.closeAccountDeleteModal();
    app.openSuccessModal(app.translate('runtime.accountDeleteSuccess', { uid: targetUid }), app.translate('runtime.accountDeleteSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.closeAccountDeleteModal();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.accountDeleteFailed'));
  } finally {
    accountDeleteConfirmButton.disabled = false;
  }
};

export const initDatabaseAccountModalFeature = () => {
  accountDeleteCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeAccountDeleteModal);
  });

  accountPasswordCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeAccountPasswordModal);
  });

  if (accountDeleteConfirmButton instanceof HTMLButtonElement) {
    accountDeleteConfirmButton.addEventListener('click', () => {
      void app.confirmDeleteAccount();
    });
  }

  if (accountPasswordConfirmButton instanceof HTMLButtonElement) {
    accountPasswordConfirmButton.addEventListener('click', () => {
      void app.submitAccountPasswordReset();
    });
  }

  if (accountPasswordInput instanceof HTMLInputElement) {
    accountPasswordInput.addEventListener('input', app.updateAccountPasswordValidationState);
  }

  if (accountPasswordConfirmInput instanceof HTMLInputElement) {
    accountPasswordConfirmInput.addEventListener('input', app.updateAccountPasswordValidationState);
  }
};
