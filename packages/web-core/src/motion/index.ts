/**
 * @mixturemarketing/web-core/motion
 *
 * Vanilla JS animation utilities — wszystkie respektują prefers-reduced-motion.
 * CSS-only kiedy się da, JS tylko gdy wymagane (Intersection Observer, mouse follow, kinetic typo).
 *
 * Skill compatible: ui-patterns-2026 (mikrointerakcje, dark mode, kursory),
 *                   wcag-2.2 (focus, reduced-motion).
 *
 * Wszystkie funkcje są no-op gdy prefers-reduced-motion: reduce.
 */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const REDUCED_TRANSPARENCY = "(prefers-reduced-transparency: reduce)";
const COARSE_POINTER = "(pointer: coarse)";

/** Czy użytkownik chce mniej ruchu. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

/** Czy użytkownik chce mniej przezroczystości. Dla liquid-glass skill. */
export function prefersReducedTransparency(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCED_TRANSPARENCY).matches;
}

/** Czy urządzenie dotykowe (brak myszy precyzyjnej). */
export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COARSE_POINTER).matches;
}

// ---------------------------------------------------------------------------
// Scroll reveal — Intersection Observer wrapper, dodaje klasę 'is-revealed'
// gdy element wjeżdża do viewport. Animacja realizowana przez CSS.
// ---------------------------------------------------------------------------

export interface ScrollRevealOptions {
  /** Selector elementów do obserwacji. */
  selector?: string;
  /** Próg viewport (0-1). */
  threshold?: number;
  /** Margines viewport (np. "0px 0px -10% 0px" — startuje gdy 10% od dołu widoczne). */
  rootMargin?: string;
  /** Czy unobserve po pierwszym revealu (oszczędność CPU). */
  once?: boolean;
}

/**
 * Aktywuje scroll reveal dla elementów pasujących do selectora.
 * No-op gdy prefers-reduced-motion. Zwraca cleanup function.
 */
export function observeScrollReveal(opts: ScrollRevealOptions = {}): () => void {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    // Reduced motion: natychmiast pokazać wszystko bez animacji
    if (typeof document !== "undefined") {
      const sel = opts.selector ?? "[data-reveal]";
      document.querySelectorAll(sel).forEach((el) => el.classList.add("is-revealed"));
    }
    return () => { /* no-op */ };
  }
  if (!("IntersectionObserver" in window)) {
    // Fallback: pokaż wszystko od razu
    const sel = opts.selector ?? "[data-reveal]";
    document.querySelectorAll(sel).forEach((el) => el.classList.add("is-revealed"));
    return () => { /* no-op */ };
  }

  const selector = opts.selector ?? "[data-reveal]";
  const threshold = opts.threshold ?? 0.15;
  const rootMargin = opts.rootMargin ?? "0px 0px -10% 0px";
  const once = opts.once ?? true;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          if (once) observer.unobserve(entry.target);
        } else if (!once) {
          entry.target.classList.remove("is-revealed");
        }
      }
    },
    { threshold, rootMargin },
  );

  const elements = document.querySelectorAll<HTMLElement>(selector);
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  // Arm the elements — CSS hides them only when `data-reveal-armed` is present.
  // Above-the-fold elements skip arming + reveal immediately (no flash).
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < viewportH && rect.bottom > 0) {
      // Already visible — show without animation
      el.classList.add("is-revealed");
    } else {
      el.setAttribute("data-reveal-armed", "");
      observer.observe(el);
    }
  });

  return () => observer.disconnect();
}

// ---------------------------------------------------------------------------
// Count-up — animowane liczby gdy element wjeżdża do viewport
// ---------------------------------------------------------------------------

export interface CountUpOptions {
  /** Selector elementów z data-target="123" do animacji. */
  selector?: string;
  /** Czas animacji w ms. */
  duration?: number;
  /** Format prefix (np. "od ", "" itp.). */
  prefix?: string;
  /** Format suffix (np. "+", " zł"). */
  suffix?: string;
}

