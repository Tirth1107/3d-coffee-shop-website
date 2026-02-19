/* ========================================
   TIRTH JOSHI — Premium Coffee Website
   Enhanced Main Script (ES Module)
   Three.js • Scroll Rig • Anime.js
   ======================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import anime from 'animejs';

// ─── CONSTANTS ─────────────────────────────────
const LERP_FACTOR = 0.055;
const MOUSE_LERP = 0.025;
const MOUSE_RANGE_X = 0.3;
const MOUSE_RANGE_Y = 0.2;
const BASE_CAM_Z = 5;
const SECTION_COLORS = ['#0f0f0f', '#2C1A0E', '#1A2E1A', '#0D1B2A', '#080808'];
const IS_MOBILE = window.innerWidth < 768;
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ─── RESPONSIVE KEYFRAMES ──────────────────────
// Adjusted positions for mobile (smaller offsets)
const DESKTOP_KEYFRAMES = [
    { pos: [0, 0, 0], rotY: 0, tiltX: 0, scale: 1.0 },
    { pos: [1.8, 0, 0], rotY: Math.PI / 4, tiltX: -0.26, scale: 1.0 },
    { pos: [-1.8, 0, 0], rotY: Math.PI, tiltX: 0, scale: 1.0 },
    { pos: [0, 0, 1], rotY: Math.PI * 1.5, tiltX: 0, scale: 1.5 },
    { pos: [0, 1.2, 0], rotY: Math.PI * 2, tiltX: 0, scale: 0.6 },
];

const MOBILE_KEYFRAMES = [
    { pos: [0, 0.3, 0], rotY: 0, tiltX: 0, scale: 0.8 },
    { pos: [0.6, 0.8, 0], rotY: Math.PI / 4, tiltX: -0.15, scale: 0.7 },
    { pos: [-0.6, 0.8, 0], rotY: Math.PI, tiltX: 0, scale: 0.7 },
    { pos: [0, 0.3, 0.5], rotY: Math.PI * 1.5, tiltX: 0, scale: 1.0 },
    { pos: [0, 1.0, 0], rotY: Math.PI * 2, tiltX: 0, scale: 0.5 },
];

let KEYFRAMES = IS_MOBILE ? MOBILE_KEYFRAMES : DESKTOP_KEYFRAMES;

// ─── STATE ─────────────────────────────────────
const state = {
    scrollProgress: 0,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    heroSpin: 0,
    model: null,
    loaded: false,
    // Interactive drag
    isDragging: false,
    dragRotX: 0,
    dragRotY: 0,
    dragStartX: 0,
    dragStartY: 0,
    dragBaseRotX: 0,
    dragBaseRotY: 0,
    // Current section index
    currentSection: 0,
};

// Current model transform (lerped)
const current = {
    posX: 0, posY: 0, posZ: 0,
    rotY: 0, tiltX: 0,
    scale: 1.0,
};

// Target model transform
const target = { ...current };

// ─── THREE.JS SETUP ────────────────────────────
const canvas = document.getElementById('webgl');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_MOBILE, // disable antialiasing on mobile for performance
    alpha: true,
    powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    IS_MOBILE ? 50 : 45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(0, 0, BASE_CAM_Z);

// ─── LIGHTING ──────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfff5e6, 3);
dirLight.position.set(2, 4, 3);
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 0.8);
rimLight.position.set(-3, 1, -2);
scene.add(rimLight);

// Subtle bottom fill light
const fillLight = new THREE.DirectionalLight(0xffeedd, 0.4);
fillLight.position.set(0, -2, 2);
scene.add(fillLight);

// ─── LOAD MODEL ────────────────────────────────
const loader = new GLTFLoader();
const loaderBar = document.getElementById('loader-bar');
const loaderText = document.getElementById('loader-text');
const loaderScreen = document.getElementById('loader');

loader.load(
    'scene.gltf',
    (gltf) => {
        const model = gltf.scene;

        // Center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredHeight = IS_MOBILE ? 1.4 : 1.8;
        const scaleFactor = desiredHeight / maxDim;

        model.position.sub(center);
        model.scale.setScalar(scaleFactor);

        const wrapper = new THREE.Group();
        wrapper.add(model);
        scene.add(wrapper);

        state.model = wrapper;
        state.loaded = true;

        // Enhance materials
        model.traverse((child) => {
            if (child.isMesh) {
                child.material.envMapIntensity = 0.5;
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
            }
        });

        // Hide loader with smooth transition
        setTimeout(() => {
            loaderScreen.classList.add('loaded');
            setTimeout(() => initAnimations(), 300);
        }, 500);
    },
    (progress) => {
        if (progress.total > 0) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            loaderBar.style.width = pct + '%';
            loaderText.textContent = pct + '%';
        }
    },
    (error) => {
        console.error('Model loading error:', error);
        loaderText.textContent = 'ERROR';
    }
);

// ─── SCROLL TRACKING ──────────────────────────
const scrollProgressBar = document.getElementById('scroll-progress');
const backToTopBtn = document.getElementById('back-to-top');

function getScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    return docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;
}

window.addEventListener('scroll', () => {
    state.scrollProgress = getScrollProgress();

    // Scroll progress bar
    scrollProgressBar.style.width = (state.scrollProgress * 100) + '%';

    // Update background color
    updateBackgroundColor(state.scrollProgress);

    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    if (state.scrollProgress > 0.02) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    // Back to top button
    if (state.scrollProgress > 0.15) {
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
    }

    // Update section indicator dots
    updateSectionDots(state.scrollProgress);
}, { passive: true });

// ─── SECTION DOTS ──────────────────────────────
const dots = document.querySelectorAll('.dot');

function updateSectionDots(progress) {
    const newSection = Math.min(Math.floor(progress * 5), 4);
    if (newSection !== state.currentSection) {
        state.currentSection = newSection;
        dots.forEach((dot, i) => {
            if (i === newSection) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
}

// ─── BACKGROUND COLOR INTERPOLATION ───────────
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function lerpColor(c1, c2, t) {
    return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];
}

function updateBackgroundColor(progress) {
    const segmentCount = SECTION_COLORS.length - 1;
    const segment = progress * segmentCount;
    const idx = Math.min(Math.floor(segment), segmentCount - 1);
    const t = segment - idx;

    const from = hexToRgb(SECTION_COLORS[idx]);
    const to = hexToRgb(SECTION_COLORS[idx + 1]);
    const blended = lerpColor(from, to, t);

    document.body.style.backgroundColor = `rgb(${blended[0]},${blended[1]},${blended[2]})`;
}

// ─── COMPUTE SCROLL TARGETS ────────────────────
function computeScrollTargets(progress) {
    const kfProgress = progress * (KEYFRAMES.length - 1);
    const idx = Math.min(Math.floor(kfProgress), KEYFRAMES.length - 2);
    const t = kfProgress - idx;

    const a = KEYFRAMES[idx];
    const b = KEYFRAMES[idx + 1];

    // Smoothstep easing
    const ease = t * t * (3 - 2 * t);

    target.posX = a.pos[0] + (b.pos[0] - a.pos[0]) * ease;
    target.posY = a.pos[1] + (b.pos[1] - a.pos[1]) * ease;
    target.posZ = a.pos[2] + (b.pos[2] - a.pos[2]) * ease;
    target.rotY = a.rotY + (b.rotY - a.rotY) * ease;
    target.tiltX = a.tiltX + (b.tiltX - a.tiltX) * ease;
    target.scale = a.scale + (b.scale - a.scale) * ease;

    // Hero continuous spin
    if (progress < 0.2) {
        const heroBlend = 1 - (progress / 0.2);
        state.heroSpin += 0.003 * heroBlend;
        target.rotY += state.heroSpin;
    }
}

// ─── MOUSE PARALLAX ────────────────────────────
if (!IS_TOUCH) {
    window.addEventListener('mousemove', (e) => {
        state.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        state.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });
}

// ─── INTERACTIVE DRAG (All Sections) ───────────
canvas.style.pointerEvents = 'auto';

canvas.addEventListener('pointerdown', (e) => {
    state.isDragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragBaseRotY = state.dragRotY;
    state.dragBaseRotX = state.dragRotX;
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('pointermove', (e) => {
    if (!state.isDragging) return;
    const dx = e.clientX - state.dragStartX;
    const dy = e.clientY - state.dragStartY;
    state.dragRotY = state.dragBaseRotY + dx * 0.008;
    state.dragRotX = state.dragBaseRotX + dy * 0.005;
    state.dragRotX = Math.max(-0.8, Math.min(0.8, state.dragRotX));
});

window.addEventListener('pointerup', () => {
    if (!state.isDragging) return;
    state.isDragging = false;
    canvas.style.cursor = 'grab';
});

// Prevent scroll while dragging on touch
canvas.addEventListener('touchstart', (e) => {
    // Allow the pointerdown to fire but prevent default only if needed
}, { passive: true });

// ─── ANIMATION LOOP ────────────────────────────
function lerp(a, b, t) {
    return a + (b - a) * t;
}

let lastTime = 0;

function animate(time) {
    requestAnimationFrame(animate);

    // Delta time for frame-rate independent animations
    const delta = Math.min((time - lastTime) / 16.67, 2); // normalize to 60fps
    lastTime = time;

    if (!state.loaded || !state.model) {
        renderer.render(scene, camera);
        return;
    }

    // Compute targets from scroll
    computeScrollTargets(state.scrollProgress);

    // Lerp current toward target (liquid smooth, frame-rate independent)
    const lf = 1 - Math.pow(1 - LERP_FACTOR, delta);
    current.posX = lerp(current.posX, target.posX, lf);
    current.posY = lerp(current.posY, target.posY, lf);
    current.posZ = lerp(current.posZ, target.posZ, lf);
    current.rotY = lerp(current.rotY, target.rotY, lf);
    current.tiltX = lerp(current.tiltX, target.tiltX, lf);
    current.scale = lerp(current.scale, target.scale, lf);

    // Apply position
    state.model.position.set(current.posX, current.posY, current.posZ);

    // Decay drag rotation when not dragging
    if (!state.isDragging) {
        const decay = Math.pow(0.95, delta);
        state.dragRotX *= decay;
        state.dragRotY *= decay;
        if (Math.abs(state.dragRotX) < 0.0005) state.dragRotX = 0;
        if (Math.abs(state.dragRotY) < 0.0005) state.dragRotY = 0;
    }

    // Mouse-following tilt
    const ml = 1 - Math.pow(1 - MOUSE_LERP, delta);
    state.mouseX = lerp(state.mouseX, state.targetMouseX, ml);
    state.mouseY = lerp(state.mouseY, state.targetMouseY, ml);

    const mouseTiltY = state.mouseX * 0.12;
    const mouseTiltX = -state.mouseY * 0.08;

    // Final rotation: scroll + drag + mouse tilt
    state.model.rotation.set(
        current.tiltX + state.dragRotX + mouseTiltX,
        current.rotY + state.dragRotY + mouseTiltY,
        0
    );
    state.model.scale.setScalar(current.scale);

    // Camera parallax
    camera.position.x = state.mouseX * MOUSE_RANGE_X;
    camera.position.y = state.mouseY * MOUSE_RANGE_Y;
    camera.position.z = BASE_CAM_Z;
    camera.lookAt(current.posX * 0.3, current.posY * 0.3, 0);

    renderer.render(scene, camera);
}

animate(0);

// ─── RESIZE HANDLER ────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));

        // Switch keyframes on breakpoint change
        const nowMobile = window.innerWidth < 768;
        KEYFRAMES = nowMobile ? MOBILE_KEYFRAMES : DESKTOP_KEYFRAMES;
        camera.fov = nowMobile ? 50 : 45;
        camera.updateProjectionMatrix();
    }, 150);
});

// ─── SECTION ANIMATIONS (Anime.js + IntersectionObserver) ──
function splitTextIntoChars(element) {
    const text = element.textContent;
    element.textContent = '';
    element.setAttribute('aria-label', text);

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ' || char === '\n') {
            const space = document.createElement('span');
            space.className = 'char-space';
            space.innerHTML = '&nbsp;';
            element.appendChild(space);
        } else {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char;
            element.appendChild(span);
        }
    }
}

function initAnimations() {
    // Split text elements
    document.querySelectorAll('.anim-chars').forEach((el) => {
        if (el.children.length > 0) {
            Array.from(el.childNodes).forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    const wrapper = document.createElement('span');
                    wrapper.style.display = 'inline';
                    const text = child.textContent;
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        if (char === ' ' || char === '\n') {
                            const space = document.createElement('span');
                            space.className = 'char-space';
                            space.innerHTML = '&nbsp;';
                            wrapper.appendChild(space);
                        } else {
                            const span = document.createElement('span');
                            span.className = 'char';
                            span.textContent = char;
                            wrapper.appendChild(span);
                        }
                    }
                    child.replaceWith(wrapper);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    splitTextIntoChars(child);
                }
            });
        } else {
            splitTextIntoChars(el);
        }
    });

    // Intersection observer for section reveals
    const sections = document.querySelectorAll('.section');
    const observedSections = new Set();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && !observedSections.has(entry.target.id)) {
                observedSections.add(entry.target.id);
                revealSection(entry.target);
            }
        });
    }, {
        threshold: IS_MOBILE ? 0.15 : 0.25,
        rootMargin: '0px',
    });

    sections.forEach((section) => observer.observe(section));

    // Auto-reveal hero
    setTimeout(() => {
        revealSection(document.getElementById('hero'));
        observedSections.add('hero');
    }, 400);

    // Init particles
    createParticles();
}

function revealSection(section) {
    const chars = section.querySelectorAll('.char');
    if (chars.length > 0) {
        anime({
            targets: chars,
            opacity: [0, 1],
            translateY: [30, 0],
            rotateX: [-30, 0],
            duration: 900,
            delay: anime.stagger(20, { start: 80 }),
            easing: 'easeOutExpo',
        });
    }

    const fades = section.querySelectorAll('.anim-fade');
    if (fades.length > 0) {
        anime({
            targets: fades,
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 1100,
            delay: anime.stagger(120, { start: chars.length * 15 + 250 }),
            easing: 'easeOutQuart',
        });
    }

    // Animate section number badge
    const badge = section.querySelector('.section-num');
    if (badge) {
        anime({
            targets: badge,
            scale: [0, 1],
            opacity: [0, 1],
            rotate: ['-45deg', '0deg'],
            duration: 600,
            delay: 200,
            easing: 'easeOutBack',
        });
    }
}

// ─── FLOATING PARTICLES ────────────────────────
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const count = IS_MOBILE ? 12 : 25;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 3 + 1;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.background = `rgba(251, 191, 36, ${Math.random() * 0.3 + 0.1})`;
        container.appendChild(particle);

        // Animate each particle with anime.js
        animateParticle(particle);
    }
}

function animateParticle(el) {
    const duration = Math.random() * 8000 + 6000;
    anime({
        targets: el,
        translateY: [0, -(Math.random() * 200 + 100)],
        translateX: [0, (Math.random() - 0.5) * 100],
        opacity: [0, Math.random() * 0.4 + 0.1, 0],
        duration: duration,
        easing: 'easeInOutSine',
        loop: true,
        delay: Math.random() * 5000,
    });
}

// ─── MAGNETIC BUTTON ───────────────────────────
const magneticBtn = document.getElementById('order-btn');
if (magneticBtn && !IS_TOUCH) {
    const inner = magneticBtn.querySelector('.magnetic-btn-inner');

    magneticBtn.addEventListener('mousemove', (e) => {
        const rect = magneticBtn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        anime({
            targets: inner,
            translateX: x * 0.35,
            translateY: y * 0.35,
            duration: 350,
            easing: 'easeOutCubic',
        });
    });

    magneticBtn.addEventListener('mouseleave', () => {
        anime({
            targets: inner,
            translateX: 0,
            translateY: 0,
            duration: 700,
            easing: 'easeOutElastic(1, 0.5)',
        });
    });
}

// ─── MOBILE MENU ───────────────────────────────
const mobileToggle = document.getElementById('mobile-toggle');
const mobileMenu = document.getElementById('mobile-menu');
let menuOpen = false;

if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
        menuOpen = !menuOpen;
        if (menuOpen) {
            mobileMenu.className = 'md:hidden mobile-menu-open';
            mobileToggle.querySelector('svg').style.transform = 'rotate(90deg)';
        } else {
            mobileMenu.className = 'md:hidden mobile-menu-closed';
            mobileToggle.querySelector('svg').style.transform = 'rotate(0deg)';
        }
    });

    // Close menu on link click
    mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            menuOpen = false;
            mobileMenu.className = 'md:hidden mobile-menu-closed';
            mobileToggle.querySelector('svg').style.transform = 'rotate(0deg)';
        });
    });
}

// ─── SMOOTH SCROLL FOR ALL NAV LINKS ───────────
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const id = anchor.getAttribute('href');
        const el = document.querySelector(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ─── BACK TO TOP ───────────────────────────────
if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ─── INTERACTIVE TILT CARDS ────────────────────
if (!IS_TOUCH) {
    document.querySelectorAll('.tilt-card').forEach((card) => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const normX = (x - centerX) / centerX;
            const normY = (y - centerY) / centerY;

            const rotateY = normX * 10;
            const rotateX = -normY * 7;

            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            const section = card.closest('section');
            let defaultTransform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            if (section && section.id === 'caramel') {
                defaultTransform = 'perspective(800px) rotateY(3deg) rotateX(-1deg) scale3d(1, 1, 1)';
            } else if (section && section.id === 'matcha') {
                defaultTransform = 'perspective(800px) rotateY(-3deg) rotateX(-1deg) scale3d(1, 1, 1)';
            }

            anime({
                targets: card,
                rotateX: section && section.id === 'caramel' ? -1 : section && section.id === 'matcha' ? -1 : 0,
                rotateY: section && section.id === 'caramel' ? 3 : section && section.id === 'matcha' ? -3 : 0,
                scale: 1,
                duration: 700,
                easing: 'easeOutElastic(1, 0.6)',
                begin: () => { card.style.transition = 'none'; },
                complete: () => { card.style.transform = defaultTransform; }
            });
        });
    });
}

console.log('☕ Tirth Joshi — Crafted Excellence');
