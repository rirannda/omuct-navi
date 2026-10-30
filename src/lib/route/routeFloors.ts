import type { Node } from '../../data/types';
import { getNodeBuildingId } from '../map/nodeBuilding';

/** 経路が最初に入る階を各棟の初期表示にし、同じ棟の後続階で上書きしません。 */
export function getRouteEntryFloors(
	pathIds: readonly string[],
	nodes: readonly Node[]
): Record<string, number> {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const floors: Record<string, number> = {};
	for (const id of pathIds) {
		const node = byId.get(id);
		if (!node) throw new Error(`経路上のノードが見つかりません: ${id}`);
		const buildingId = getNodeBuildingId(node);
		if (buildingId && buildingId !== 'outdoor' && floors[buildingId] === undefined) {
			floors[buildingId] = node.floor;
		}
	}
	return floors;
}
