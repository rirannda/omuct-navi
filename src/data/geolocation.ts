import type { GeolocationReferencePoint } from '../lib/map/geolocationProjection';

export const geolocationReferenceSource = {
	name: '地理院地図（国土地理院）',
	layer: '全国最新写真（シームレス）',
	photographyPeriod: '2021年5月〜7月',
	url: 'https://maps.gsi.go.jp/development/ichiran.html'
} as const;

/**
 * 地理院地図の写真から利用者が読み取った3点です。撮影期間と共有URLはdocs/geolocation.mdに記録しています。
 * xはSVGと同じ、yは1700 - SVGのy。既存のSVG対応を維持し、現地での精度確認は未実施です。
 */
export const geolocationReferencePoints: readonly GeolocationReferencePoint[] = [
	{
		// 正門の左下: main-gate.svg #main-gate_2 の (610, 1566.5)
		latitude: 34.769008,
		longitude: 135.628851,
		x: 610,
		y: 1700 - 1566.5
	},
	{
		// 工場棟の右上: master.svg #fac-bldg_1 の (1250, 856.5)
		latitude: 34.770464,
		longitude: 135.630723,
		x: 1250,
		y: 1700 - 856.5
	},
	{
		// 教養棟の右上: master.svg #la-bldg の (581, 1027.5)
		latitude: 34.770153,
		longitude: 135.628901,
		x: 581,
		y: 1700 - 1027.5
	}
];
