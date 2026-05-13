import { apiFetch, getLocalizedApiErrorMessage, initI18n, subscribeLocaleChange, t } from './i18n.js';

const form = document.querySelector('.login-form');

const renderLoginStaticState = () => {
  const title = document.querySelector('title');
  if (title) {
    title.textContent = t('common.appName');
  }
};

initI18n(document, renderLoginStaticState);
subscribeLocaleChange(renderLoginStaticState);
renderLoginStaticState();

if (form) {
  const hint = form.querySelector('.hint');
  const card = document.querySelector('.login-card');
  const noticeModal = document.querySelector('#notice-modal');
  const noticeModalMessage = document.querySelector('#notice-modal-message');
  const noticeModalCloseTargets = document.querySelectorAll('[data-notice-modal-close]');

  let lastFocusedElement = null;

  const closeNoticeModal = () => {
    if (!noticeModal || noticeModal.hidden) {
      return;
    }

    noticeModal.hidden = true;
    document.body.classList.remove('shared-modal-open');

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  const openNoticeModal = (message) => {
    if (!noticeModal || !noticeModalMessage) {
      return;
    }

    if (hint) {
      hint.textContent = '';
    }

    lastFocusedElement = document.activeElement;
    noticeModalMessage.textContent = message;
    noticeModal.hidden = false;
    document.body.classList.add('shared-modal-open');

    const primaryButton = noticeModal.querySelector('.shared-modal-button');
    if (primaryButton instanceof HTMLElement) {
      primaryButton.focus();
    }
  };

  const applyTilt = (event) => {
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * 10;
    const rotateY = (x - 0.5) * 12;

    card.style.setProperty('--tilt-x', `${rotateX}deg`);
    card.style.setProperty('--tilt-y', `${rotateY}deg`);
    card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  };

  const resetTilt = () => {
    if (!card) {
      return;
    }

    card.style.transform = '';
  };

  if (card) {
    card.addEventListener('mousemove', applyTilt);
    card.addEventListener('mouseleave', resetTilt);
  }

  noticeModalCloseTargets.forEach((target) => {
    target.addEventListener('click', closeNoticeModal);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNoticeModal();
    }
  });

  const accentFields = form.querySelectorAll('input');
  accentFields.forEach((field) => {
    field.addEventListener('focus', () => {
      form.setAttribute('data-focused', field.name);
    });

    field.addEventListener('blur', () => {
      form.removeAttribute('data-focused');
    });
  });

  form.addEventListener('submit', (event) => {
    const button = form.querySelector('button');
    event.preventDefault();

    const usernameInput = form.querySelector('input[name="username"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const username = usernameInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';

    if (!username || !password) {
      if (hint) {
        hint.textContent = t('login.emptyFields');
      }
      return;
    }

    if (hint) {
      hint.textContent = '';
    }

    if (button) {
      button.disabled = true;
      button.textContent = t('login.submitting');
    }
    if (hint) {
      hint.textContent = t('login.authenticating');
    }

    apiFetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
      .then(() => {
        window.location.assign('/');
      })
      .catch((error) => {
        if (button) {
          button.disabled = false;
          button.textContent = t('login.submit');
        }

        openNoticeModal(getLocalizedApiErrorMessage(error, undefined, 'login.invalidCredentials'));
      });
  });
}

apiFetch('/api/session')
  .then(async (response) => {
    return response;
  })
  .then((session) => {
    if (session?.authenticated && window.location.pathname === '/login') {
      window.location.assign('/');
    }
  })
  .catch(() => null);
