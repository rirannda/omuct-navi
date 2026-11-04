import { describe, expect, it } from 'vitest';
import { createGeolocationProjection } from '../geolocationProjection';
import type { GeolocationReferencePoint } from '../geolocationProjection';
import { geolocationReferencePoints } from '../../../data/geolocation';

// テスト専用の仮想的な校内図です。実際のキャンパスの位置ではありません。
const references: GeolocationReferencePoint[] = [
	{ latitude: 35, longitude: 135, x: 400, y: 500 },
	{ latitude: 35, longitude: 135.001, x: 500, y: 520 },
	{ latitude: 35.001, longitude: 135, x: 380, y: 600 }
];

describe('geolocation projection', () => {
	it('提供された衛星写真の3点を、SVGと上下反転した実際の地図の角へ対応させる', () => {
		const projection = createGeolocationProjection(geolocationReferencePoints)!;
		const corners = [
			{ latitude: 34.76902777777778, longitude: 135.62886111111112, x: 610, y: 133.5 },
			{ latitude: 34.7705, longitude: 135.63072222222223, x: 1250, y: 843.5 },
			{ latitude: 34.77019444444444, longitude: 135.6288888888889, x: 581, y: 672.5 }
		];
		for (const corner of corners) {
			const actual = projection.project(corner)!;
			expect(actual.x).toBeCloseTo(corner.x, 5);
			expect(actual.y).toBeCloseTo(corner.y, 5);
		}
	});
	it('回転・縦横比の異なる校内図でも3つの基準点と中間点を再現する', () => {
		const projection = createGeolocationProjection(references)!;
		for (const point of references) {
			const projected = projection.project(point)!;
			expect(projected.x).toBeCloseTo(point.x, 5);
			expect(projected.y).toBeCloseTo(point.y, 5);
		}
		const middle = projection.project({ latitude: 35.0005, longitude: 135.0005 }, 5)!;
		expect(middle.x).toBeCloseTo(440, 5);
		expect(middle.y).toBeCloseTo(560, 5);
		expect(middle.accuracy).toBeCloseTo(5 * projection.unitsPerMeter);
	});
	it('未設定・一直線・不正な基準点で位置を推測しない', () => {
		expect(createGeolocationProjection([])).toBeNull();
		expect(createGeolocationProjection(references.slice(0, 2))).toBeNull();
		expect(createGeolocationProjection([references[0], references[0], references[2]])).toBeNull();
		expect(createGeolocationProjection(references.map((point) => ({ ...point, y: 0 })))).toBeNull();
		expect(
			createGeolocationProjection([{ ...references[0], latitude: 100 }, ...references.slice(1)])
		).toBeNull();
	});
	it('不正な測位結果と精度を拒否し、地図の範囲外を勝手に丸めない', () => {
		const projection = createGeolocationProjection(references)!;
		expect(projection.project({ latitude: NaN, longitude: 135 })).toBeNull();
		expect(projection.project(references[0], -1)).toBeNull();
		expect(projection.project(references[0], Infinity)).toBeNull();
		expect(projection.project({ latitude: 36, longitude: 135 })!.y).toBeGreaterThan(1700);
	});
});
