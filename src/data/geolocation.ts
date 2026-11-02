import type { GeolocationReferencePoint } from '../lib/map/geolocationProjection';

/**
 * 衛星写真から読み取った暫定の3点です。実地のズレはここで補正します。
 * xはSVGと同じ、yは1700 - SVGのy。緯度・経度は提供された度分秒をそのまま変換します。
 */
export const geolocationReferencePoints: readonly GeolocationReferencePoint[] = [
	{
		// 正門の左下: main-gate.svg #main-gate_2 の (610, 1566.5)
		latitude: 34 + 46 / 60 + 8.5 / 3600,
		longitude: 135 + 37 / 60 + 43.9 / 3600,
		x: 610,
		y: 1700 - 1566.5
	},
	{
		// 工場棟の右上: 添付画像の長方形は master.svg #fac-bldg_1 の (1250, 856.5)
		latitude: 34 + 46 / 60 + 13.8 / 3600,
		longitude: 135 + 37 / 60 + 50.6 / 3600,
		x: 1250,
		y: 1700 - 856.5
	},
	{
		// 教養棟の右上: master.svg #la-bldg の (581, 1027.5)
		latitude: 34 + 46 / 60 + 12.7 / 3600,
		longitude: 135 + 37 / 60 + 44 / 3600,
		x: 581,
		y: 1700 - 1027.5
	}
];
