import { describe, expect, it } from 'vitest';
import type { MapMarker } from '../../../data/types';
import { createNavigationState } from '../navigation.svelte';

const markers: MapMarker[] = [
	{
		id: 'men',
		name: '男子トイレ',
		categoryId: 'toilet',
		toiletType: 'men',
		nodeId: 'entry',
		buildingId: 'la',
		visibility: 'floor',
		floor: 1,
		x: 10,
		y: 0,
		icon: '/men.svg',
		description: ''
	},
	{
		id: 'women',
		name: '女子トイレ',
		categoryId: 'toilet',
		toiletType: 'women',
		nodeId: 'entry',
		buildingId: 'la',
		visibility: 'floor',
		floor: 2,
		x: 20,
		y: 0,
		icon: '/women.svg',
		description: ''
	},
	{
		id: 'accessible',
		name: 'バリアフリートイレ',
		categoryId: 'toilet',
		toiletType: 'accessible',
		nodeId: 'entry',
		buildingId: 'admin',
		visibility: 'floor',
		floor: 1,
		x: 100,
		y: 0,
		icon: '/accessible.svg',
		description: ''
	},
	{
		id: 'trash',
		name: 'ゴミ箱',
		categoryId: 'trash',
		nodeId: 'entry',
		buildingId: 'la',
		visibility: 'floor',
		floor: 1,
		x: 15,
		y: 0,
		icon: '/trash.svg',
		description: ''
	},
	{
		id: 'invalid',
		name: '未接続のトイレ',
		categoryId: 'toilet',
		nodeId: 'missing',
		buildingId: 'la',
		visibility: 'floor',
		floor: 1,
		x: 0,
		y: 0,
		icon: '/men.svg',
		description: ''
	}
];

function setup(mode: 'normal' | 'festival' = 'festival') {
	return createNavigationState({
		config: { mode },
		pois: [],
		markers,
		graph: { nodes: [{ id: 'entry', buildingId: 'outdoor', floor: 0, x: 0, y: 0 }], edges: [] }
	});
}

describe('facility search state', () => {
	it('通常データでは無効で、高専祭データに切り替えたときだけ使える', () => {
		const normal = setup('normal');
		expect(normal.isFestival).toBe(false);
		expect(normal.searchFacilities('toilet')).toBe(false);
		expect(normal.facilitySearch).toBeNull();
		expect(setup().searchFacilities('trash')).toBe(true);
	});

	it('GPSオフでは建物の選択を待ち、種類変更でも選んだ建物を維持する', () => {
		const state = setup();
		state.searchFacilities('toilet');
		expect(state.facilityResults).toEqual([]);
		expect(state.setFacilityBuilding('unknown-building')).toBe(false);
		state.setFacilityBuilding('la');
		expect(state.facilityResults.map(({ id }) => id).sort()).toEqual(['men', 'women']);
		state.searchFacilities('toilet', 'women');
		expect(state.facilityResults.map(({ id }) => id)).toEqual(['women']);
		state.searchFacilities('trash');
		expect(state.facilityResults.map(({ id }) => id)).toEqual(['trash']);
		expect(state.facilitySearch?.buildingId).toBe('la');
		state.clearFacilitySearch();
		expect(state.facilityResults).toEqual([]);
	});

	it('GPS取得中は待機し、取得後は建物をまたいで更新し、オフに戻すと建物を選び直す', () => {
		const state = setup();
		state.searchFacilities('toilet');
		state.setFacilityBuilding('la');
		state.setGpsLocation({ enabled: true, position: null });
		expect(state.facilityResults).toEqual([]);
		expect(state.setFacilityBuilding('la')).toBe(false);
		state.setGpsLocation({ enabled: true, position: { x: 95, y: 0 } });
		expect(state.facilityResults.map(({ id }) => id)).toEqual(['accessible', 'women', 'men']);
		const query = state.facilitySearch;
		state.setGpsLocation({ enabled: true, position: { x: 0, y: 0 } });
		expect(state.facilitySearch).toBe(query);
		expect(state.facilityResults.map(({ id }) => id)).toEqual(['men', 'women', 'accessible']);
		state.setGpsLocation({ enabled: false });
		expect(state.facilitySearch?.buildingId).toBeUndefined();
		expect(state.facilityResults).toEqual([]);
	});

	it('不正なGPS座標を拒否し、呼び出し元の座標変更を共有状態に持ち込まない', () => {
		const state = setup();
		const position = { x: 10, y: 20 };
		state.setGpsLocation({ enabled: true, position });
		position.x = 999;
		expect(state.gpsLocation).toEqual({ enabled: true, position: { x: 10, y: 20 } });
		expect(state.setGpsLocation({ enabled: true, position: { x: NaN, y: 1 } })).toBe(false);
		expect(state.gpsLocation).toEqual({ enabled: true, position: { x: 10, y: 20 } });
	});
});
