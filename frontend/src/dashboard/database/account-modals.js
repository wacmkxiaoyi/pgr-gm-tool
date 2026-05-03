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
  app.setAccountPasswordFeedback('密码长度需大于等于 6 位。');
};

app.closeAccountPasswordModal = () => {
  state.pendingPasswordAccount = null;
  app.resetAccountPasswordForm();
  if (!(accountPasswordModal instanceof HTMLElement) || accountPasswordModal.hidden) {
    return;
  }

  accountPasswordModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastPasswordFocusedControl instanceof HTMLElement) {
    state.lastPasswordFocusedControl.focus();
  }
};

app.openAccountPasswordModal = (account, trigger) => {
  if (!(accountPasswordModal instanceof HTMLElement)) {
    return;
  }

  state.pendingPasswordAccount = account;
  state.lastPasswordFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  if (accountPasswordTarget instanceof HTMLElement) {
    const username = typeof account?.username === 'string' && account.username ? account.username : '--';
    accountPasswordTarget.textContent = `目标账户：UID ${account.uid ?? '--'}（用户名 ${username}）`;
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
    return { valid: false, message: '新密码长度必须大于等于 6 位。' };
  }

  if (password !== confirmPassword) {
    return { valid: false, message: '两次输入的密码不一致。' };
  }

  return { valid: true, message: '密码校验通过，可以提交。' };
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
    const response = await fetch('/api/database-accounts/password', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: state.pendingPasswordAccount.uid, password }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '重置密码失败');
    }

    app.closeAccountPasswordModal();
    app.openSuccessModal(`UID ${targetUid} 的密码已重置。`, '密码重置成功');
  } catch (error) {
    app.setAccountPasswordFeedback(error instanceof Error ? error.message : '重置密码失败', 'is-error');
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

  if (state.lastDeleteFocusedControl instanceof HTMLElement) {
    state.lastDeleteFocusedControl.focus();
  }
};

app.openAccountDeleteModal = (account, trigger) => {
  if (!(accountDeleteModal instanceof HTMLElement) || !(accountDeleteMessage instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteAccount = account;
  state.lastDeleteFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  const username = typeof account?.username === 'string' && account.username ? account.username : '--';
  accountDeleteMessage.textContent = `确认删除 UID ${account.uid ?? '--'}（用户名 ${username}）吗？`;
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
    app.setAccountsState('当前页账户已全部移除，重新进入账号管理后可重新加载。', 'is-empty');
  }

  app.updateAccountSelectionUi();
};

app.confirmDeleteAccount = async () => {
  if (!state.pendingDeleteAccount || !(accountDeleteConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  const targetUid = state.pendingDeleteAccount.uid;
  accountDeleteConfirmButton.disabled = true;

  try {
    if (app.normalizeAccountUid(state.pendingDeleteAccount.uid) === state.selectedAccountUid) {
      await app.clearSelectedAccount();
    }

    app.removeAccountRow(state.pendingDeleteAccount.uid);
    app.closeAccountDeleteModal();
    app.openSuccessModal(`UID ${targetUid} 已从当前列表移除。`, '删除完成');
  } catch (error) {
    app.closeAccountDeleteModal();
    app.openControlModal(error instanceof Error ? error.message : '删除账户失败');
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
