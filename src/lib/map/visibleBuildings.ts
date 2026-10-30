import type { BuildingMap } from '../../data/maps';

/** SVG座標の表示範囲と一部でも重なる、階別レイヤーのある建物を返します。 */
export function getVisibleBuildings(
	buildings: readonly BuildingMap[],
	[left, top, right, bottom]: readonly [number, number, number, number]
): BuildingMap[] {
	return buildings.filter((building) => {
		const [buildingLeft, buildingTop, buildingRight, buildingBottom] = building.bounds;
		return (
			Object.keys(building.floors).length > 0 &&
			buildingLeft < right &&
			buildingRight > left &&
			buildingTop < bottom &&
			buildingBottom > top
		);
	});
}
