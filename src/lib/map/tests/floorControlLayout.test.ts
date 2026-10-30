import { describe, expect, it } from 'vitest';
import { layoutFloorControls, MAX_FLOOR_CONTROL_LINE_LENGTH } from '../floorControlLayout';
import type { FloorControlBuilding, FloorControlSide } from '../floorControlLayout';
import type { LabelBounds } from '../../route/labelLayout';

function intersects(a: LabelBounds, b: LabelBounds): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const target: FloorControlBuilding = { id: 'target', x: 200, y: 200, width: 100, height: 100 };
const walls: Record<FloorControlSide, FloorControlBuilding> = {
	top: { id: 'north', x: 0, y: 0, width: 600, height: 188 },
	right: { id: 'east', x: 312, y: 0, width: 288, height: 600 },
	bottom: { id: 'south', x: 0, y: 312, width: 600, height: 288 },
	left: { id: 'west', x: 0, y: 0, width: 188, height: 600 }
};

describe('layoutFloorControls', () => {
	it('上端にある建物のUIも上から50px以上離して配置する', () => {
		for (const height of [600, 118]) {
			const [position] = layoutFloorControls(
				[{ id: 'target', width: 80, height: 60 }],
				[{ id: 'target', x: 150, y: 0, width: 100, height: 40 }],
				{ width: 390, height }
			);
			expect(position.y).toBeGreaterThanOrEqual(50);
			expect(position.y + position.height).toBeLessThanOrEqual(height - 8);
			expect(
				Math.hypot(position.anchorX - position.lineX, position.anchorY - position.lineY)
			).toBeLessThanOrEqual(MAX_FLOOR_CONTROL_LINE_LENGTH);
		}
	});

	it('上端50pxと下端の余白を確保できないUIは配置しない', () => {
		expect(
			layoutFloorControls([{ id: 'target', width: 80, height: 60 }], [target], {
				width: 390,
				height: 117
			})
		).toEqual([]);
	});

	it.each(['top', 'right', 'bottom', 'left'] as const)(
		'他の建物がない%s側の辺へスナップする',
		(side) => {
			const buildings = [
				target,
				...Object.entries(walls)
					.filter(([key]) => key !== side)
					.map(([, wall]) => wall)
			];
			const [position] = layoutFloorControls([{ id: 'target', width: 80, height: 40 }], buildings, {
				width: 600,
				height: 600
			});
			expect(position.side).toBe(side);
			expect(buildings.some((building) => intersects(position, building))).toBe(false);
			expect(position.x).toBeGreaterThanOrEqual(0);
			expect(position.y).toBeGreaterThanOrEqual(0);
			expect(position.x + position.width).toBeLessThanOrEqual(600);
			expect(position.y + position.height).toBeLessThanOrEqual(600);
			if (side === 'left' || side === 'right') {
				expect(position.anchorX).toBe(side === 'left' ? 200 : 300);
				expect(Math.abs(position.anchorX - position.lineX)).toBe(12);
			} else {
				expect(position.anchorY).toBe(side === 'top' ? 200 : 300);
				expect(Math.abs(position.anchorY - position.lineY)).toBe(12);
			}
		}
	);

	it('画面端の建物やUIが複数あってもパネル同士と操作ボタンを重ねず画面内へ収める', () => {
		const buildings = Array.from({ length: 6 }, (_, index) => ({
			id: `building-${index}`,
			x: -40 + index * 20,
			y: 150 + index * 25,
			width: 160,
			height: 80
		}));
		const controls = buildings.map(({ id }) => ({ id, width: 120, height: 60 }));
		const obstacles = [{ x: 8, y: 8, width: 36, height: 70 }];
		const positions = layoutFloorControls(
			controls,
			buildings,
			{ width: 390, height: 600 },
			obstacles
		);
		expect(positions.length).toBe(controls.length);
		for (const [index, position] of positions.entries()) {
			expect(position.x).toBeGreaterThanOrEqual(0);
			expect(position.y).toBeGreaterThanOrEqual(0);
			expect(position.x + position.width).toBeLessThanOrEqual(390);
			expect(position.y + position.height).toBeLessThanOrEqual(600);
			expect(positions.slice(0, index).some((other) => intersects(position, other))).toBe(false);
			expect(obstacles.some((other) => intersects(position, other))).toBe(false);
			expect(position.anchorX).toBeGreaterThanOrEqual(0);
			expect(position.anchorY).toBeGreaterThanOrEqual(0);
			expect(
				Math.hypot(position.anchorX - position.lineX, position.anchorY - position.lineY)
			).toBeLessThanOrEqual(MAX_FLOOR_CONTROL_LINE_LENGTH);
		}
	});

	it('遠方の空白へ飛ばさず、食堂の南東で図書館UIの下に配置し直す', () => {
		const cafe = { id: 'cafe', x: 160, y: 300, width: 80, height: 60 };
		const libraryControl = { x: 252, y: 272, width: 80, height: 90 };
		const buildings = [
			cafe,
			{ id: 'north', x: 0, y: 100, width: 360, height: 188 },
			{ id: 'west', x: 0, y: 288, width: 148, height: 312 },
			{ id: 'south', x: 148, y: 372, width: 104, height: 228 },
			{ id: 'southeast', x: 252, y: 430, width: 108, height: 170 }
		];
		const [position] = layoutFloorControls(
			[{ id: 'cafe', width: 80, height: 60 }],
			buildings,
			{ width: 360, height: 600 },
			[libraryControl]
		);
		expect(position.x).toBeGreaterThanOrEqual(cafe.x + cafe.width);
		expect(position.y).toBeGreaterThanOrEqual(cafe.y + cafe.height);
		expect(position.y).toBeGreaterThanOrEqual(libraryControl.y + libraryControl.height);
		expect(intersects(position, libraryControl)).toBe(false);
		expect(
			Math.hypot(position.anchorX - position.lineX, position.anchorY - position.lineY)
		).toBeLessThanOrEqual(MAX_FLOOR_CONTROL_LINE_LENGTH);
	});

	it('L字形の外接矩形でなく実際の輪郭から測った接続線を上限以内にする', () => {
		const outline = [
			{ x: 120, y: 80 },
			{ x: 140, y: 80 },
			{ x: 140, y: 520 },
			{ x: 360, y: 520 },
			{ x: 360, y: 540 },
			{ x: 120, y: 540 }
		];
		const [position] = layoutFloorControls(
			[{ id: 'bridge', width: 80, height: 60 }],
			[{ id: 'bridge', x: 120, y: 80, width: 240, height: 460, outline }],
			{ width: 600, height: 600 },
			[
				{ x: 0, y: 0, width: 600, height: 160 },
				{ x: 0, y: 540, width: 600, height: 60 }
			]
		);
		expect(outline).toContainEqual({ x: position.anchorX, y: position.anchorY });
		expect(
			Math.hypot(position.anchorX - position.lineX, position.anchorY - position.lineY)
		).toBeLessThanOrEqual(MAX_FLOOR_CONTROL_LINE_LENGTH);
	});

	it('重なりの条件が同じなら前回のスナップ辺を維持する', () => {
		const [position] = layoutFloorControls(
			[{ id: 'target', width: 60, height: 60, previousSide: 'left' }],
			[target],
			{ width: 600, height: 600 }
		);
		expect(position.side).toBe('left');
	});
});
