import type { Node } from '../../data/types';
import type { MapPosition } from './geolocationProjection';
import { getNodeBuildingId } from './nodeBuilding';

/** GPSでは階を判定せず、表示中の階の経路だけで位置を照合します。距離は地図の単位です。 */
export function isPositionOnRoute(
	position: MapPosition,
	segments: readonly (readonly Node[])[],
	activeFloors: Readonly<Record<string, number>>,
	tolerance: number
): boolean {
	if (!Number.isFinite(position.x + position.y + tolerance) || tolerance < 0) return false;
	const visible = (node: Node) => {
		const buildingId = getNodeBuildingId(node);
		return buildingId === 'outdoor' || activeFloors[buildingId] === node.floor;
	};
	for (const segment of segments) {
		for (let index = 0; index < segment.length; index++) {
			const to = segment[index];
			if (!visible(to)) continue;
			if (Math.hypot(position.x - to.x, position.y - to.y) <= tolerance) return true;
			const from = segment[index - 1];
			if (!from || !visible(from)) continue;
			const dx = to.x - from.x;
			const dy = to.y - from.y;
			const lengthSquared = dx * dx + dy * dy;
			if (!lengthSquared) continue;
			const fraction = Math.max(
				0,
				Math.min(1, ((position.x - from.x) * dx + (position.y - from.y) * dy) / lengthSquared)
			);
			if (
				Math.hypot(position.x - (from.x + fraction * dx), position.y - (from.y + fraction * dy)) <=
				tolerance
			)
				return true;
		}
	}
	return false;
}
