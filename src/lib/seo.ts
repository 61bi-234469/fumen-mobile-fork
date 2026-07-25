export interface SeoMetadata {
    language: 'en' | 'ja';
    title: string;
    description: string;
}

const setMetaContent = (selector: string, content: string): void => {
    const element = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (element !== null) {
        element.content = content;
    }
};

export const syncSeoMetadata = ({ language, title, description }: SeoMetadata): void => {
    document.documentElement.lang = language;
    document.title = title;

    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:locale"]', language === 'ja' ? 'ja_JP' : 'en_US');
    setMetaContent('meta[property="og:locale:alternate"]', language === 'ja' ? 'en_US' : 'ja_JP');
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
};
