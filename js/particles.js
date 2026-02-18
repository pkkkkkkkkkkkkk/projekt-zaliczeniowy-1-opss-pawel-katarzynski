(function () {
    'use strict';

    // --- Configuration ---
    const ACCENT_R = 88;
    const ACCENT_G = 166;
    const ACCENT_B = 255;
    const LAYERS = [
        { count: 65, sizeMin: 0.8, sizeMax: 1.2, alpha: 0.18, speed: 0.15, lines: false, glow: false, parallax: 0.02, mouseStrength: 0.002 },
        { count: 39, sizeMin: 1.5, sizeMax: 2.5, alpha: 0.35, speed: 0.3, lines: true, lineRange: 150, glow: false, parallax: 0.05, mouseStrength: 0.008 },
        { count: 16, sizeMin: 2.5, sizeMax: 4, alpha: 0.5, speed: 0.5, lines: true, lineRange: 180, glow: true, parallax: 0.1, mouseStrength: 0.015 }
    ];

    const BLOB_COUNT = 3;
    const MOBILE_BREAKPOINT = 768;
    const MOUSE_INFLUENCE_RADIUS = 200;
    const MOUSE_INFLUENCE_RADIUS2 = MOUSE_INFLUENCE_RADIUS * MOUSE_INFLUENCE_RADIUS;
    const MOUSE_IDLE_MS = 3000;
    const SCROLL_VELOCITY_DECAY = 0.95;
    const SCROLL_VELOCITY_FACTOR = 0.3;
    const DPR_CAP = 2;
    const WANDER_STRENGTH = 0.02;

    // Adaptive mobile quality (keeps desktop visuals unchanged)
    const QUALITY_LEVEL_FACTORS = [1, 0.82, 0.65];
    const PERF_WINDOW_MS = 2400;
    const LOW_FPS_THRESHOLD = 20;
    const HIGH_FPS_THRESHOLD = 27;
    const PERF_WARN_COOLDOWN_MS = 12000;

    // --- State ---
    let canvas;
    let ctx;
    let W;
    let H;
    let dpr;
    let heroEl;
    let heroRect = { left: 0, top: 0 };
    let particles = [];
    let blobs = [];
    let grid = {};

    let mouseX = -9999;
    let mouseY = -9999;
    let mouseActive = false;
    let mouseIdleTimer = null;
    let resizeTimeout = null;

    let currentScrollY = 0;
    let lastScrollY = 0;
    let scrollVelocity = 0;
    let heroHeight = 0;
    let heroWidth = 0;
    let isMobile = false;
    let running = false;
    let pageVisible = true;
    let heroInView = true;
    let frameCount = 0;
    let rafId = null;
    let scrollRectRafPending = false;

    let initialized = false;
    let cleanupDone = false;

    let qualityLevel = 0;
    let perfWindowStart = 0;
    let perfFrames = 0;
    let lowPerfWindows = 0;
    let highPerfWindows = 0;
    let lastPerfWarnAt = 0;
    let nextParticleId = 0;

    let heroObserver = null;

    let onResize;
    let onMouseMove;
    let onMouseLeave;
    let onTouchMove;
    let onTouchEnd;
    let onScroll;
    let onVisibilityChange;

    // --- Helpers ---
    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function rgba(r, g, b, a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function logPerfWarn(now, message) {
        if (now - lastPerfWarnAt < PERF_WARN_COOLDOWN_MS) return;
        lastPerfWarnAt = now;
        void message;
    }

    function updateHeroRect() {
        if (!heroEl) return;
        heroRect = heroEl.getBoundingClientRect();
    }

    function queueHeroRectUpdate() {
        if (scrollRectRafPending) return;
        scrollRectRafPending = true;
        window.requestAnimationFrame(function () {
            scrollRectRafPending = false;
            updateHeroRect();
        });
    }

    // --- Particle Factory ---
    function createParticle(layerIndex) {
        const layer = LAYERS[layerIndex];
        return {
            id: nextParticleId++,
            layer: layerIndex,
            x: rand(0, heroWidth || W / dpr),
            y: rand(0, heroHeight || H / dpr),
            vx: rand(-layer.speed, layer.speed),
            vy: rand(-layer.speed, layer.speed),
            size: rand(layer.sizeMin, layer.sizeMax),
            baseAlpha: layer.alpha
        };
    }

    // --- Blob Factory ---
    function createBlob() {
        return {
            x: rand(0.2, 0.8),
            y: rand(0.2, 0.8),
            radius: rand(200, 400),
            freqX: rand(0.0003, 0.0008),
            freqY: rand(0.0004, 0.001),
            phaseX: rand(0, Math.PI * 2),
            phaseY: rand(0, Math.PI * 2),
            alpha: 0.03
        };
    }

    // --- Init ---
    function init() {
        if (initialized) return;
        initialized = true;

        canvas = document.getElementById('particleCanvas');
        if (!canvas) return;

        ctx = canvas.getContext('2d');
        heroEl = document.getElementById('home');
        if (!ctx || !heroEl) return;

        currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        lastScrollY = currentScrollY;
        pageVisible = !document.hidden;
        isMobile = window.innerWidth < MOBILE_BREAKPOINT;
        qualityLevel = 0;

        resize();
        spawnParticles();
        spawnBlobs();
        bindEvents();
        setupHeroObserver();
        syncRunningState();

        window.addEventListener('pagehide', cleanup, { once: true });
        window.addEventListener('beforeunload', cleanup, { once: true });
    }

    function resize() {
        if (!canvas || !ctx) return;

        dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

        heroWidth = heroEl ? heroEl.offsetWidth : window.innerWidth;
        heroHeight = heroEl ? heroEl.offsetHeight : window.innerHeight;

        W = heroWidth * dpr;
        H = heroHeight * dpr;
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = heroWidth + 'px';
        canvas.style.height = heroHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        isMobile = window.innerWidth < MOBILE_BREAKPOINT;
        updateHeroRect();
    }

    function spawnParticles() {
        particles = [];
        nextParticleId = 0;

        const mobileFactor = isMobile ? 0.5 : 1;
        const qualityFactor = isMobile ? QUALITY_LEVEL_FACTORS[qualityLevel] : 1;

        for (let li = 0; li < LAYERS.length; li += 1) {
            const count = Math.round(LAYERS[li].count * mobileFactor * qualityFactor);
            for (let i = 0; i < count; i += 1) {
                particles.push(createParticle(li));
            }
        }
    }

    function spawnBlobs() {
        blobs = [];
        for (let i = 0; i < BLOB_COUNT; i += 1) {
            blobs.push(createBlob());
        }
    }

    // --- Spatial Grid ---
    function clearGrid() {
        for (const key in grid) {
            if (Object.prototype.hasOwnProperty.call(grid, key)) {
                delete grid[key];
            }
        }
    }

    function gridKey(cx, cy) {
        return cx + '|' + cy;
    }

    function insertGrid(particle, cellSize) {
        const cx = Math.floor(particle.x / cellSize);
        const cy = Math.floor(particle.y / cellSize);
        const key = gridKey(cx, cy);
        if (!grid[key]) grid[key] = [];
        grid[key].push(particle);
    }

    function getNeighbors(particle, range, cellSize) {
        const results = [];
        const cx = Math.floor(particle.x / cellSize);
        const cy = Math.floor(particle.y / cellSize);
        const radius = Math.ceil(range / cellSize);

        for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dy = -radius; dy <= radius; dy += 1) {
                const key = gridKey(cx + dx, cy + dy);
                const bucket = grid[key];
                if (!bucket) continue;

                for (let i = 0; i < bucket.length; i += 1) {
                    const candidate = bucket[i];
                    if (candidate !== particle && candidate.layer === particle.layer) {
                        results.push(candidate);
                    }
                }
            }
        }

        return results;
    }

    // --- Events ---
    function updatePointer(clientX, clientY) {
        if (heroEl) {
            mouseX = clientX - heroRect.left;
            mouseY = clientY - heroRect.top;
        } else {
            mouseX = clientX;
            mouseY = clientY;
        }

        mouseActive = true;
        clearTimeout(mouseIdleTimer);
        mouseIdleTimer = setTimeout(function () {
            mouseActive = false;
        }, MOUSE_IDLE_MS);
    }

    function bindEvents() {
        onResize = function () {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function () {
                const previousMobile = isMobile;
                resize();
                if (previousMobile !== isMobile && !isMobile) {
                    qualityLevel = 0;
                }
                spawnParticles();
            }, 200);
        };
        window.addEventListener('resize', onResize);

        onMouseMove = function (event) {
            updatePointer(event.clientX, event.clientY);
        };
        document.addEventListener('mousemove', onMouseMove);

        onMouseLeave = function () {
            mouseActive = false;
        };
        document.addEventListener('mouseleave', onMouseLeave);

        onTouchMove = function (event) {
            if (event.touches.length > 0) {
                updatePointer(event.touches[0].clientX, event.touches[0].clientY);
            }
        };
        document.addEventListener('touchmove', onTouchMove, { passive: true });

        onTouchEnd = function () {
            mouseActive = false;
        };
        document.addEventListener('touchend', onTouchEnd);

        onScroll = function () {
            currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
            queueHeroRectUpdate();
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        onVisibilityChange = function () {
            pageVisible = !document.hidden;
            syncRunningState();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
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
                syncRunningState();
            });
        }, { threshold: [0, 0.05] });

        heroObserver.observe(heroEl);
    }

    // --- Running State ---
    function startAnimation() {
        if (running || !ctx) return;
        running = true;
        frameCount = 0;
        perfWindowStart = 0;
        perfFrames = 0;
        rafId = window.requestAnimationFrame(animate);
    }

    function stopAnimation() {
        running = false;
        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function syncRunningState() {
        if (pageVisible && heroInView) {
            startAnimation();
        } else {
            stopAnimation();
        }
    }

    function updateAdaptiveQuality(timestamp) {
        if (!isMobile) return;

        if (perfWindowStart === 0) {
            perfWindowStart = timestamp;
            perfFrames = 0;
            return;
        }

        perfFrames += 1;
        const elapsed = timestamp - perfWindowStart;
        if (elapsed < PERF_WINDOW_MS) return;

        const fps = (perfFrames * 1000) / elapsed;

        if (fps < LOW_FPS_THRESHOLD) {
            lowPerfWindows += 1;
            highPerfWindows = 0;
        } else if (fps > HIGH_FPS_THRESHOLD) {
            highPerfWindows += 1;
            lowPerfWindows = 0;
        } else {
            lowPerfWindows = 0;
            highPerfWindows = 0;
        }

        if (lowPerfWindows >= 2 && qualityLevel < QUALITY_LEVEL_FACTORS.length - 1) {
            qualityLevel += 1;
            spawnParticles();
            lowPerfWindows = 0;
            highPerfWindows = 0;
            logPerfWarn(timestamp, 'High frame time detected. Lowering particle quality to maintain smoothness.');
        } else if (highPerfWindows >= 3 && qualityLevel > 0) {
            qualityLevel -= 1;
            spawnParticles();
            lowPerfWindows = 0;
            highPerfWindows = 0;
        }

        perfWindowStart = timestamp;
        perfFrames = 0;
    }

    // --- Animation Loop ---
    function animate(timestamp) {
        if (!running || !ctx) return;

        rafId = window.requestAnimationFrame(animate);
        frameCount += 1;

        // Mobile baseline cap around 30fps
        if (isMobile && frameCount % 2 !== 0) return;

        updateAdaptiveQuality(timestamp);

        const scrollDelta = currentScrollY - lastScrollY;
        scrollVelocity += scrollDelta * SCROLL_VELOCITY_FACTOR;
        scrollVelocity *= SCROLL_VELOCITY_DECAY;
        lastScrollY = currentScrollY;

        const logicalW = heroWidth;
        const logicalH = heroHeight;
        const gridCellSize = 200;

        ctx.clearRect(0, 0, logicalW, logicalH);
        drawBlobs(logicalW, logicalH, timestamp);

        clearGrid();
        for (let i = 0; i < particles.length; i += 1) {
            insertGrid(particles[i], gridCellSize);
        }

        for (let pi = 0; pi < particles.length; pi += 1) {
            const particle = particles[pi];
            const layer = LAYERS[particle.layer];

            particle.vx += (Math.random() - 0.5) * WANDER_STRENGTH * (1 + particle.layer * 0.5);
            particle.vy += (Math.random() - 0.5) * WANDER_STRENGTH * (1 + particle.layer * 0.5);

            particle.x += particle.vx + (scrollVelocity * layer.parallax * 0.1);
            particle.y += particle.vy;

            if (mouseActive) {
                const dx = mouseX - particle.x;
                const dy = mouseY - particle.y;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared < MOUSE_INFLUENCE_RADIUS2 && distanceSquared > 1) {
                    const distance = Math.sqrt(distanceSquared);
                    const force = layer.mouseStrength * (1 - distance / MOUSE_INFLUENCE_RADIUS);
                    particle.vx += (dx / distance) * force;
                    particle.vy += (dy / distance) * force;
                }
            }

            particle.vx *= 0.99;
            particle.vy *= 0.99;

            const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
            const maxSpeed = layer.speed * 3;
            if (speed > maxSpeed) {
                particle.vx = (particle.vx / speed) * maxSpeed;
                particle.vy = (particle.vy / speed) * maxSpeed;
            }

            if (particle.x < -20) particle.x = logicalW + 20;
            if (particle.x > logicalW + 20) particle.x = -20;
            if (particle.y < -20) particle.y = logicalH + 20;
            if (particle.y > logicalH + 20) particle.y = -20;

            const drawY = particle.y;

            if (layer.lines) {
                const neighbors = getNeighbors(particle, layer.lineRange, gridCellSize);
                const rangeSquared = layer.lineRange * layer.lineRange;

                for (let j = 0; j < neighbors.length; j += 1) {
                    const neighbor = neighbors[j];
                    if (neighbor.id <= particle.id) continue;

                    const dx = neighbor.x - particle.x;
                    const dy = neighbor.y - drawY;
                    const distanceSquared = dx * dx + dy * dy;
                    if (distanceSquared >= rangeSquared) continue;

                    const distance = Math.sqrt(distanceSquared);
                    const lineAlpha = (1 - distance / layer.lineRange) * layer.alpha * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(particle.x, drawY);
                    ctx.lineTo(neighbor.x, neighbor.y);
                    ctx.strokeStyle = rgba(ACCENT_R, ACCENT_G, ACCENT_B, lineAlpha);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }

            if (layer.glow) {
                const glowGrad = ctx.createRadialGradient(particle.x, drawY, 0, particle.x, drawY, particle.size * 8);
                glowGrad.addColorStop(0, rgba(ACCENT_R, ACCENT_G, ACCENT_B, particle.baseAlpha * 0.15));
                glowGrad.addColorStop(1, rgba(ACCENT_R, ACCENT_G, ACCENT_B, 0));
                ctx.beginPath();
                ctx.arc(particle.x, drawY, particle.size * 8, 0, Math.PI * 2);
                ctx.fillStyle = glowGrad;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(particle.x, drawY, particle.size, 0, Math.PI * 2);
            ctx.fillStyle = rgba(ACCENT_R, ACCENT_G, ACCENT_B, particle.baseAlpha);
            ctx.fill();
        }

        if (mouseActive) {
            const mouseGradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 120);
            mouseGradient.addColorStop(0, rgba(ACCENT_R, ACCENT_G, ACCENT_B, 0.06));
            mouseGradient.addColorStop(1, rgba(ACCENT_R, ACCENT_G, ACCENT_B, 0));
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 120, 0, Math.PI * 2);
            ctx.fillStyle = mouseGradient;
            ctx.fill();
        }
    }

    function drawBlobs(width, height, timestamp) {
        for (let i = 0; i < blobs.length; i += 1) {
            const blob = blobs[i];
            const blobX = (0.5 + 0.3 * Math.sin(timestamp * blob.freqX + blob.phaseX)) * width;
            const blobY = (0.5 + 0.3 * Math.cos(timestamp * blob.freqY + blob.phaseY)) * height;
            const gradient = ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blob.radius);
            gradient.addColorStop(0, rgba(ACCENT_R, ACCENT_G, ACCENT_B, blob.alpha));
            gradient.addColorStop(1, rgba(ACCENT_R, ACCENT_G, ACCENT_B, 0));
            ctx.beginPath();
            ctx.arc(blobX, blobY, blob.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }

    function cleanup() {
        if (cleanupDone) return;
        cleanupDone = true;

        stopAnimation();

        clearTimeout(resizeTimeout);
        clearTimeout(mouseIdleTimer);

        if (onResize) window.removeEventListener('resize', onResize);
        if (onMouseMove) document.removeEventListener('mousemove', onMouseMove);
        if (onMouseLeave) document.removeEventListener('mouseleave', onMouseLeave);
        if (onTouchMove) document.removeEventListener('touchmove', onTouchMove);
        if (onTouchEnd) document.removeEventListener('touchend', onTouchEnd);
        if (onScroll) window.removeEventListener('scroll', onScroll);
        if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);

        if (heroObserver) {
            heroObserver.disconnect();
            heroObserver = null;
        }

        particles = [];
        blobs = [];
        grid = {};
    }

    // --- Boot ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
