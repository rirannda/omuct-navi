import type { Node } from '../../data/types';

export function getNodeBuildingId(node: Node): string {
	return node.buildingId ?? /^node_(.+)_f-?\d+_/.exec(node.id)?.[1] ?? '';
}
