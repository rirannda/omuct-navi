import { buildingNames } from '../../data/buildings';
import type { Edge, Node } from '../../data/types';
import { formatFloorLabel } from '../map/floorDisplay';

export type RouteTransition = {
	from: Node;
	to: Node;
	label: string;
	icon: 'stairs' | 'building';
	exit: { label: string } | null;
};

// 既存データは node_<建物ID>_f<階>_<地点> の形式です。
function getBuildingId(node: Node): string | undefined {
	return node.buildingId ?? /^node_(.+)_f-?\d+_/.exec(node.id)?.[1];
}

function formatLocation(node: Node): string {
	const buildingId = getBuildingId(node);
	const buildingName = buildingId ? (buildingNames[buildingId] ?? buildingId) : '';
	if (buildingId === 'outdoor') return buildingName;
	return `${buildingName ? `${buildingName} ` : ''}${formatFloorLabel(buildingId ?? '', node.floor, false)}`;
}

function isSameLocation(a: Node, b: Node): boolean {
	return a.floor === b.floor && getBuildingId(a) === getBuildingId(b);
}

// 到着した建物・階で経路が続く場合に出口の案内を表示します。
function hasExit(path: Node[], index: number): boolean {
	const origin = path[index];
	for (let i = index + 1; i < path.length; i++) {
		const neighbor = path[i];
		if (!isSameLocation(origin, neighbor)) break;
		if (origin.x !== neighbor.x || origin.y !== neighbor.y) return true;
	}
	return false;
}

export function getRouteDisplay(
	pathIds: string[],
	nodes: Node[],
	edges?: readonly Edge[]
): { segments: Node[][]; transitions: RouteTransition[] } {
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const segments: Node[][] = [];
	const transitions: RouteTransition[] = [];
	const path = pathIds.map((id) => {
		const node = nodeById.get(id);
		if (!node) throw new Error(`経路上のノードが見つかりません: ${id}`);
		return node;
	});
	let previous: Node | undefined;

	for (const [index, node] of path.entries()) {
		const segment = segments.at(-1);
		if (!segment || segment[0].floor !== node.floor) {
			segments.push([node]);
		} else {
			segment.push(node);
		}

		if (previous) {
			const fromBuilding = getBuildingId(previous);
			const toBuilding = getBuildingId(node);
			const changesFloor = previous.floor !== node.floor;
			const changesBuilding = fromBuilding !== toBuilding;

			if (changesFloor || changesBuilding) {
				const fromId = previous.id;
				const connection = edges?.filter(
					(edge) =>
						(edge.fromNode === fromId && edge.toNode === node.id) ||
						(edge.fromNode === node.id && edge.toNode === fromId)
				);
				const usesStairs = connection?.length
					? connection.every((edge) => edge.isStairs)
					: changesFloor;
				transitions.push({
					from: previous,
					to: node,
					label: `${formatLocation(node)}へ`,
					icon: usesStairs ? 'stairs' : 'building',
					exit: hasExit(path, index) ? { label: `${formatLocation(previous)}から進む` } : null
				});
			}
		}
		previous = node;
	}

	return { segments, transitions };
}
