(function (global) {
  'use strict';

  if (global.__goAwakeAuditPaginationGuardInstalled) return;
  global.__goAwakeAuditPaginationGuardInstalled = true;

  var PAGINATOR_SELECTOR = [
    '.ui-paginator-first',
    '.ui-paginator-prev',
    '.ui-paginator-page',
    '.ui-paginator-next',
    '.ui-paginator-last',
    '.p-paginator-first',
    '.p-paginator-prev',
    '.p-paginator-page',
    '.p-paginator-next',
    '.p-paginator-last'
  ].join(',');

  function isAuditPage() {
    return global.location.protocol === 'https:' &&
      global.location.hostname === 'www.goawakecloud.com.br' &&
      (
        global.location.pathname.includes('/audit') ||
        global.location.hash.includes('/pages/f/audit')
      );
  }

  function paginatorControl(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest(PAGINATOR_SELECTOR);
  }

  function protectAuditPagination(event) {
    if (!isAuditPage() || event.isTrusted !== false) return;
    if (global.__goAwakeDedicatedAuditCollector === true) return;

    var control = paginatorControl(event.target);
    if (!control) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    console.warn(
      '[SLA][Audit] Paginação programática bloqueada. O clique manual continua permitido.',
      control
    );
  }

  global.document.addEventListener('click', protectAuditPagination, true);

  global.GoAwakeAuditPaginationGuard = Object.freeze({
    isAuditPage: isAuditPage,
    paginatorControl: paginatorControl,
    protectAuditPagination: protectAuditPagination
  });
})(window);
