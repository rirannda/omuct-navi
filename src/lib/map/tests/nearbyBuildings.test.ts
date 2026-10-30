import { describe, expect, it } from 'vitest';
import { buildingMaps } from '../../../data/maps';
import { getNearbyBuildings } from '../nearbyBuildings';

describe('getNearbyBuildings', () => {
	it('中心付近に1棟しかなければ離れた2棟目を追加しない', () => {
		expect(getNearbyBuildings(buildingMaps, 481, 1105).map(({ id }) => id)).toEqual(['la']);
		expect(getNearbyBuildings(buildingMaps, 867.5, 1084).map(({ id }) => id)).toEqual(['lib']);
	});

	it('教養棟と渡り廊下の両方が中心付近にあるときは2棟を選ぶ', () => {
		expect(getNearbyBuildings(buildingMaps, 570, 1105).map(({ id }) => id)).toEqual([
			'la',
			'skybridge'
		]);
	});

	it('範囲が重なる中央階段と渡り廊下も2棟までに絞る', () => {
		expect(getNearbyBuildings(buildingMaps, 603, 900).map(({ id }) => id)).toEqual([
			'staircase',
			'skybridge'
		]);
	});

	it('建物から離れた場所では階別表示をしない', () => {
		expect(getNearbyBuildings(buildingMaps, 100, 100)).toEqual([]);
	});
});
