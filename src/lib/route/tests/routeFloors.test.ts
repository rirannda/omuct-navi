import { describe, expect, it } from 'vitest';
import { getRouteEntryFloors } from '../routeFloors';
import type { Node } from '../../../data/types';

const nodes: Node[] = [
	{ id: 'gate', buildingId: 'outdoor', floor: 0, x: 0, y: 0 },
	{ id: 'ground', buildingId: 'entrance', floor: 0, x: 1, y: 0 },
	{ id: 'first', buildingId: 'entrance', floor: 1, x: 1, y: 0 },
	{ id: 'bridge', buildingId: 'skybridge', floor: 1, x: 2, y: 0 }
];

describe('getRouteEntryFloors', () => {
	it('正門からは地上、渡り廊下からは1階をエントランスの初期階にする', () => {
		expect(getRouteEntryFloors(['gate', 'ground', 'first', 'bridge'], nodes)).toEqual({
			entrance: 0,
			skybridge: 1
		});
		expect(getRouteEntryFloors(['bridge', 'first', 'ground', 'gate'], nodes)).toEqual({
			skybridge: 1,
			entrance: 1
		});
	});
	it('空や屋外だけの経路では建物の階を指定せず、不明なノードは拒否する', () => {
		expect(getRouteEntryFloors([], nodes)).toEqual({});
		expect(getRouteEntryFloors(['gate'], nodes)).toEqual({});
		expect(() => getRouteEntryFloors(['missing'], nodes)).toThrow('経路上のノードが見つかりません');
	});
});
