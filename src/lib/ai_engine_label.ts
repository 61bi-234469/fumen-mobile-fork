import { AiEngineId } from './ai_engine';
import { i18n } from '../locales/keys';
import { SOLD_SLEAR_VERSION } from './sold_slear/profile';

// 画面に出すエンジン名。AI メニュー・リプレイ解析・INPUT ガイド・リプレイのゴーストで共通にする。
// Sold Slear は同梱している版を付ける。
export const aiEngineDisplayName = (engine: AiEngineId): string => (
    engine === 'soldSlear' ? i18n.ColdClear.EngineSoldSlear(SOLD_SLEAR_VERSION) : i18n.ColdClear.EngineColdClear()
);

// 細い列に収めるときの略称
export const aiEngineShortName = (engine: AiEngineId): string => (
    engine === 'soldSlear' ? i18n.ColdClear.EngineSoldSlearShort() : i18n.ColdClear.EngineColdClearShort()
);
