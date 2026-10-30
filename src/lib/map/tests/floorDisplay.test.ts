import { describe, expect, it } from 'vitest';
import { buildingMaps } from '../../../data/maps';
import { formatFloorLabel, getFloorOrder } from '../floorDisplay';

describe('floor display', () => {
	it('エントランスを2F・地上・1Fの順で既存レイヤーに対応させる', () => {
		const building = buildingMaps.find(({ id }) => id === 'entrance')!;
		expect(getFloorOrder(building)).toEqual([2, 0, 1]);
		expect(getFloorOrder(building).map((floor) => formatFloorLabel(building.id, floor))).toEqual([
			'2F',
			'地上',
			'1F'
		]);
		expect(getFloorOrder(building).map((floor) => building.floors[floor])).toEqual([
			'entrance_f2.svg',
			'entrance.svg',
			'entrance_f1.svg'
		]);
	});
	it('食堂を1F・地上とし、0階のSVGを地上に使う', () => {
		const building = buildingMaps.find(({ id }) => id === 'cafe')!;
		expect(getFloorOrder(building)).toEqual([1, 0]);
		expect(formatFloorLabel('cafe', 0)).toBe('地上');
		expect(formatFloorLabel('cafe', 0, false)).toBe('地上');
		expect(building.floors[0]).toBe('cafe_B1.svg');
		expect(formatFloorLabel('la', 2)).toBe('2F');
		expect(formatFloorLabel('la', 2, false)).toBe('2階');
	});
});
