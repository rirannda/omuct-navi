import { describe, expect, it } from 'vitest';
import type { Node } from '../../../data/types';
import { isPositionOnRoute } from '../routePosition';

const segment: Node[] = [
	{ id: 'a', buildingId: 'la', x: 100, y: 200, floor: 1 },
	{ id: 'b', buildingId: 'la', x: 200, y: 200, floor: 1 }
];
describe('route position', () => {
	it('ノード間の線分と端点までの距離で判定し、延長線上の位置を除外する', () => {
		expect(isPositionOnRoute({ x: 150, y: 205 }, [segment], { la: 1 }, 10)).toBe(true);
		expect(isPositionOnRoute({ x: 150, y: 230 }, [segment], { la: 1 }, 10)).toBe(false);
		expect(isPositionOnRoute({ x: 90, y: 200 }, [segment], { la: 1 }, 10)).toBe(true);
		expect(isPositionOnRoute({ x: 50, y: 200 }, [segment], { la: 1 }, 10)).toBe(false);
	});
	it('非表示の階や離れた経路区間の間をルート上だと判定しない', () => {
		expect(isPositionOnRoute({ x: 150, y: 200 }, [segment], { la: 2 }, 10)).toBe(false);
		expect(isPositionOnRoute({ x: 150, y: 200 }, [[segment[0]], [segment[1]]], { la: 1 }, 10)).toBe(
			false
		);
	});
	it('屋外の一点経路と重なったノードを扱い、不正値や経路なしは拒否する', () => {
		const outdoor = { ...segment[0], buildingId: 'outdoor', floor: 0 };
		expect(isPositionOnRoute(outdoor, [[outdoor, outdoor]], {}, 10)).toBe(true);
		expect(isPositionOnRoute(outdoor, [], {}, 10)).toBe(false);
		expect(isPositionOnRoute({ x: Infinity, y: 0 }, [segment], { la: 1 }, 10)).toBe(false);
	});
});
