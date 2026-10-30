import { describe, expect, it } from 'vitest';
import type { BuildingMap } from '../../../../data/maps';
import { getAvailableFloor, synchronizeFloors } from '../floors';
import { createConnectedFloorLookup } from '../../connectedFloors';
import type { Node } from '../../../../data/types';

function building(id: string, floors: number[]): BuildingMap {
	return {
		id,
		name: id,
		bounds: [0, 0, 10, 10],
		floors: Object.fromEntries(floors.map((floor) => [floor, `${id}-${floor}.svg`]))
	};
}

describe('floor state', () => {
	it('指定階、1階、最も低い公開階の順で補正する', () => {
		expect(getAvailableFloor(building('a', [1, 2, 3]), 3)).toBe(3);
		expect(getAvailableFloor(building('a', [1, 2, 3]), 4)).toBe(1);
		expect(getAvailableFloor(building('a', [2, 3]), 1)).toBe(2);
		expect(getAvailableFloor(building('a', [-1, 2]), 1)).toBe(-1);
		expect(getAvailableFloor(building('a', []), 4)).toBe(4);
		expect(getAvailableFloor(undefined, 0)).toBe(0);
	});

	it('循環する接続を辿り、非公開階・非表示棟・未接続棟を変更しない', () => {
		const buildings = [
			building('a', [1, 2]),
			building('b', [1, 2]),
			building('c', [1, 3]),
			building('d', [1]),
			building('e', [1, 2])
		];
		const nodes: Node[] = [
			{ id: 'a', buildingId: 'a', floor: 2, x: 0, y: 0 },
			{ id: 'b', buildingId: 'b', floor: 2, x: 1, y: 0 },
			{ id: 'c', buildingId: 'c', floor: 3, x: 2, y: 0 },
			{ id: 'd', buildingId: 'd', floor: 2, x: 3, y: 0 },
			{ id: 'hidden', buildingId: 'hidden', floor: 2, x: 4, y: 0 }
		];
		const lookup = createConnectedFloorLookup(
			nodes,
			[
				['a', 'b'],
				['b', 'c'],
				['c', 'a'],
				['a', 'd'],
				['a', 'hidden']
			].map(([fromNode, toNode]) => ({ fromNode, toNode, isStairs: false }))
		);
		const original = { a: 2, b: 1, c: 1, d: 1, e: 1, hidden: 1 };
		expect(synchronizeFloors('a', buildings, original, lookup)).toEqual({
			a: 2,
			b: 2,
			c: 3,
			d: 1,
			e: 1,
			hidden: 1
		});
		expect(original).toEqual({ a: 2, b: 1, c: 1, d: 1, e: 1, hidden: 1 });
		expect(synchronizeFloors('hidden', buildings, original, lookup)).toEqual(original);
	});
});