/**
 * Aktywuje count-up dla elementów `[data-count-target="123"]`.
 * No-op gdy prefers-reduced-motion (natychmiast pokazuje finalną liczbę).
 */
export function observeCountUp(opts: CountUpOptions = {}): () => void {
  if (typeof window === "undefined") return () => { /* no-op */ };

  const selector = opts.selector ?? "[data-count-target]";
  const duration = opts.duration ?? 1500;

  function setFinal(el: HTMLElement): void {
    const target = parseInt(el.dataset.countTarget ?? "0", 10);
    const prefix = el.dataset.countPrefix ?? opts.prefix ?? "";
    const suffix = el.dataset.countSuffix ?? opts.suffix ?? "";
    el.textContent = `${prefix}${target}${suffix}`;
  }

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    document.querySelectorAll<HTMLElement>(selector).forEach(setFinal);
    return () => { /* no-op */ };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const target = parseInt(el.dataset.countTarget ?? "0", 10);
        const prefix = el.dataset.countPrefix ?? opts.prefix ?? "";
        const suffix = el.dataset.countSuffix ?? opts.suffix ?? "";
        const start = performance.now();

        function tick(now: number): void {
          const t = Math.min(1, (now - start) / duration);
          // ease-out-quart
          const eased = 1 - Math.pow(1 - t, 4);
          const value = Math.floor(target * eased);
          el.textContent = `${prefix}${value}${suffix}`;
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      }
    },
    { threshold: 0.5 },
  );

  document.querySelectorAll<HTMLElement>(selector).forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

// ---------------------------------------------------------------------------
// Kinetic typo — rotating words. Use data-kinetic-words="WORD1|WORD2|WORD3"
// ---------------------------------------------------------------------------

export interface KineticTypeOptions {
  /** Selector elementów z data-kinetic-words. */
  selector?: string;
  /** Interwał między słowami (ms). */
  interval?: number;
  /** Czas fade swap (ms). */
  fade?: number;
}

/**
 * Aktywuje kinetic typography — rotujące słowa w elemencie.
 * Format: `<span data-kinetic-words="Cześć|Hi|Salut" data-kinetic-interval="2000">Cześć</span>`.
 * No-op gdy prefers-reduced-motion.
 */
export function activateKineticType(opts: KineticTypeOptions = {}): () => void {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    return () => { /* no-op */ };
  }

  const selector = opts.selector ?? "[data-kinetic-words]";
  const defaultInterval = opts.interval ?? 2200;
  const fade = opts.fade ?? 300;

  const timers: number[] = [];

  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const words = (el.dataset.kineticWords ?? "").split("|").filter(Boolean);
    if (words.length < 2) return;
    const interval = parseInt(el.dataset.kineticInterval ?? `${defaultInterval}`, 10);
    let idx = 0;
    el.style.transition = `opacity ${fade}ms ease-out`;
    el.style.display = "inline-block";

    const timerId = window.setInterval(() => {
      el.style.opacity = "0";
      window.setTimeout(() => {
        idx = (idx + 1) % words.length;
        el.textContent = words[idx]!;
        el.style.opacity = "1";
      }, fade);
    }, interval);

    timers.push(timerId);
  });

  return () => timers.forEach(window.clearInterval);
}

// ---------------------------------------------------------------------------
// Magnetic hover — przycisk "przyciąga" kursor (12% damping)
// Wyłączone na coarse pointer (dotyk) i reduced-motion.
// ---------------------------------------------------------------------------

export interface MagneticOptions {
  /** Selector elementów. */
  selector?: string;
  /** Siła przyciągania 0-1 (0.12 = 12% odchylenia). */
  strength?: number;
}

/**
 * Aktywuje magnetic hover dla CTA buttonów.
 * Format: `<button data-magnetic>...</button>`.
 * No-op na dotyku i reduced-motion.
 */
