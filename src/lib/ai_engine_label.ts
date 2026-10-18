import { AiEngineId } from './ai_engine';
import { i18n } from '../locales/keys';

// 画面に出すエンジン名。AI メニュー・リプレイ解析・INPUT ガイド・リプレイのゴーストで共通にする。
export const aiEngineDisplayName = (engine: AiEngineId): string => (
    engine === 'soldSlear' ? i18n.ColdClear.EngineSoldSlear() : i18n.ColdClear.EngineColdClear()
);

// 細い列に収めるときの略称
export const aiEngineShortName = (engine: AiEngineId): string => (
    engine === 'soldSlear' ? i18n.ColdClear.EngineSoldSlearShort() : i18n.ColdClear.EngineColdClearShort()
);
