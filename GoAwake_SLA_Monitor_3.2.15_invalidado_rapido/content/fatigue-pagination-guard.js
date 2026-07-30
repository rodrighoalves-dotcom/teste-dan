(function (global) {
  'use strict';

  if (global.__goAwakeFatiguePaginationGuardInstalled) return;
  global.__goAwakeFatiguePaginationGuardInstalled = true;

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

  function isFatiguePage() {
    return global.location.protocol === 'https:' &&
      global.location.hostname === 'www.goawakecloud.com.br' &&
      (
        global.location.pathname.includes('/fatigue') ||
        global.location.hash.includes('/pages/f/fatigue')
      );
  }

  function paginatorControl(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest(PAGINATOR_SELECTOR);
  }

  function protectFatiguePagination(event) {
    if (!isFatiguePage() || event.isTrusted !== false) return;
    var control = paginatorControl(event.target);
    if (!control) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    console.warn(
      '[SLA][Fadiga] Paginação programática bloqueada. O clique manual continua permitido.',
      control
    );
  }

  global.document.addEventListener('click', protectFatiguePagination, true);
  global.GoAwakeFatiguePaginationGuard = Object.freeze({
    isFatiguePage: isFatiguePage,
    paginatorControl: paginatorControl,
    protectFatiguePagination: protectFatiguePagination
  });
})(window);
