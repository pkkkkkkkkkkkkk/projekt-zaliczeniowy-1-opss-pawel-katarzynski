(function () {
    'use strict';

    const TRANSITION_MS = 140;

    function createState() {
        return {
            cleanupFns: [],
            transitionLock: false,
            transitionTimer: null
        };
    }

    function addListener(state, target, eventName, handler, options) {
        target.addEventListener(eventName, handler, options);
        state.cleanupFns.push(function () {
            target.removeEventListener(eventName, handler, options);
        });
    }

    function clearTransitionTimer(state) {
        if (state.transitionTimer === null) return;
        window.clearTimeout(state.transitionTimer);
        state.transitionTimer = null;
    }

    function cleanup(state) {
        clearTransitionTimer(state);

        while (state.cleanupFns.length > 0) {
            const dispose = state.cleanupFns.pop();
            dispose();
        }
    }

    function collectElements(root) {
        const menuItems = Array.from(root.querySelectorAll('.services-menu li[data-service]'));
        const buttons = menuItems
            .map(function (item) {
                return item.querySelector('button');
            })
            .filter(Boolean);
        const detailPanel = root.querySelector('.services-detail');
        const detailTitle = detailPanel ? detailPanel.querySelector('.services-detail-title') : null;
        const detailDesc = detailPanel ? detailPanel.querySelector('.services-detail-desc') : null;
        const detailList = detailPanel ? detailPanel.querySelector('.services-detail-list') : null;

        return {
            root: root,
            menuItems: menuItems,
            buttons: buttons,
            detailPanel: detailPanel,
            detailTitle: detailTitle,
            detailDesc: detailDesc,
            detailList: detailList
        };
    }

    function collectTemplates(root) {
        const templates = new Map();
        root.querySelectorAll('template[data-service-template]').forEach(function (template) {
            templates.set(template.dataset.serviceTemplate, template);
        });
        return templates;
    }

    function getButtonForItem(item) {
        return item ? item.querySelector('button') : null;
    }

    function getItemForButton(button) {
        return button ? button.closest('li[data-service]') : null;
    }

    function setActiveMenuItem(elements, nextItem) {
        elements.menuItems.forEach(function (item) {
            const button = getButtonForItem(item);
            const isActive = item === nextItem;

            item.classList.toggle('active', isActive);

            if (!button) return;
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.tabIndex = isActive ? 0 : -1;
        });
    }

    function getTemplateContent(template) {
        if (!template) return null;

        // Each service template is expected to contain exactly one h4, one p, and one ul.
        const titleNode = template.content.querySelector('h4');
        const descNode = template.content.querySelector('p');
        const listNode = template.content.querySelector('ul');

        if (!titleNode || !descNode || !listNode) {
            return null;
        }

        return {
            title: titleNode.textContent || '',
            desc: descNode.textContent || '',
            items: Array.from(listNode.children).map(function (item) {
                return item.cloneNode(true);
            })
        };
    }

    function renderPanel(elements, template, labelledBy) {
        if (!elements.detailPanel || !elements.detailTitle || !elements.detailDesc || !elements.detailList) {
            return false;
        }

        const content = getTemplateContent(template);
        if (!content) return false;

        elements.detailTitle.textContent = content.title;
        elements.detailDesc.textContent = content.desc;
        elements.detailList.replaceChildren(...content.items);

        if (labelledBy) {
            elements.detailPanel.setAttribute('aria-labelledby', labelledBy);
        }

        return true;
    }

    function finishTransition(state, elements, template, labelledBy) {
        const rendered = renderPanel(elements, template, labelledBy);
        if (rendered && elements.detailPanel) {
            elements.detailPanel.classList.remove('is-switching');
        }

        state.transitionLock = false;
        state.transitionTimer = null;
    }

    function activateItem(state, elements, templates, item, options) {
        const config = options || {};
        const withTransition = config.withTransition !== false;
        const focusButton = config.focusButton === true;
        const key = item ? item.dataset.service : null;
        const button = getButtonForItem(item);
        const template = key ? templates.get(key) : null;

        if (!key || !button || !template) return;
        if (state.transitionLock && withTransition) return;

        setActiveMenuItem(elements, item);

        if (focusButton) {
            button.focus();
        }

        if (!withTransition || !elements.detailPanel || !elements.detailTitle || !elements.detailDesc || !elements.detailList) {
            renderPanel(elements, template, button.id);
            return;
        }

        clearTransitionTimer(state);
        state.transitionLock = true;
        elements.detailPanel.classList.add('is-switching');

        state.transitionTimer = window.setTimeout(function () {
            finishTransition(state, elements, template, button.id);
        }, TRANSITION_MS);
    }

    function focusButtonAtIndex(elements, index) {
        const button = elements.buttons[index];
        if (button) {
            button.focus();
        }
    }

    function moveFocus(elements, currentButton, direction) {
        const currentIndex = elements.buttons.indexOf(currentButton);
        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + direction + elements.buttons.length) % elements.buttons.length;
        focusButtonAtIndex(elements, nextIndex);
    }

    function bindMenuEvents(state, elements, templates) {
        function onKeydown(event) {
            const currentButton = event.currentTarget;
            const currentItem = getItemForButton(currentButton);

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    moveFocus(elements, currentButton, 1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    moveFocus(elements, currentButton, -1);
                    break;
                case 'Home':
                    event.preventDefault();
                    focusButtonAtIndex(elements, 0);
                    break;
                case 'End':
                    event.preventDefault();
                    focusButtonAtIndex(elements, elements.buttons.length - 1);
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    if (currentItem) {
                        activateItem(state, elements, templates, currentItem, { withTransition: true });
                    }
                    break;
            }
        }

        elements.buttons.forEach(function (button) {
            const item = getItemForButton(button);
            if (!item) return;

            addListener(state, button, 'click', function () {
                activateItem(state, elements, templates, item, { withTransition: true });
            });
            addListener(state, button, 'keydown', onKeydown);
        });
    }

    function init() {
        const section = document.getElementById('services');
        if (!section) return;

        const state = createState();
        const elements = collectElements(section);
        const templates = collectTemplates(section);

        if (elements.menuItems.length === 0 || elements.buttons.length === 0) return;

        bindMenuEvents(state, elements, templates);

        const initialItem = section.querySelector('.services-menu li.active[data-service]') || elements.menuItems[0];
        activateItem(state, elements, templates, initialItem, { withTransition: false });

        addListener(state, window, 'pagehide', function () {
            cleanup(state);
        }, { once: true });
        addListener(state, window, 'beforeunload', function () {
            cleanup(state);
        }, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
