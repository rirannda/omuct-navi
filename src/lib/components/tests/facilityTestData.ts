import type { MapMarker } from '../../../data/types';
import { createNavigationState } from '../../states/navigation.svelte';
import menIcon from '../../assets/markers/toilet-men.svg';
import womenIcon from '../../assets/markers/toilet-women.svg';
import accessibleIcon from '../../assets/markers/toilet-accessible.svg';
import trashIcon from '../../assets/markers/trash.svg';

const common = {
	nodeId: 'node_outdoor_f0_main-gate',
	description: '',
	visibility: 'floor' as const
};
export const facilityMarkers: MapMarker[] = [
	{
		...common,
		id: 'men-la',
		name: '教養棟1階男子トイレ',
		categoryId: 'toilet',
		toiletType: 'men',
		icon: menIcon,
		buildingId: 'la',
		floor: 1,
		x: 500,
		y: 500
	},
	{
		...common,
		id: 'women-la',
		name: '教養棟2階女子トイレ',
		categoryId: 'toilet',
		toiletType: 'women',
		icon: womenIcon,
		buildingId: 'la',
		floor: 2,
		x: 510,
		y: 510
	},
	{
		...common,
		id: 'accessible-admin',
		name: '管理棟バリアフリートイレ',
		categoryId: 'toilet',
		toiletType: 'accessible',
		icon: accessibleIcon,
		buildingId: 'admin',
		visibility: 'always',
		floor: 1,
		x: 1000,
		y: 800
	},
	{
		...common,
		id: 'trash-outdoor',
		name: '中庭のゴミ箱',
		categoryId: 'trash',
		icon: trashIcon,
		buildingId: 'outdoor',
		visibility: 'always',
		floor: 0,
		x: 700,
		y: 700
	},
	{
		...common,
		id: 'trash-la',
		name: '教養棟のゴミ箱',
		categoryId: 'trash',
		icon: trashIcon,
		buildingId: 'la',
		floor: 1,
		x: 520,
		y: 500
	}
];

export function createFacilityNavigation(mode: 'normal' | 'festival' = 'festival') {
	const base = createNavigationState();
	return createNavigationState({
		graph: base.graph,
		pois: base.pois,
		markers: facilityMarkers,
		config: { mode }
	});
}
