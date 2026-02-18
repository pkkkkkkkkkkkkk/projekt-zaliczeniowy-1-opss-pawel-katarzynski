(function () {
    'use strict';

    function init() {
        const cleanupFns = [];

        function addListener(target, eventName, handler, options) {
            target.addEventListener(eventName, handler, options);
            cleanupFns.push(function () {
                target.removeEventListener(eventName, handler, options);
            });
        }

        function initNavbarScrollState() {
            const nav = document.getElementById('mainNav');
            if (!nav) return;

            let navScrollTicking = false;

            function updateNavbarState() {
                if (window.scrollY > 50) {
                    nav.classList.add('navbar-scrolled');
                } else {
                    nav.classList.remove('navbar-scrolled');
                }
                navScrollTicking = false;
            }

            function onScroll() {
                if (navScrollTicking) return;
                navScrollTicking = true;
                window.requestAnimationFrame(updateNavbarState);
            }

            addListener(window, 'scroll', onScroll, { passive: true });
            updateNavbarState();
        }

        function initMobileMenuClose() {
            const navLinks = Array.from(document.querySelectorAll('.nav-link'));
            if (navLinks.length === 0) return;

            navLinks.forEach(function (link) {
                addListener(link, 'click', function () {
                    const collapse = document.getElementById('navbarNav');
                    const bootstrapApi = window.bootstrap;

                    if (!collapse || !bootstrapApi || !bootstrapApi.Collapse) {
                        return;
                    }

                    const bsCollapse = bootstrapApi.Collapse.getInstance(collapse);
                    if (bsCollapse) {
                        bsCollapse.hide();
                    }
                });
            });
        }

        function cleanup() {
            while (cleanupFns.length > 0) {
                const dispose = cleanupFns.pop();
                dispose();
            }
        }

        initNavbarScrollState();
        initMobileMenuClose();

        addListener(window, 'pagehide', cleanup, { once: true });
        addListener(window, 'beforeunload', cleanup, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
