import { app } from './shared.js';

const { dom } = app;
const { layout, sidebarToggle, sidebar, sidebarLinks, dashboardPages, dashboardMain, logoutButton, databaseTabButtons, databaseTabPanels } = dom;
const databaseMenuGroups = Array.from(document.querySelectorAll('[data-database-menu-group]'));

app.closeSidebar = () => {
  if (!layout || !sidebarToggle || !sidebar) {
    return;
  }

  layout.classList.remove('is-sidebar-open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
};

app.setActiveDashboardPage = (pageKey) => {
  let matched = false;
  const serverManagementAvailable = app.state.serverManagementEnabled;
  const isAvailablePage = (key) => key !== 'server-management' || serverManagementAvailable;

  sidebarLinks.forEach((link) => {
    const isActive = isAvailablePage(link.dataset.dashboardPage) && link.dataset.dashboardPage === pageKey;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      matched = true;
    }
  });

  dashboardPages.forEach((page) => {
    const isActive = isAvailablePage(page.dataset.dashboardPanel) && page.dataset.dashboardPanel === pageKey;
    page.classList.toggle('is-active', isActive);
    page.hidden = !isActive;
  });

  const availableLinks = sidebarLinks.filter((link) => isAvailablePage(link.dataset.dashboardPage));
  if (!matched && availableLinks.length > 0) {
    const fallbackPage = availableLinks[0].dataset.dashboardPage;
    if (fallbackPage && fallbackPage !== pageKey) {
      app.setActiveDashboardPage(fallbackPage);
      return;
    }
  }

  app.refreshHealthPolling?.();
};

app.setServerManagementEnabled = (enabled) => {
  const serverLink = sidebarLinks.find((link) => link.dataset.dashboardPage === 'server-management');
  const serverPage = dashboardPages.find((page) => page.dataset.dashboardPanel === 'server-management');

  if (serverLink) {
    serverLink.hidden = !enabled;
  }
  if (serverPage) {
    serverPage.hidden = !enabled;
  }
  app.updatePlayerMutationRiskResetVisibility();
};

app.focusContentStart = () => {
  if (!dashboardMain) {
    return;
  }

  dashboardMain.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (typeof dashboardMain.focus === 'function') {
    dashboardMain.focus({ preventScroll: true });
  }
};

app.setActiveDatabaseTab = (tabId) => {
  let matched = false;

  databaseTabButtons.forEach((button) => {
    const isActive = button.dataset.databaseTab === tabId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      matched = true;
    }
  });

  databaseMenuGroups.forEach((group) => {
    const trigger = group.querySelector('.database-subnav-group-trigger');
    const hasActiveTab = Boolean(group.querySelector('.database-subnav-menu-item.is-active'));
    trigger?.classList.toggle('is-active', hasActiveTab);
  });

  databaseTabPanels.forEach((panel) => {
    const isActive = panel.dataset.databaseTabPanel === tabId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  if (!matched && databaseTabButtons.length > 0) {
    const fallback = databaseTabButtons[0].dataset.databaseTab;
    if (fallback && fallback !== tabId) {
      app.setActiveDatabaseTab(fallback);
      return;
    }
  }

  app.refreshHealthPolling?.();
};

app.initNavigation = () => {
  if (sidebarToggle && layout && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      const isOpen = layout.classList.toggle('is-sidebar-open');
      sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    });

    sidebarLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = event.currentTarget;
        const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') : null;
        const pageKey = target instanceof HTMLElement ? target.dataset.dashboardPage : null;

        if (pageKey) {
          event.preventDefault();
          app.setActiveDashboardPage(pageKey);
          app.closeSidebar();
          app.focusContentStart();
          return;
        }

        if (href?.startsWith('#')) {
          event.preventDefault();
          app.closeSidebar();
          app.focusContentStart();
          return;
        }

        app.closeSidebar();
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      app.openLogoutConfirmModal();
    });
  }

  databaseTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button instanceof HTMLButtonElement && button.disabled) {
        return;
      }

      const tabId = button.dataset.databaseTab;
      if (!tabId) {
        return;
      }

      app.setActiveDatabaseTab(tabId);
      databaseMenuGroups.forEach((group) => {
        group.classList.remove('is-open');
        group.querySelector('.database-subnav-group-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (tabId === 'database-accounts-section' && app.isDatabaseHealthy()) {
        void app.loadDatabaseAccounts(app.state.accountsCurrentPage);
        return;
      }

      if (tabId === 'database-player-profile-section' && app.canAccessPlayerProfile()) {
        void app.loadSelectedPlayerProfile();
        return;
      }

      if (tabId === 'database-character-management-section' && app.canAccessCharacterManagement()) {
        app.updateCharacterManagementAccess();
        void app.loadSelectedAccountCharacters(app.state.characterManagementCurrentPage);
        return;
      }

      if (tabId === 'database-equip-management-section' && app.canAccessWeaponManagement()) {
        app.updateWeaponManagementAccess();
        void app.loadSelectedAccountWeapons(app.state.weaponManagementCurrentPage);
        return;
      }

      if (tabId === 'database-memory-management-section' && app.canAccessMemoryManagement()) {
        app.updateMemoryManagementAccess();
        void app.loadSelectedAccountMemories(app.state.memoryManagementCurrentPage);
        return;
      }

      if (tabId === 'database-item-management-section' && app.canAccessItemManagement()) {
        app.updateItemManagementAccess();
        void app.loadSelectedAccountItems(app.state.itemManagementCurrentPage);
        return;
      }

      if (tabId === 'database-stage-management-section' && app.canAccessStageManagement()) {
        app.updateStageManagementAccess();
        void app.loadSelectedAccountStages(app.state.stageManagementCurrentPage);
      }
    });
  });

  databaseMenuGroups.forEach((group) => {
    const trigger = group.querySelector('.database-subnav-group-trigger');
    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }

    trigger.addEventListener('click', () => {
      const willOpen = !group.classList.contains('is-open');
      databaseMenuGroups.forEach((otherGroup) => {
        otherGroup.classList.remove('is-open');
        const otherTrigger = otherGroup.querySelector('.database-subnav-group-trigger');
        otherTrigger?.setAttribute('aria-expanded', 'false');
      });
      group.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
  });

  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && databaseMenuGroups.some((group) => group.contains(event.target))) {
      return;
    }

    databaseMenuGroups.forEach((group) => {
      group.classList.remove('is-open');
      group.querySelector('.database-subnav-group-trigger')?.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    const openGroup = databaseMenuGroups.find((group) => group.classList.contains('is-open'));
    if (!openGroup) {
      return;
    }

    openGroup.classList.remove('is-open');
    const trigger = openGroup.querySelector('.database-subnav-group-trigger');
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.focus();
  });
};