export function activateMagneticHover(opts: MagneticOptions = {}): () => void {
  if (typeof window === "undefined" || prefersReducedMotion() || isCoarsePointer()) {
    return () => { /* no-op */ };
  }

  const selector = opts.selector ?? "[data-magnetic]";
  const strength = opts.strength ?? 0.12;
  const handlers: Array<() => void> = [];

  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.style.transition = "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    el.style.willChange = "transform";

    const onMove = (e: MouseEvent): void => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };
    const onLeave = (): void => {
      el.style.transform = "translate3d(0, 0, 0)";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    handlers.push(() => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    });
  });

  return () => handlers.forEach((h) => h());
}

// ---------------------------------------------------------------------------
// Reading progress bar — pokazuje pasek u góry strony jak daleko klient zjechał
// ---------------------------------------------------------------------------

export interface ReadingProgressOptions {
  /** Selector contentu do trackowania (jeśli pominięte, używa document body). */
  contentSelector?: string;
  /** Selector elementu bar. */
  barSelector?: string;
}

/**
 * Aktywuje reading progress bar.
 * Format: `<div data-reading-progress style="position:fixed;top:0;left:0;height:4px;width:0;..."></div>`.
 * No-op gdy prefers-reduced-motion (bar pokazuje się, ale bez smooth transition).
 */
export function activateReadingProgress(opts: ReadingProgressOptions = {}): () => void {
  if (typeof window === "undefined") return () => { /* no-op */ };

  const bar = document.querySelector<HTMLElement>(opts.barSelector ?? "[data-reading-progress]");
  if (!bar) return () => { /* no-op */ };

  const content = opts.contentSelector
    ? document.querySelector<HTMLElement>(opts.contentSelector) ?? document.body
    : document.body;

  if (!prefersReducedMotion()) {
    bar.style.transition = "width 100ms linear";
  }

  function update(): void {
    const total = content.scrollHeight - window.innerHeight;
    if (total <= 0) {
      bar!.style.width = "0%";
      return;
    }
    const scrolled = window.scrollY;
    const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
    bar!.style.width = `${pct}%`;
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  return () => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}

// ---------------------------------------------------------------------------
// Auto-init helper — re-aktywuje wszystkie utility po każdym page load + Astro VT
// ---------------------------------------------------------------------------

export interface AutoInitOptions {
  scrollReveal?: boolean | ScrollRevealOptions;
  countUp?: boolean | CountUpOptions;
  kineticType?: boolean | KineticTypeOptions;
  magnetic?: boolean | MagneticOptions;
  readingProgress?: boolean | ReadingProgressOptions;
}

/**
 * Inicjalizuje wszystkie utilities + re-init po Astro View Transitions swap.
 */
export function autoInitMotion(opts: AutoInitOptions = {}): void {
  if (typeof window === "undefined") return;

  let cleanups: Array<() => void> = [];

  function init(): void {
    // Cleanup poprzednich observerów
    cleanups.forEach((c) => c());
    cleanups = [];

    if (opts.scrollReveal !== false) {
      const o = typeof opts.scrollReveal === "object" ? opts.scrollReveal : {};
      cleanups.push(observeScrollReveal(o));
    }
    if (opts.countUp !== false) {
      const o = typeof opts.countUp === "object" ? opts.countUp : {};
      cleanups.push(observeCountUp(o));
    }
    if (opts.kineticType !== false) {
      const o = typeof opts.kineticType === "object" ? opts.kineticType : {};
      cleanups.push(activateKineticType(o));
    }
    if (opts.magnetic !== false) {
      const o = typeof opts.magnetic === "object" ? opts.magnetic : {};
      cleanups.push(activateMagneticHover(o));
    }
    if (opts.readingProgress !== false) {
      const o = typeof opts.readingProgress === "object" ? opts.readingProgress : {};
      cleanups.push(activateReadingProgress(o));
    }
  }

  init();
  document.addEventListener("astro:after-swap", init);
}
