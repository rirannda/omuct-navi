import { describe, expect, it } from 'vitest';
import { buildingMaps } from '../../../data/maps';
import type { BuildingMap } from '../../../data/maps';
import { getVisibleBuildings } from '../visibleBuildings';

describe('getVisibleBuildings', () => {
	it('全体表示では中心や棟数で絞らず、レイヤーのある全建物を返す', () => {
		expect(getVisibleBuildings(buildingMaps, [0, 0, 1400, 1700])).toEqual(buildingMaps);
	});

	it('中心が外でも一部が画面に入る建物を含み、完全に外れた建物を除く', () => {
		expect(getVisibleBuildings(buildingMaps, [570, 1030, 590, 1170]).map(({ id }) => id)).toEqual([
			'la',
			'skybridge'
		]);
		expect(getVisibleBuildings(buildingMaps, [800, 1020, 940, 1150]).map(({ id }) => id)).toEqual([
			'lib'
		]);
		expect(getVisibleBuildings(buildingMaps, [0, 0, 200, 200])).toEqual([]);
	});

	it('レイヤーがない建物は対象にせず、1階以外だけ公開されている建物も対象にする', () => {
		const buildings = buildingMaps.slice(0, 2).map((building, index): BuildingMap => ({
			...building,
			floors: index === 0 ? {} : { 2: 'only_F2.svg' }
		}));
		expect(getVisibleBuildings(buildings, [0, 0, 1400, 1700]).map(({ id }) => id)).toEqual(['ss1']);
	});
});
