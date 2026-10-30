import type { BuildingMap } from '../../../data/maps';
import type { ConnectedFloorLookup } from '../connectedFloors';
import { getAvailableFloor, synchronizeFloors } from './floors';
import { SvelteMap } from 'svelte/reactivity';
const buildingOutlinePalette = [
	'#2563eb',
	'#ea580c',
	'#0f766e',
	'#7c3aed',
	'#be123c',
	'#0369a1',
	'#a16207',
	'#4d7c0f',
	'#9333ea',
	'#b45309',
	'#475569'
] as const;

export function createMapViewState(
	buildingsData: readonly BuildingMap[],
	getConnectedFloor: ConnectedFloorLookup
) {
	let zoomedBldg = $state('');
	let activeFloor = $state(1);
	let visibleBuildings = $state.raw<BuildingMap[]>([]);
	let activeFloors = $state<Record<string, number>>({});
	const buildingOutlineColors = $state<Record<string, string>>({});
	const byId = new SvelteMap(buildingsData.map((building) => [building.id, building]));
	function availableFloor(id: string, floor: number) {
		return getAvailableFloor(byId.get(id), floor);
	}
	function synchronize(id: string) {
		activeFloors = synchronizeFloors(id, visibleBuildings, activeFloors, getConnectedFloor);
	}
	function selectFloor(id: string, floor: number) {
		zoomedBldg = byId.has(id) ? id : '';
		activeFloor = availableFloor(id, floor);
		if (byId.has(id)) activeFloors[id] = activeFloor;
	}
	function selectRouteFloors(floors: Readonly<Record<string, number>>) {
		const entries = Object.entries(floors).filter(([id]) => byId.has(id));
		for (const [id, floor] of entries) activeFloors[id] = availableFloor(id, floor);
		zoomedBldg = entries[0]?.[0] ?? '';
		activeFloor = zoomedBldg ? activeFloors[zoomedBldg] : 0;
	}
	function setVisibleBuildings(buildings: BuildingMap[], synchronizeSelection = true) {
		// 移動で近い順が変わっても、表示を続ける建物の色は維持します。
		const retained = buildings.filter(({ id }) =>
			visibleBuildings.some((building) => building.id === id)
		);
		const added = buildings.filter(({ id }) => !retained.some((building) => building.id === id));
		const usedColors: string[] = [];
		for (const { id } of [...retained, ...added]) {
			const previousColor = buildingOutlineColors[id];
			const color =
				previousColor && !usedColors.includes(previousColor)
					? previousColor
					: (buildingOutlinePalette.find((candidate) => !usedColors.includes(candidate)) ??
						`hsl(${buildingsData.findIndex((building) => building.id === id) * 137.5} 65% 40%)`);
			buildingOutlineColors[id] = color;
			usedColors.push(color);
		}
		if (
			buildings.length !== visibleBuildings.length ||
			buildings.some((building, index) => building.id !== visibleBuildings[index]?.id)
		) {
			visibleBuildings = buildings;
		}
		for (const { id } of buildings) {
			if (activeFloors[id] === undefined) {
				activeFloors[id] = availableFloor(id, activeFloor);
			}
		}
		if (!buildings.some(({ id }) => id === zoomedBldg)) zoomedBldg = buildings[0]?.id ?? '';
		// シートの開閉による表示領域の変化では、各棟の選択済みの階を維持します。
		if (synchronizeSelection) synchronize(zoomedBldg);
		if (zoomedBldg) activeFloor = activeFloors[zoomedBldg];
	}

	return {
		availableFloor,
		synchronize,
		selectFloor,
		selectRouteFloors,
		setVisibleBuildings,
		get activeFloors() {
			return activeFloors;
		},
		get activeFloor() {
			return activeFloor;
		},
		get zoomedBldg() {
			return zoomedBldg;
		},
		get visibleBuildings() {
			return visibleBuildings;
		},
		get buildingOutlineColors() {
			return buildingOutlineColors;
		}
	};
}
