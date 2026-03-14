/* ============================================
   ADIOOF.COM — Immersive Experience Engine
   ============================================ */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const state = {
        scrollTarget: 0,
        scrollCurrent: 0,
        contentHeight: 0,
        windowHeight: 0,
        isMobile: window.innerWidth <= 768,
        isReady: false,
        mouseX: 0,
        mouseY: 0,
        scrollVelocity: 0,
        prevScrollTarget: 0,
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        wrapper: $('#scrollWrapper'),
        content: $('#scrollContent'),
        heroInner: $('.hero-inner'),
        scrollLine: $('#scrollLine'),
        introSection: $('#intro'),
        introWords: $$('.intro-word'),
        journey: $('#journey'),
        journeyTrack: $('#journeyTrack'),
        journeyProgress: $('#journeyProgress'),
        projectShowcases: $$('.project-showcase'),
        personalHeading: $('.personal-heading'),
        personalItems: $$('.personal-item'),
        writingHeading: $('.writing-heading'),
        writingLinks: $$('.writing-link'),
        contactHeading: $('.contact-heading'),
        contactEmail: $('.contact-email'),
        contactSocials: $$('.contact-social'),
        contactStats: $('.contact-stats'),
        contactLocation: $('.contact-location'),
        instaHeader: $('.insta-header'),
        instaEmbed: $('.insta-embed-single'),
        linkedinTop: $('.linkedin-top'),
        linkedinPosts: $$('.linkedin-post'),
    };

    // Track mouse globally
    window.addEventListener('mousemove', (e) => {
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
    });

    // ============================================
    // SMOOTH SCROLL ENGINE
    // ============================================
    function initSmoothScroll() {
        if (prefersReducedMotion || state.isMobile) return;
        document.body.classList.add('smooth-scroll');

        function updateContentHeight() {
            state.contentHeight = dom.content.scrollHeight;
            state.windowHeight = window.innerHeight;
            document.body.style.height = state.contentHeight + 'px';
        }
        updateContentHeight();

        window.addEventListener('resize', () => {
            state.isMobile = window.innerWidth <= 768;
            if (state.isMobile) {
                document.body.classList.remove('smooth-scroll');
                document.body.style.height = '';
                dom.content.style.transform = '';
                return;
            }
            updateContentHeight();
        });

        const resizeObserver = new ResizeObserver(() => updateContentHeight());
        resizeObserver.observe(dom.content);

        window.addEventListener('scroll', () => {
            state.scrollTarget = window.scrollY;
        }, { passive: true });
    }

    function updateSmoothScroll() {
        if (prefersReducedMotion || state.isMobile) return;
        // Track velocity for momentum
        const prevTarget = state.prevScrollTarget || state.scrollTarget;
        state.scrollVelocity = Math.abs(state.scrollTarget - prevTarget);
        state.prevScrollTarget = state.scrollTarget;
        // Dynamic lerp: slower at high velocity = overshoot feeling
        const lerpFactor = state.scrollVelocity > 50 ? 0.07 : 0.12;
        state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * lerpFactor;
        if (Math.abs(state.scrollTarget - state.scrollCurrent) < 0.5) {
            state.scrollCurrent = state.scrollTarget;
        }
        dom.content.style.transform = `translateY(-${state.scrollCurrent}px)`;
    }

    function getScroll() {
        return (prefersReducedMotion || state.isMobile) ? window.scrollY : state.scrollCurrent;
    }

    // ============================================
    // HERO
    // ============================================
    function initHero() {}

    function updateHero() {
        const scroll = getScroll();
        const vh = window.innerHeight;
        if (scroll < vh) {
            const progress = scroll / vh;
            const heroInner = document.querySelector('.hero-inner');
            if (heroInner) {
                heroInner.style.opacity = Math.max(0, 1 - progress * 1.5);
                heroInner.style.transform = `translateY(${progress * 80}px)`;
            }
            if (dom.scrollLine) {
                dom.scrollLine.style.opacity = Math.max(0, 1 - progress * 3);
            }
        }
    }

    // ============================================
    // INTRO
    // ============================================
    function updateIntro() {
        if (!dom.introSection) return;
        const scroll = getScroll();
        const rect = getOffsetRect(dom.introSection);
        const scrollIntoSection = scroll - rect.top + window.innerHeight;
        const progress = Math.max(0, Math.min(1, scrollIntoSection / rect.height));
        const totalWords = dom.introWords.length;

        dom.introWords.forEach((word, i) => {
            const threshold = (i / totalWords) * 0.85;
            word.classList.toggle('revealed', progress > threshold);
        });
    }

    // ============================================
    // JOURNEY — Immersive horizontal scroll
    // ============================================
    const J = {
        activePanel: -1,
        particles: [],
        connections: [],
        ctx: null,
        canvas: null,
        countedUp: new Set(),
        snapping: false,
        snapTimeout: null,
        titleChars: [],       // cached char spans per panel
        prevProgress: 0,
        scrollVelocity: 0,
        userScrolling: false,
        userScrollTimeout: null,
    };

    const COLORS = [
        { r: 99, g: 102, b: 241 },
        { r: 6, g: 182, b: 212 },
        { r: 236, g: 72, b: 153 },
    ];

    function initJourney() {
        if (state.isMobile) {
            $$('.journey-stat-number[data-target]').forEach((el) => {
                el.textContent = el.dataset.target + (el.dataset.suffix || '');
            });
            return;
        }

        // --- Split titles into individual characters ---
        $$('.journey-title').forEach((title, pi) => {
            const html = title.innerHTML;
            const chars = [];
            let charIndex = 0;
            // Wrap each visible character in a span
            const newHTML = html.replace(/<br\s*\/?>/gi, '|||BR|||').split('').map((ch) => {
                if (ch === '|') return ch; // part of BR placeholder
                return ch;
            }).join('');

            // Wrap chars per-word so browser word-wrap stays intact
            const frag = document.createElement('div');
            frag.innerHTML = html;
            let result = '';
            function walk(node) {
                if (node.nodeType === 3) { // text
                    const words = node.textContent.split(/(\s+)/);
                    for (const word of words) {
                        if (/^\s+$/.test(word)) {
                            result += word;
                        } else {
                            // Wrap whole word in a nowrap span, chars inside
                            result += '<span class="j-word">';
                            for (const ch of word) {
                                result += `<span class="j-char" style="--i:${charIndex}">${ch}</span>`;
                                charIndex++;
                            }
                            result += '</span>';
                        }
                    }
                } else if (node.nodeName === 'BR') {
                    result += '<br>';
                } else {
                    for (const child of node.childNodes) walk(child);
                }
            }
            for (const child of frag.childNodes) walk(child);
            title.innerHTML = result;
            J.titleChars[pi] = title.querySelectorAll('.j-char');
        });

        // --- Canvas for particles + connections ---
        const canvas = $('#journeyParticles');
        if (!canvas) return;
        J.canvas = canvas;
        J.ctx = canvas.getContext('2d');

        function resize() {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
            J.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        resize();
        window.addEventListener('resize', resize);

        // Create particles — more of them, varied
        for (let i = 0; i < 100; i++) {
            J.particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                baseVx: (Math.random() - 0.5) * 0.4,
                baseVy: (Math.random() - 0.5) * 0.4,
                vx: 0, vy: 0,
                size: Math.random() * 2.5 + 0.3,
                alpha: Math.random() * 0.35 + 0.05,
                pulseSpeed: Math.random() * 0.02 + 0.005,
                pulseOffset: Math.random() * Math.PI * 2,
            });
        }

        // --- Detect user scroll stop (wheel + touch) ---
        const markScrolling = () => {
            J.userScrolling = true;
            J.snapping = false;
            clearTimeout(J.userScrollTimeout);
            clearTimeout(J.snapTimeout);
            // Dynamic: fast scroll gets more coast time
            const coastTime = Math.max(80, 250 - (state.scrollVelocity || 0));
            J.userScrollTimeout = setTimeout(() => {
                J.userScrolling = false;
                snapToNearest();
            }, coastTime);
        };
        window.addEventListener('wheel', markScrolling, { passive: true });
        window.addEventListener('touchmove', markScrolling, { passive: true });
        window.addEventListener('touchend', () => {
            clearTimeout(J.userScrollTimeout);
            J.userScrollTimeout = setTimeout(() => {
                J.userScrolling = false;
                snapToNearest();
            }, 100);
        }, { passive: true });

        // --- Dot navigation ---
        $$('.journey-dot').forEach((dot) => {
            dot.addEventListener('click', () => {
                const pi = parseInt(dot.dataset.panel);
                const jRect = getOffsetRect(dom.journey);
                const maxStick = jRect.height - window.innerHeight;
                const numP = dom.journeyTrack.children.length;
                const target = jRect.top + (pi / (numP - 1)) * maxStick;
                J.snapping = true;
                window.scrollTo({ top: target, behavior: 'smooth' });
                setTimeout(() => { J.snapping = false; }, 800);
            });
        });

        // --- Card tilt + magnetic effect ---
        $$('.journey-card').forEach((card) => {
            const inner = card.querySelector('.journey-card-inner');
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                inner.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
                inner.style.setProperty('--glow-x', `${(x + 0.5) * 100}%`);
                inner.style.setProperty('--glow-y', `${(y + 0.5) * 100}%`);
            });
            card.addEventListener('mouseleave', () => {
                inner.style.transform = '';
            });
        });

        // --- Drag to scroll ---
        const sticky = dom.journey.querySelector('.journey-sticky');
        let isDragging = false, dragStartX = 0, dragStartScroll = 0;

        sticky.addEventListener('mousedown', (e) => {
            if (e.target.closest('a, button, .journey-card')) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartScroll = window.scrollY;
            sticky.classList.add('dragging');
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const delta = dragStartX - e.clientX;
            const jRect = getOffsetRect(dom.journey);
            const maxStick = jRect.height - window.innerHeight;
            const numP = dom.journeyTrack.children.length;
            const scrollPerPixel = maxStick / (window.innerWidth * (numP - 1));
            window.scrollTo({ top: dragStartScroll + delta * scrollPerPixel * 2.5 });
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                sticky.classList.remove('dragging');
                setTimeout(() => snapToNearest(), 50);
            }
        });

        // --- Keyboard navigation ---
        window.addEventListener('keydown', (e) => {
            if (state.isMobile) return;
            const jRect = getOffsetRect(dom.journey);
            const scrolled = window.scrollY - jRect.top;
            const maxStick = jRect.height - window.innerHeight;
            if (scrolled < -100 || scrolled > maxStick + 100) return;

            const numP = dom.journeyTrack.children.length;
            const current = Math.round((scrolled / maxStick) * (numP - 1));
            let target = current;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = Math.min(numP - 1, current + 1);
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = Math.max(0, current - 1);
            else return;

            e.preventDefault();
            const targetScroll = jRect.top + (target / (numP - 1)) * maxStick;
            J.snapping = true;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
            setTimeout(() => { J.snapping = false; }, 800);
        });
    }

    function lerpColor(c1, c2, t) {
        if (!c1 || !c2) return c1 || c2 || { r: 99, g: 102, b: 241 };
        return {
            r: c1.r + (c2.r - c1.r) * t,
            g: c1.g + (c2.g - c1.g) * t,
            b: c1.b + (c2.b - c1.b) * t,
        };
    }

    function drawParticles(progress, time) {
        const { ctx, canvas, particles } = J;
        if (!ctx) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        // Current color blend
        const pi = Math.min(3, Math.floor(progress * 4));
        const t = (progress * 4) - pi;
        const ni = Math.min(3, pi + 1);
        const col = lerpColor(COLORS[pi], COLORS[ni], t);

        // Velocity boost from scroll speed
        const velBoost = Math.min(3, Math.abs(J.scrollVelocity) * 0.002);

        // Mouse attraction
        const mx = state.mouseX;
        const my = state.mouseY;

        particles.forEach((p, i) => {
            // Mouse gravity (gentle pull)
            const dx = mx - p.x;
            const dy = my - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pull = dist < 200 ? (200 - dist) / 200 * 0.15 : 0;

            p.vx = p.baseVx * (1 + velBoost) + dx * pull * 0.01;
            p.vy = p.baseVy * (1 + velBoost) + dy * pull * 0.01;
            p.x += p.vx;
            p.y += p.vy;

            // Wrap
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            if (p.y > h + 10) p.y = -10;

            // Pulse alpha
            const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.5 + 0.5;
            const alpha = p.alpha * (0.6 + pulse * 0.4);

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${col.r|0}, ${col.g|0}, ${col.b|0}, ${alpha})`;
            ctx.fill();
        });

        // Draw connections between nearby particles (constellation effect)
        ctx.lineWidth = 0.5;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i], b = particles[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const d = dx * dx + dy * dy;
                if (d < 8000) { // ~90px
                    const alpha = (1 - d / 8000) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(${col.r|0}, ${col.g|0}, ${col.b|0}, ${alpha})`;
                    ctx.stroke();
                }
            }
        }

        // Mouse glow
        if (mx > 0 && my > 0) {
            const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
            grad.addColorStop(0, `rgba(${col.r|0}, ${col.g|0}, ${col.b|0}, 0.06)`);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(mx - 120, my - 120, 240, 240);
        }
    }

    // --- Scramble text effect ---
    function scrambleReveal(charSpans, onComplete) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const originals = Array.from(charSpans).map(s => s.textContent);
        const total = charSpans.length;
        let frame = 0;
        const duration = 25; // frames per char
        const stagger = 2;   // frames between each char start

        function tick() {
            let allDone = true;
            charSpans.forEach((span, i) => {
                const startFrame = i * stagger;
                const elapsed = frame - startFrame;
                if (elapsed < 0) {
                    span.textContent = chars[Math.random() * chars.length | 0];
                    span.style.opacity = '0.3';
                    allDone = false;
                } else if (elapsed < duration) {
                    // Scrambling
                    const progress = elapsed / duration;
                    if (progress > 0.6) {
                        span.textContent = originals[i];
                        span.style.opacity = '1';
                    } else {
                        span.textContent = chars[Math.random() * chars.length | 0];
                        span.style.opacity = (0.3 + progress * 0.7).toString();
                    }
                    allDone = false;
                } else {
                    span.textContent = originals[i];
                    span.style.opacity = '1';
                }
            });
            frame++;
            if (!allDone) requestAnimationFrame(tick);
            else if (onComplete) onComplete();
        }
        // Reset all to scrambled
        charSpans.forEach(s => { s.style.opacity = '0'; });
        requestAnimationFrame(tick);
    }

    // --- Digit roller for stats ---
    function digitRoll(el) {
        const target = parseInt(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 4); // ease-out quartic
            const current = Math.round(eased * target);
            el.textContent = current + suffix;
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function snapToNearest() {
        if (J.snapping || J.userScrolling) return;
        if (state.isMobile || !dom.journey || !dom.journeyTrack) return;

        const rect = getOffsetRect(dom.journey);
        const scrolled = window.scrollY - rect.top;
        const maxStick = rect.height - window.innerHeight;
        if (scrolled <= 0 || scrolled >= maxStick) return;

        const numPanels = dom.journeyTrack.children.length;
        const progress = scrolled / maxStick;
        const nearest = Math.round(progress * (numPanels - 1));
        const targetP = nearest / (numPanels - 1);
        const targetScroll = rect.top + targetP * maxStick;
        const diff = Math.abs(window.scrollY - targetScroll);

        if (diff > 5) {
            J.snapping = true;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
            setTimeout(() => { J.snapping = false; }, 500);
        }
    }

    function updateJourney() {
        if (state.isMobile || !dom.journey || !dom.journeyTrack) return;

        const scroll = getScroll();
        const rect = getOffsetRect(dom.journey);
        const sectionTop = rect.top;
        const sectionHeight = rect.height;
        const vh = window.innerHeight;
        const sticky = dom.journey.querySelector('.journey-sticky');
        if (!sticky) return;

        const scrolled = scroll - sectionTop;
        const maxStick = sectionHeight - vh;

        // Simulate sticky
        if (scrolled <= 0) sticky.style.transform = '';
        else if (scrolled >= maxStick) sticky.style.transform = `translateY(${maxStick}px)`;
        else sticky.style.transform = `translateY(${scrolled}px)`;

        // Horizontal scroll
        const progress = Math.max(0, Math.min(1, scrolled / maxStick));
        const panels = dom.journeyTrack.children;
        const numPanels = panels.length;
        const maxTranslate = (numPanels - 1) * window.innerWidth;
        dom.journeyTrack.style.transform = `translateX(${-progress * maxTranslate}px)`;

        // Scroll velocity
        J.scrollVelocity = progress - J.prevProgress;
        J.prevProgress = progress;

        // Progress bar
        if (dom.journeyProgress) {
            dom.journeyProgress.style.width = `${progress * 100}%`;
            const glow = $('#journeyProgressGlow');
            if (glow) glow.style.left = `calc(${progress * 100}% - 40px)`;
        }

        // Connector line — draw as you scroll
        const connLine = $('#connectorLine');
        if (connLine) {
            connLine.style.strokeDashoffset = 1000 * (1 - progress);
        }
        // Connector dots
        $$('.journey-connector-dot').forEach((dot) => {
            const pi = parseInt(dot.dataset.panel);
            const dotProgress = pi / (numPanels - 1);
            dot.classList.toggle('active', progress >= dotProgress - 0.02);
        });

        // Continuous gradient morphing
        const glowEl = $('#journeyGlow');
        if (glowEl) {
            const pi = Math.min(COLORS.length - 2, Math.floor(progress * (COLORS.length - 1)));
            const ni = Math.min(COLORS.length - 1, pi + 1);
            const t = Math.max(0, Math.min(1, progress * (COLORS.length - 1) - pi));
            const col = lerpColor(COLORS[pi], COLORS[ni], t);
            glowEl.style.background = `
                radial-gradient(ellipse 40% 50% at 25% 50%, rgba(${col.r|0}, ${col.g|0}, ${col.b|0}, 0.1) 0%, transparent 70%),
                radial-gradient(ellipse 30% 40% at 75% 60%, rgba(${col.r|0}, ${col.g|0}, ${col.b|0}, 0.05) 0%, transparent 60%)
            `;
        }

        // Active panel
        const panelProgress = progress * (numPanels - 1);
        const activeIndex = Math.max(0, Math.min(numPanels - 1, Math.round(panelProgress)));

        // Per-panel: 3D depth parallax + content animations
        Array.from(panels).forEach((panel, i) => {
            const localP = panelProgress - i;
            const absP = Math.abs(localP);

            const scale = 1 - absP * 0.04;

            // 3D depth layers — year deepest, content mid, card foreground
            const content = panel.querySelector('.journey-content');
            const visual = panel.querySelector('.journey-visual');
            const year = panel.querySelector('.journey-year');

            if (i === activeIndex) {
                const mx = (state.mouseX / window.innerWidth - 0.5) * 12;
                const my = (state.mouseY / window.innerHeight - 0.5) * 8;
                if (content) content.style.transform = `translate(${mx}px, ${my}px) translateX(${localP * -15}px) translateZ(0px)`;
                if (visual) visual.style.transform = `translate(${mx * -0.5}px, ${my * -0.5}px) translateX(${localP * 15}px) translateZ(30px) scale(1)`;
            } else {
                if (content) content.style.transform = `translateX(${localP * -15}px) translateZ(0px)`;
                if (visual) visual.style.transform = `translateX(${localP * 15}px) translateZ(30px) scale(${scale}) translateY(${absP * 20}px)`;
            }

            // Year — deepest layer, fastest parallax
            if (year) {
                const offset = localP * 120;
                const yearScale = i === activeIndex ? 1 : 0.85;
                const yearOpacity = i === activeIndex ? 0.05 : 0.02;
                year.style.transform = `translate(calc(-50% + ${offset}px), -50%) scale(${yearScale}) translateZ(-50px)`;
                year.style.opacity = yearOpacity;
            }

            // Fade non-active elements
            const tag = panel.querySelector('.journey-tag');
            const desc = panel.querySelector('.journey-desc');
            const stats = panel.querySelector('.journey-stats');
            const quote = panel.querySelector('.journey-quote');
            [tag, desc, stats].forEach(el => {
                if (!el) return;
                if (i === activeIndex) {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                } else {
                    el.style.opacity = Math.max(0, 1 - absP * 2).toString();
                    el.style.transform = `translateY(${absP * 15}px)`;
                }
            });
        });

        // Panel change triggers
        if (activeIndex !== J.activePanel) {
            J.activePanel = activeIndex;

            // Active class
            Array.from(panels).forEach((p, i) => p.classList.toggle('active', i === activeIndex));

            // Dots
            $$('.journey-dot').forEach((d, i) => d.classList.toggle('active', i === activeIndex));

            // Show title chars
            J.titleChars.forEach((chars, i) => {
                if (!chars) return;
                chars.forEach(s => { s.style.opacity = i === activeIndex ? '1' : '0.3'; });
            });

            // Digit roll on stacked stats
            const statEls = panels[activeIndex].querySelectorAll('.journey-stat-number');
            if (statEls.length && !J.countedUp.has(activeIndex)) {
                J.countedUp.add(activeIndex);
                statEls.forEach((el, i) => {
                    setTimeout(() => digitRoll(el), 300 + i * 250);
                });
            }

            // Animate card bar fills
            const barFill = panels[activeIndex].querySelector('.journey-card-bar-fill');
            if (barFill) {
                barFill.style.width = '0%';
                requestAnimationFrame(() => {
                    barFill.style.width = barFill.style.getPropertyValue('--fill');
                });
            }
        }

        // Particles
        if (scrolled > 0 && scrolled < maxStick) {
            drawParticles(progress, performance.now() * 0.001);
        }

        // Snapping handled by snapToNearest() on scroll stop
    }

    // ============================================
    // PROJECTS
    // ============================================
    function updateProjects() {
        const scroll = getScroll();
        const vh = window.innerHeight;
        dom.projectShowcases.forEach((showcase) => {
            const rect = getOffsetRect(showcase);
            const top = rect.top - scroll;
            if (top < vh * 0.8 && top > -rect.height) {
                const progress = 1 - (top / (vh * 0.8));
                showcase.style.transform = `translateY(${Math.max(0, 40 * (1 - progress))}px)`;
                showcase.style.opacity = Math.min(1, progress * 1.5);
            }
        });
    }

    // ============================================
    // INTERSECTION OBSERVER
    // ============================================
    function initRevealObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const delay = parseInt(entry.target.dataset.delay) || 0;
                    setTimeout(() => entry.target.classList.add('revealed'), delay);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

        if (dom.personalHeading) observer.observe(dom.personalHeading);
        dom.personalItems.forEach((item, i) => { item.dataset.delay = i * 100; observer.observe(item); });
        if (dom.writingHeading) observer.observe(dom.writingHeading);
        dom.writingLinks.forEach((link, i) => { link.dataset.delay = i * 120; observer.observe(link); });
        if (dom.instaHeader) observer.observe(dom.instaHeader);
        if (dom.instaEmbed) { dom.instaEmbed.dataset.delay = 200; observer.observe(dom.instaEmbed); }
        if (dom.linkedinTop) observer.observe(dom.linkedinTop);
        dom.linkedinPosts.forEach((post, i) => { post.dataset.delay = i * 150; observer.observe(post); });
        if (dom.contactHeading) observer.observe(dom.contactHeading);
        if (dom.contactEmail) observer.observe(dom.contactEmail);
        if (dom.contactStats) { dom.contactStats.dataset.delay = 200; observer.observe(dom.contactStats); }
        dom.contactSocials.forEach((social, i) => { social.dataset.delay = 400 + i * 80; observer.observe(social); });
        if (dom.contactLocation) { dom.contactLocation.dataset.delay = 700; observer.observe(dom.contactLocation); }
    }

    // ============================================
    // UTILITY
    // ============================================
    function getOffsetRect(el) {
        if (!el) return { top: 0, height: 0 };
        let top = 0, height = el.offsetHeight, current = el;
        while (current) { top += current.offsetTop; current = current.offsetParent; }
        return { top, height };
    }

    // ============================================
    // LOOP
    // ============================================
    function loop() {
        updateSmoothScroll();
        updateHero();
        updateIntro();
        updateJourney();
        updateProjects();
        requestAnimationFrame(loop);
    }

    function init() {
        initSmoothScroll();
        initHero();
        initJourney();
        initRevealObserver();
        state.isReady = true;
        requestAnimationFrame(loop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
