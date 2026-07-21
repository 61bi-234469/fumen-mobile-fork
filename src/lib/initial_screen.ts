export type InitialScreenSetting = 'reader' | 'editor' | 'list' | 'tree';

// 旧設定 skipReaderMode(boolean) からの移行読み取り。保存し直すと新キーのみになる。
export const initialScreenSettingFrom = (settings: any): InitialScreenSetting => {
    const value = settings?.initialScreen;
    if (value === 'reader' || value === 'editor' || value === 'list' || value === 'tree') {
        return value;
    }
    return settings?.skipReaderMode === true ? 'editor' : 'reader';
};
