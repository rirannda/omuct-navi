import type { BuildingMap } from '../../data/maps';

/** SVG座標の中心付近で、近い順に最大2棟を選びます。 */
export function getNearbyBuildings(
	buildings: readonly BuildingMap[],
	x: number,
	y: number
): BuildingMap[] {
	return buildings
		.filter(({ bounds: [left, top, right, bottom] }) => {
			const marginX = (right - left) * 0.2;
			const marginY = (bottom - top) * 0.2;
			return (
				x >= left - marginX && x <= right + marginX && y >= top - marginY && y <= bottom + marginY
			);
		})
		.map((building) => {
			const [left, top, right, bottom] = building.bounds;
			const dx = Math.max(left - x, 0, x - right);
			const dy = Math.max(top - y, 0, y - bottom);
			return { building, distance: dx * dx + dy * dy, area: (right - left) * (bottom - top) };
		})
		.sort((a, b) => a.distance - b.distance || a.area - b.area)
		.slice(0, 2)
		.map(({ building }) => building);
}
