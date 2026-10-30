import { buildingMaps } from '../../data/maps';
import type { BuildingMap } from '../../data/maps';

export function getFloorOrder(building: BuildingMap): number[] {
	const floors = Object.keys(building.floors)
		.map(Number)
		.sort((a, b) => b - a);
	const configured = (building.floorOrder ?? []).filter((floor) => floors.includes(floor));
	return [...new Set([...configured, ...floors])];
}

export function formatFloorLabel(buildingId: string, floor: number, compact = true): string {
	const custom = buildingMaps.find(({ id }) => id === buildingId)?.floorLabels?.[floor];
	if (custom) return custom;
	if (compact) return floor < 0 ? `B${-floor}` : `${floor}F`;
	return floor < 0 ? `地下${-floor}階` : `${floor}階`;
}
