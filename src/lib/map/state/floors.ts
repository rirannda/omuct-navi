import type { BuildingMap } from '../../../data/maps';
import type { ConnectedFloorLookup } from '../connectedFloors';

export function getAvailableFloor(
	building: BuildingMap | undefined,
	preferredFloor: number
): number {
	if (!building || building.floors[preferredFloor]) return preferredFloor;
	if (building.floors[1]) return 1;
	const floors = Object.keys(building.floors).map(Number);
	return floors.length ? Math.min(...floors) : preferredFloor;
}

/** 表示中の接続先だけを辿り、入力を変更せずに階を同期します。 */
export function synchronizeFloors(
	buildingId: string,
	visibleBuildings: readonly BuildingMap[],
	activeFloors: Readonly<Record<string, number>>,
	getConnectedFloor: ConnectedFloorLookup
): Record<string, number> {
	const floors = { ...activeFloors };
	if (!visibleBuildings.some(({ id }) => id === buildingId)) return floors;
	const visited = new Set([buildingId]);
	const pending = [buildingId];
	for (let index = 0; index < pending.length; index++) {
		const sourceId = pending[index];
		for (const target of visibleBuildings) {
			if (visited.has(target.id)) continue;
			const connectedFloor = getConnectedFloor(
				sourceId,
				floors[sourceId],
				target.id,
				floors[target.id]
			);
			if (connectedFloor === undefined || !target.floors[connectedFloor]) continue;
			floors[target.id] = connectedFloor;
			visited.add(target.id);
			pending.push(target.id);
		}
	}
	return floors;
}
