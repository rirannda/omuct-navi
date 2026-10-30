import type { EnhancedEdge, Node } from '../../data/types.ts';

type AdjacencyList = Map<string, { to: string; cost: number }[]>;

/**
 * ノードとエッジから双方向の隣接リストを構築
 */
function buildAdjacencyList(nodes: Node[], edges: EnhancedEdge[]): AdjacencyList {
	const adjacency: AdjacencyList = new Map();

	for (const node of nodes) {
		adjacency.set(node.id, []);
	}

	for (const edge of edges) {
		adjacency.get(edge.fromNode)?.push({ to: edge.toNode, cost: edge.weight });
		adjacency.get(edge.toNode)?.push({ to: edge.fromNode, cost: edge.weight });
	}

	return adjacency;
}

/**
 * 2ノード間のユークリッド距離（直線距離）を計算
 */
function calculateEuclideanDistance(a: Node, b: Node): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * openSetの中で最もfScoreが低いノードIDを探す
 */
function findLowestScoreNode(openSet: Set<string>, fScoreMap: Map<string, number>): string | null {
	let lowestNode: string | null = null;
	let lowestScore = Infinity;

	for (const id of openSet) {
		const score = fScoreMap.get(id) ?? Infinity;
		if (score < lowestScore) {
			lowestScore = score;
			lowestNode = id;
		}
	}

	return lowestNode;
}

/**
 * cameFromマップを元にゴールからスタートまでの経路を再構築
 */
function reconstructPath(cameFrom: Map<string, string>, currentId: string): string[] {
	const path = [currentId];
	let current = currentId;

	while (cameFrom.has(current)) {
		current = cameFrom.get(current)!;
		path.unshift(current);
	}

	return path;
}

/**
 * A* 探索アルゴリズム メイン関数
 */
export function aStar(
	graph: { nodes: Node[]; edges: EnhancedEdge[] },
	startId: string,
	goalId: string,
	options: { avoidStairs?: boolean } = {}
): string[] | null {
	const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

	// ノードの存在確認
	const startNode = nodeMap.get(startId);
	const goalNode = nodeMap.get(goalId);
	if (!startNode || !goalNode) return null;

	const edges = options.avoidStairs ? graph.edges.filter((edge) => !edge.isStairs) : graph.edges;
	const adjacency = buildAdjacencyList(graph.nodes, edges);

	// 固定コストの階段が平面距離より安い場合も、残りのコストを過大評価しません。
	const heuristicScale = graph.edges.reduce((scale, edge) => {
		const fromNode = nodeMap.get(edge.fromNode);
		const toNode = nodeMap.get(edge.toNode);
		if (!fromNode || !toNode) return scale;
		const distance = calculateEuclideanDistance(fromNode, toNode);
		return distance > 0 ? Math.min(scale, edge.weight / distance) : scale;
	}, 1);

	const heuristic = (fromId: string, toId: string): number => {
		const fromNode = nodeMap.get(fromId);
		const toNode = nodeMap.get(toId);
		if (!fromNode || !toNode) return Infinity;
		return calculateEuclideanDistance(fromNode, toNode) * heuristicScale;
	};

	const open = new Set([startId]);
	const cameFrom = new Map<string, string>();
	const gScore = new Map<string, number>();
	const fScore = new Map<string, number>();

	for (const node of graph.nodes) {
		gScore.set(node.id, Infinity);
		fScore.set(node.id, Infinity);
	}

	gScore.set(startId, 0);
	fScore.set(startId, heuristic(startId, goalId));

	while (open.size > 0) {
		const current = findLowestScoreNode(open, fScore);
		if (!current) break;

		if (current === goalId) {
			return reconstructPath(cameFrom, current);
		}

		open.delete(current);

		const neighbors = adjacency.get(current) ?? [];
		for (const next of neighbors) {
			const tentativeGScore = (gScore.get(current) ?? Infinity) + next.cost;

			if (tentativeGScore < (gScore.get(next.to) ?? Infinity)) {
				cameFrom.set(next.to, current);
				gScore.set(next.to, tentativeGScore);
				fScore.set(next.to, tentativeGScore + heuristic(next.to, goalId));
				open.add(next.to);
			}
		}
	}

	return null;
}
