import { nodes } from '../../../data/nodes.ts';
import { edges } from '../../../data/edges.ts';
import { edgeStairs } from '../../../data/edge_stair.ts';
import { pois } from '../../../data/pois.ts';
import { buildGraph } from '../buildGraph.ts';
import { aStar } from '../aStar.ts';

const graph = buildGraph(nodes, edges, edgeStairs);

const start = pois.find((p) => p.id === 'poi_hr_1-1');
if (!start) {
	throw new Error('Not Found Start');
}
const goal = pois.find((p) => p.id === 'poi_hr_2e');
if (!goal) {
	throw new Error('Not Found Start');
}

const path = aStar(graph, start.nodeId, goal.nodeId);

console.log(start);
console.log(path);
