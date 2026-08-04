type ThumbnailElement = HTMLImageElement | SVGImageElement;
type ThumbnailSource = () => string;

interface RegisteredThumbnail {
    source: ThumbnailSource;
    visible: boolean;
}

const registrations = new Map<ThumbnailElement, RegisteredThumbnail>();
const observers = new Map<Element | null, IntersectionObserver>();

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
            registrations.set(element, { source, visible: false });
            getObserver(findScrollRoot(element)).observe(element);
        },
        onupdate: update,
        ondestroy: (element: ThumbnailElement) => {
            registrations.delete(element);
            observers.forEach((observer) => {
                observer.unobserve(element);
            });
        },
    };
};
