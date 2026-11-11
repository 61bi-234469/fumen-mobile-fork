type ThumbnailElement = HTMLImageElement | SVGImageElement;
type ThumbnailSource = () => string;

interface RegisteredThumbnail {
    source: ThumbnailSource;
    visible: boolean;
    root: Element | null;
}

const registrations = new Map<ThumbnailElement, RegisteredThumbnail>();
const observers = new Map<Element | null, IntersectionObserver>();
const observedCounts = new Map<Element | null, number>();

const applySource = (element: ThumbnailElement, source: ThumbnailSource): void => {
    const value = source();
    if (element instanceof HTMLImageElement) {
        element.src = value;
    } else {
        element.setAttribute('href', value);
    }
};

const findScrollRoot = (element: Element): Element | null => {
    let parent = element.parentElement;
    while (parent) {
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const overflow = window.getComputedStyle(parent).overflow;
            const overflowX = window.getComputedStyle(parent).overflowX;
            const overflowY = window.getComputedStyle(parent).overflowY;
            if (/(auto|scroll)/.test(`${overflow} ${overflowX} ${overflowY}`)) {
                return parent;
            }
        }
        parent = parent.parentElement;
    }
    return null;
};

const getObserver = (root: Element | null): IntersectionObserver => {
    const existing = observers.get(root);
    if (existing) {
        return existing;
    }
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const element = entry.target as ThumbnailElement;
            const registration = registrations.get(element);
            if (!registration) {
                continue;
            }
            registration.visible = entry.isIntersecting;
            if (registration.visible) {
                applySource(element, registration.source);
            }
        }
    }, { root, rootMargin: '150% 150%' });
    observers.set(root, observer);
    return observer;
};

export const lazyThumbnail = (source: ThumbnailSource) => {
    const update = (element: ThumbnailElement) => {
        const registration = registrations.get(element);
        if (!registration) {
            return;
        }
        registration.source = source;
        if (registration.visible) {
            applySource(element, source);
        }
    };

    return {
        oncreate: (element: ThumbnailElement) => {
            if (typeof IntersectionObserver === 'undefined') {
                applySource(element, source);
                return;
            }
            const root = findScrollRoot(element);
            registrations.set(element, { source, root, visible: false });
            getObserver(root).observe(element);
            observedCounts.set(root, (observedCounts.get(root) ?? 0) + 1);
        },
        onupdate: update,
        ondestroy: (element: ThumbnailElement) => {
            const registration = registrations.get(element);
            registrations.delete(element);
            observers.forEach((observer) => {
                observer.unobserve(element);
            });
            if (!registration) {
                return;
            }
            // 開閉するスクロール枠（サムネイルスライダーなど）の observer を残さない
            const { root } = registration;
            const remaining = (observedCounts.get(root) ?? 1) - 1;
            if (0 < remaining) {
                observedCounts.set(root, remaining);
                return;
            }
            observedCounts.delete(root);
            if (root !== null) {
                observers.get(root)?.disconnect();
                observers.delete(root);
            }
        },
    };
};
