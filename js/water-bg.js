import * as THREE from './vendor/three.module.min.js';

(function () {
    'use strict';

    let heroEl;
    let mountEl;
    let aboutEl;

    let scene;
    let camera;
    let renderer;
    let waterMesh;
    let waterGeo;
    let waterMat;
    let uniforms;

    let rafId = null;
    let running = false;
    let lastTime = 0;
    let reducedMotion = false;

    let resizeObserver = null;
    let aboutObserver = null;
    let heroObserver = null;
    let mediaQuery = null;

    let onScroll;
    let onResize;
    let onVisibilityChange;
    let onMotionPreferenceChange;
    let scrollTicking = false;
    let heroInView = true;

    let cleanupDone = false;

    const DPR_CAP = 2;
    const WATER_FADE_MAX = 0.25;

    function clamp01(value) {
        return Math.min(1, Math.max(0, value));
    }

    function updateTransition() {
        if (!heroEl) return;

        const rect = heroEl.getBoundingClientRect();
        const height = rect.height || heroEl.offsetHeight || 1;
        const progress = clamp01(-rect.top / height);

        heroEl.style.setProperty('--hero-drain-opacity', String(progress));

        if (renderer && renderer.domElement) {
            renderer.domElement.style.opacity = String(1 - progress * WATER_FADE_MAX);
        }
    }

    function setupAboutObserver() {
        if (!aboutEl || !('IntersectionObserver' in window)) return;

        aboutObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    aboutEl.classList.add('in-view');
                } else {
                    aboutEl.classList.remove('in-view');
                }
            });
        }, { threshold: 0.05 });

        aboutObserver.observe(aboutEl);
    }

    function setReducedMotionFromSystem() {
        if (!window.matchMedia) {
            reducedMotion = false;
            return;
        }

        mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotion = !!mediaQuery.matches;
    }

    function resizeRenderer() {
        if (!renderer || !camera || !mountEl) return;

        const width = Math.max(1, mountEl.clientWidth);
        const height = Math.max(1, mountEl.clientHeight);

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        updateTransition();
        renderFrame();
    }

    function renderFrame() {
        if (!renderer || !scene || !camera || !uniforms) return;

        const t = uniforms.uTime.value;
        camera.position.x = Math.sin(t * 0.08) * 3;
        camera.position.z = Math.cos(t * 0.08) * 3;
        camera.position.y = 30;
        camera.lookAt(0, 0, 0);

        uniforms.uCamPos.value.copy(camera.position);
        renderer.render(scene, camera);
    }

    function tick(now) {
        if (!running) return;
        rafId = window.requestAnimationFrame(tick);

        const dt = lastTime ? (now - lastTime) / 1000 : 0;
        lastTime = now;
        uniforms.uTime.value += dt;

        renderFrame();
    }

    function startAnimation() {
        if (!renderer || running || reducedMotion || document.hidden || !heroInView) return;
        running = true;
        lastTime = 0;
        rafId = window.requestAnimationFrame(tick);
    }

    function stopAnimation() {
        running = false;
        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function bindCommonEvents() {
        onScroll = function () {
            if (scrollTicking) return;
            scrollTicking = true;
            window.requestAnimationFrame(function () {
                scrollTicking = false;
                updateTransition();
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        onVisibilityChange = function () {
            if (document.hidden) {
                stopAnimation();
            } else if (!reducedMotion && heroInView) {
                startAnimation();
            } else {
                renderFrame();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        if (mediaQuery) {
            onMotionPreferenceChange = function (event) {
                reducedMotion = !!event.matches;
                if (reducedMotion) {
                    stopAnimation();
                    renderFrame();
                } else if (!document.hidden && heroInView) {
                    startAnimation();
                }
            };

            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', onMotionPreferenceChange);
            } else if (mediaQuery.addListener) {
                mediaQuery.addListener(onMotionPreferenceChange);
            }
        }
    }

    function setupHeroObserver() {
        if (!heroEl || !('IntersectionObserver' in window)) {
            heroInView = true;
            return;
        }

        heroObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.target !== heroEl) return;
                heroInView = entry.isIntersecting || entry.intersectionRatio > 0;
                if (heroInView && !reducedMotion && !document.hidden) {
                    startAnimation();
                } else if (!heroInView) {
                    stopAnimation();
                }
            });
        }, { threshold: [0, 0.05] });

        heroObserver.observe(heroEl);
    }

    function initThree() {
        if (!mountEl) return false;

        scene = new THREE.Scene();
        scene.background = null;

        camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
        camera.up.set(0, 0, -1);
        camera.position.set(0, 30, 0);
        camera.lookAt(0, 0, 0);

        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
        } catch (error) {
            console.warn('[water-bg] WebGL renderer init failed. Water layer disabled.', error);
            return false;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
        renderer.setSize(Math.max(1, mountEl.clientWidth), Math.max(1, mountEl.clientHeight), false);
        if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace !== undefined) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
        }
        mountEl.appendChild(renderer.domElement);
        renderer.domElement.style.opacity = '0.95';

        uniforms = {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color('#0d1117') },
            uShallow: { value: new THREE.Color('#58a6ff') },
            uFoam: { value: new THREE.Color('#79b8ff') },
            uSunDir: { value: new THREE.Vector3(0.4, 1.0, 0.2).normalize() },
            uCamPos: { value: new THREE.Vector3() },
            uSpeed: { value: 0.5 },
            uChop: { value: 0.75 },
            uFresnel: { value: 1.2 }
        };

        waterMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            wireframe: true,
            transparent: false,
            depthWrite: true,
            depthTest: true,
            vertexShader: `
                uniform float uTime;
                uniform float uSpeed;
                uniform float uChop;

                varying vec3 vWorldPos;
                varying vec3 vN;
                varying float vWave;

                float wave(vec2 p, vec2 dir, float freq, float amp, float phase){
                    return sin(dot(p, dir) * freq + phase) * amp;
                }

                void main(){
                    vec3 pos = position;
                    float t = uTime * uSpeed;

                    vec2 p = pos.xz;
                    vec2 d1 = normalize(vec2(1.0, 0.2));
                    vec2 d2 = normalize(vec2(-0.4, 1.0));
                    vec2 d3 = normalize(vec2(0.7, -1.0));

                    float w1 = wave(p, d1, 0.23, 0.55, t * 1.1);
                    float w2 = wave(p, d2, 0.38, 0.32, t * 1.7);
                    float w3 = wave(p, d3, 0.55, 0.18, t * 2.2);

                    float h = (w1 + w2 + w3);
                    pos.y += h;

                    float dhx =
                        cos(dot(p, d1) * 0.23 + t * 1.1) * 0.55 * 0.23 * d1.x +
                        cos(dot(p, d2) * 0.38 + t * 1.7) * 0.32 * 0.38 * d2.x +
                        cos(dot(p, d3) * 0.55 + t * 2.2) * 0.18 * 0.55 * d3.x;
                    float dhz =
                        cos(dot(p, d1) * 0.23 + t * 1.1) * 0.55 * 0.23 * d1.y +
                        cos(dot(p, d2) * 0.38 + t * 1.7) * 0.32 * 0.38 * d2.y +
                        cos(dot(p, d3) * 0.55 + t * 2.2) * 0.18 * 0.55 * d3.y;

                    vec3 n = normalize(vec3(-dhx * uChop, 1.0, -dhz * uChop));
                    vN = n;
                    vWave = h;

                    vec4 world = modelMatrix * vec4(pos, 1.0);
                    vWorldPos = world.xyz;

                    gl_Position = projectionMatrix * viewMatrix * world;
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform vec3 uDeep;
                uniform vec3 uShallow;
                uniform vec3 uFoam;
                uniform vec3 uSunDir;
                uniform vec3 uCamPos;
                uniform float uFresnel;

                varying vec3 vWorldPos;
                varying vec3 vN;
                varying float vWave;

                float sat(float x){ return clamp(x, 0.0, 1.0); }

                void main(){
                    vec3 N = normalize(vN);
                    vec3 V = normalize(uCamPos - vWorldPos);

                    float fres = pow(1.0 - sat(dot(N, V)), 5.0) * uFresnel;

                    float shallowMask = sat(0.55 + vWave * 0.55);
                    vec3 base = mix(uDeep, uShallow, shallowMask);

                    vec3 L = normalize(uSunDir);
                    vec3 H = normalize(L + V);
                    float spec = pow(sat(dot(N, H)), 70.0);

                    float foam = sat((vWave - 0.2) * 1.7);
                    foam = smoothstep(0.0, 1.0, foam);
                    foam = sat(foam * 0.75 + fres * 0.25);

                    float ndl = sat(dot(N, L));
                    vec3 col = base;
                    col *= (0.55 + ndl * 0.55);
                    col += spec * vec3(1.0, 0.98, 0.92) * 0.85;
                    col = mix(col, uFoam, foam * 0.55);

                    col += fres * vec3(0.18, 0.38, 0.55);

                    gl_FragColor = vec4(col, 1.0);
                }
            `
        });

        waterGeo = new THREE.PlaneGeometry(90, 90, 90, 90);
        waterGeo.rotateX(-Math.PI / 2);

        waterMesh = new THREE.Mesh(waterGeo, waterMat);
        scene.add(waterMesh);

        resizeRenderer();

        if ('ResizeObserver' in window) {
            resizeObserver = new ResizeObserver(function () {
                resizeRenderer();
            });
            resizeObserver.observe(mountEl);
        } else {
            onResize = function () {
                resizeRenderer();
            };
            window.addEventListener('resize', onResize);
        }

        if (!reducedMotion && !document.hidden && heroInView) {
            startAnimation();
        } else {
            renderFrame();
        }

        return true;
    }

    function cleanup() {
        if (cleanupDone) return;
        cleanupDone = true;

        stopAnimation();

        if (onScroll) window.removeEventListener('scroll', onScroll);
        if (onResize) window.removeEventListener('resize', onResize);
        if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);

        if (mediaQuery && onMotionPreferenceChange) {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', onMotionPreferenceChange);
            } else if (mediaQuery.removeListener) {
                mediaQuery.removeListener(onMotionPreferenceChange);
            }
        }

        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (aboutObserver) {
            aboutObserver.disconnect();
            aboutObserver = null;
        }

        if (heroObserver) {
            heroObserver.disconnect();
            heroObserver = null;
        }

        if (waterGeo) {
            waterGeo.dispose();
            waterGeo = null;
        }

        if (waterMat) {
            waterMat.dispose();
            waterMat = null;
        }

        if (renderer) {
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode === mountEl) {
                mountEl.removeChild(renderer.domElement);
            }
            renderer = null;
        }

        scene = null;
        camera = null;
        waterMesh = null;
        uniforms = null;
    }

    function init() {
        heroEl = document.getElementById('home');
        mountEl = document.getElementById('heroBg3d');
        aboutEl = document.getElementById('about');

        if (!heroEl || !mountEl) return;

        setReducedMotionFromSystem();
        setupAboutObserver();
        setupHeroObserver();
        bindCommonEvents();
        updateTransition();
        initThree();

        window.addEventListener('pagehide', cleanup, { once: true });
        window.addEventListener('beforeunload', cleanup, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
