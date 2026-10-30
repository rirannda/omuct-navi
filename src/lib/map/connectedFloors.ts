import type { Edge, Node } from '../../data/types';

export type ConnectedFloorLookup = (
	buildingId: string,
	floor: number,
	targetBuildingId: string,
	currentTargetFloor?: number
) => number | undefined;

/** 建物間を直接つなぐ経路から、双方向の階対応を一度だけ索引化します。 */
export function createConnectedFloorLookup(
	nodes: readonly Node[],
	edges: readonly Edge[]
): ConnectedFloorLookup {
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const connections = new Map<string, Set<number>>();
	const key = (buildingId: string, floor: number, targetBuildingId: string) =>
		JSON.stringify([buildingId, floor, targetBuildingId]);
	const buildingId = (node: Node) => node.buildingId ?? /^node_(.+)_f-?\d+_/.exec(node.id)?.[1];

	function add(fromBuilding: string, fromFloor: number, toBuilding: string, toFloor: number) {
		const connectionKey = key(fromBuilding, fromFloor, toBuilding);
		const floors = connections.get(connectionKey) ?? new Set<number>();
		floors.add(toFloor);
		connections.set(connectionKey, floors);
	}

	for (const edge of edges) {
		const from = nodeById.get(edge.fromNode);
		const to = nodeById.get(edge.toNode);
		if (!from || !to) continue;
		const fromBuilding = buildingId(from);
		const toBuilding = buildingId(to);
		if (!fromBuilding || !toBuilding || fromBuilding === toBuilding) continue;
		add(fromBuilding, from.floor, toBuilding, to.floor);
		add(toBuilding, to.floor, fromBuilding, from.floor);
	}

	return (buildingId, floor, targetBuildingId, currentTargetFloor) => {
		const floors = connections.get(key(buildingId, floor, targetBuildingId));
		if (!floors?.size) return undefined;
		// 複数の接続先がある場合は、現在表示している階を優先して不要な移動を避けます。
		if (currentTargetFloor !== undefined && floors.has(currentTargetFloor))
			return currentTargetFloor;
		if (floors.has(floor)) return floor;
		return Math.min(...floors);
	};
}
