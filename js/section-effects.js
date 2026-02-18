(function () {
    'use strict';

    function init() {
        const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        const reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;
        const pointerFine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : false;

        const revealNodes = Array.from(document.querySelectorAll('[data-reveal]'));
        const staggerGroups = Array.from(document.querySelectorAll('[data-stagger]'));
        const spotlightNodes = Array.from(document.querySelectorAll('[data-spotlight]'));
        const magneticNodes = Array.from(document.querySelectorAll('[data-magnetic]'));

        let revealObserver = null;
        let cleanupFns = [];
        let cleanedUp = false;

        function addListener(target, eventName, handler, options) {
            target.addEventListener(eventName, handler, options);
            cleanupFns.push(function () {
                target.removeEventListener(eventName, handler, options);
            });
        }

        function cleanup() {
            if (cleanedUp) return;
            cleanedUp = true;

            if (revealObserver) {
                revealObserver.disconnect();
                revealObserver = null;
            }

            for (let i = 0; i < cleanupFns.length; i += 1) {
                cleanupFns[i]();
            }
            cleanupFns = [];
        }

        staggerGroups.forEach(function (group) {
            const children = Array.from(group.querySelectorAll('[data-reveal]'));
            children.forEach(function (node, index) {
                node.style.setProperty('--reveal-delay', (index * 75) + 'ms');
            });
        });

        if (!reducedMotion) {
            document.body.classList.add('fx-ready');
        }

        if (reducedMotion || !('IntersectionObserver' in window)) {
            revealNodes.forEach(function (node) {
                node.classList.add('is-revealed');
            });
        } else {
            revealObserver = new IntersectionObserver(function (entries, obs) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-revealed');
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });

            revealNodes.forEach(function (node) {
                revealObserver.observe(node);
            });
        }

        if (pointerFine && !reducedMotion) {
            spotlightNodes.forEach(function (node) {
                const onEnter = function () {
                    node.classList.add('is-hover');
                };
                const onMove = function (event) {
                    const rect = node.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;
                    node.style.setProperty('--spot-x', x + 'px');
                    node.style.setProperty('--spot-y', y + 'px');
                };
                const onLeave = function () {
                    node.classList.remove('is-hover');
                };

                addListener(node, 'pointerenter', onEnter);
                addListener(node, 'pointermove', onMove);
                addListener(node, 'pointerleave', onLeave);
            });

            magneticNodes.forEach(function (node) {
                const onMove = function (event) {
                    const rect = node.getBoundingClientRect();
                    const relX = event.clientX - rect.left - rect.width / 2;
                    const relY = event.clientY - rect.top - rect.height / 2;
                    const moveX = Math.max(-8, Math.min(8, relX * 0.12));
                    const moveY = Math.max(-8, Math.min(8, relY * 0.12));
                    node.style.transform = 'translate(' + moveX + 'px, ' + moveY + 'px)';
                };
                const onLeave = function () {
                    node.style.transform = '';
                };

                addListener(node, 'pointermove', onMove);
                addListener(node, 'pointerleave', onLeave);
            });
        }

        window.addEventListener('pagehide', cleanup, { once: true });
        window.addEventListener('beforeunload', cleanup, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
