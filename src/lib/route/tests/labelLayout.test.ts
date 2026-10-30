import { describe, expect, it } from 'vitest';
import { layoutRouteLabels } from '../labelLayout';
import type { LabelBounds, RouteLabel } from '../labelLayout';

function intersects(a: LabelBounds, b: LabelBounds): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('layoutRouteLabels', () => {
	it('重ならない案内の位置は維持する', () => {
		expect(
			layoutRouteLabels([{ x: 100, y: 50, width: 120, height: 32, anchorX: 74, anchorY: 66 }], {
				width: 400,
				height: 300
			})
		).toEqual([{ x: 100, y: 50, width: 120, height: 32 }]);
	});

	it('同じ位置の案内を複数並べても重ならず、スマートフォン幅に収まる', () => {
		const labels: RouteLabel[] = Array.from({ length: 8 }, () => ({
			x: 170,
			y: 260,
			width: 145,
			height: 36,
			anchorX: 144,
			anchorY: 278
		}));
		const obstacles = [{ x: 20, y: 390, width: 100, height: 190 }];
		const placements = layoutRouteLabels(labels, { width: 320, height: 600 }, obstacles);
		for (const [index, rect] of placements.entries()) {
			expect(rect.x).toBeGreaterThanOrEqual(0);
			expect(rect.x + rect.width).toBeLessThanOrEqual(320);
			expect(rect.y).toBeGreaterThanOrEqual(0);
			expect(rect.y + rect.height).toBeLessThanOrEqual(600);
			expect(placements.slice(0, index).some((other) => intersects(rect, other))).toBe(false);
			expect(obstacles.some((other) => intersects(rect, other))).toBe(false);
		}
	});

	it('画面端の吹き出しを画面内へ移し、すでにあるPOI名を避ける', () => {
		const obstacle = { x: 120, y: 20, width: 140, height: 40 };
		const [rect] = layoutRouteLabels(
			[{ x: 290, y: -20, width: 150, height: 40, anchorX: 290, anchorY: 20 }],
			{ width: 320, height: 300 },
			[obstacle]
		);
		expect(rect.x + rect.width).toBeLessThanOrEqual(320);
		expect(rect.y).toBeGreaterThanOrEqual(0);
		expect(intersects(rect, obstacle)).toBe(false);
	});
});
