const form = document.querySelector('.login-form');

if (form) {
  const hint = form.querySelector('.hint');
  const card = document.querySelector('.login-card');
  const modal = document.querySelector('.login-modal');
  const modalMessage = document.querySelector('.login-modal-message');
  const modalCloseTargets = document.querySelectorAll('[data-login-modal-close]');

  let lastFocusedElement = null;

  const closeModal = () => {
    if (!modal || modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.body.classList.remove('login-modal-open');

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  const openModal = (message) => {
    if (!modal || !modalMessage) {
      return;
    }

    if (hint) {
      hint.textContent = '';
    }

    lastFocusedElement = document.activeElement;
    modalMessage.textContent = message;
    modal.hidden = false;
    document.body.classList.add('login-modal-open');

    const primaryButton = modal.querySelector('.login-modal-button');
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

  modalCloseTargets.forEach((target) => {
    target.addEventListener('click', closeModal);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
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
        hint.textContent = '请输入账号和密码。';
      }
      return;
    }

    if (hint) {
      hint.textContent = '';
    }

    if (button) {
      button.disabled = true;
      button.textContent = '正在进入后台...';
    }
    if (hint) {
      hint.textContent = '正在验证身份...';
    }

    fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail || '账号或密码错误，请重新输入。');
        }
        return response.json();
      })
      .then(() => {
        window.location.assign('/');
      })
      .catch((error) => {
        if (button) {
          button.disabled = false;
          button.textContent = '登录';
        }

        openModal(error.message);
      });
  });
}

fetch('/api/session', {
  credentials: 'include',
})
  .then(async (response) => {
    if (!response.ok) {
      return null;
    }

    return response.json();
  })
  .then((session) => {
    if (session?.authenticated && window.location.pathname === '/login') {
      window.location.assign('/');
    }
  });
