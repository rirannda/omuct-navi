import type { Edge, Node, EnhancedEdge } from '../../data/types.ts';

const STAIR_EDGE_COST = 30;

export function buildGraph(nodes: Node[], rawEdges: Edge[], stairEdge: Edge[]) {
	const nodeMap = new Map(nodes.map((node) => [node.id, node]));

	const allEdges = [...rawEdges, ...stairEdge];

	const edges: EnhancedEdge[] = allEdges.map((edge) => {
		const from = nodeMap.get(edge.fromNode);
		const to = nodeMap.get(edge.toNode);

		if (!from || !to) {
			throw new Error(`Node not found: ${edge.fromNode} -> ${edge.toNode}`);
		}

		return {
			id: `${edge.fromNode}_to_${edge.toNode}`,
			fromNode: edge.fromNode,
			toNode: edge.toNode,
			isStairs: edge.isStairs,
			weight: edge.isStairs ? STAIR_EDGE_COST : Math.hypot(from.x - to.x, from.y - to.y)
		};
	});

	return {
		nodes,
		edges
	};
}
