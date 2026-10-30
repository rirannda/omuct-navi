import type * as L from 'leaflet';
import type { BuildingMap } from '../../data/maps';
import type { Node, Poi } from '../../data/types';
import type { FloorControlBuilding } from './floorControlLayout';
import { getNodeBuildingId } from './nodeBuilding';
import { getSvgOutlinePoints } from './svgOutline';

export const MAP_HEIGHT = 1700;
export const MAP_WIDTH = 1400;
export const MAP_BOUNDS: L.LatLngBoundsExpression = [
	[0, 0],
	[MAP_HEIGHT, MAP_WIDTH]
];
/** SVGの座標は変えず、上下左右に元の高さ・幅の25%ずつ移動範囲を広げます。 */
export const MAP_MAX_BOUNDS: L.LatLngBoundsExpression = [
	[-MAP_HEIGHT * 0.25, -MAP_WIDTH * 0.25],
	[MAP_HEIGHT * 1.25, MAP_WIDTH * 1.25]
];

/** SVGの取得・検索と、建物レイヤーの表示・破棄を担当します。 */
export function createSvgLayers(
	leaflet: typeof L,
	map: L.Map,
	mapContainer: HTMLElement,
	buildings: readonly BuildingMap[],
	baseMapFiles: readonly string[],
	onSelectBuilding: (buildingId: string) => void
) {
	const abortController = new AbortController();
	const elements = new WeakMap<L.SVGOverlay, SVGElement>();
	const floorLayers: Record<string, Partial<Record<number, L.SVGOverlay>>> = {};
	const overviews: Record<string, L.SVGOverlay> = {};
	const baseLayers: L.SVGOverlay[] = [];
	const visibleLayers = new Set<L.SVGOverlay>();
	const selectionCleanups: (() => void)[] = [];
	let disposed = false;

	function enableBuildingSelection(layer: L.SVGOverlay, svg: SVGElement) {
		const targets = new Map<Element, string>();
		for (const building of buildings) {
			const element = svg.querySelector(`#${CSS.escape(building.svgId ?? building.id)}`);
			if (!element) continue;
			element.classList.add('building-selectable');
			element.setAttribute('data-map-building', building.id);
			targets.set(element, building.id);
		}
		const onClick = (event: L.LeafletMouseEvent) => {
			if (!map.hasLayer(layer)) return;
			for (
				let target = event.originalEvent.target;
				target instanceof Element && target !== svg;
				target = target.parentElement
			) {
				const buildingId = targets.get(target);
				if (buildingId) {
					onSelectBuilding(buildingId);
					return;
				}
			}
		};
		layer.on('click', onClick);
		selectionCleanups.push(() => layer.off('click', onClick));
	}

	async function load() {
		const files = [
			...new Set([
				...baseMapFiles,
				...buildings.flatMap((building) => [
					...Object.values(building.floors),
					...(building.overview ? [building.overview] : [])
				])
			])
		];
		const loaded = new Map(
			await Promise.all(
				files.map(async (file) => {
					const response = await fetch(`/maps/${file}`, { signal: abortController.signal });
					if (!response.ok) throw new Error(`SVGの取得に失敗しました: /maps/${file}`);
					const text = await response.text();
					const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
						.documentElement as unknown as SVGElement;
					const layer = leaflet.svgOverlay(svg, MAP_BOUNDS, { interactive: true });
					elements.set(layer, svg);
					return [file, layer] as const;
				})
			)
		);
		if (disposed) return [];
		const selectableLayers: { layer: L.SVGOverlay; buildingId: string; floor: number }[] = [];
		for (const file of baseMapFiles) {
			const layer = loaded.get(file)!;
			baseLayers.push(layer);
			enableBuildingSelection(layer, elements.get(layer)!);
			selectableLayers.push({ layer, buildingId: 'outdoor', floor: 0 });
			layer.addTo(map);
		}
		for (const building of buildings) {
			if (building.overview) {
				const svg = elements.get(loaded.get(building.overview)!)!.cloneNode(true) as SVGElement;
				const layer = leaflet.svgOverlay(svg, MAP_BOUNDS, { interactive: true });
				overviews[building.id] = layer;
				enableBuildingSelection(layer, svg);
			}
			const layers: Partial<Record<number, L.SVGOverlay>> = {};
			for (const [floor, file] of Object.entries(building.floors)) {
				const layer = loaded.get(file)!;
				layer.options.pane = 'floor-maps';
				const svg = elements.get(layer)!;
				svg.setAttribute('data-map-building', building.id);
				const onClick = () => onSelectBuilding(building.id);
				layer.on('click', onClick);
				selectionCleanups.push(() => layer.off('click', onClick));
				const outline = svg.querySelector('[id$="_flame"]');
				outline?.classList.add('building-floor-outline');
				layers[Number(floor)] = layer;
				selectableLayers.push({ layer, buildingId: building.id, floor: Number(floor) });
			}
			floorLayers[building.id] = layers;
		}
		return selectableLayers;
	}

	function getOutline(buildingId: string, floor: number): SVGGeometryElement | undefined {
		const layer = floorLayers[buildingId]?.[floor];
		const outline = layer ? elements.get(layer)?.querySelector('[id$="_flame"]') : undefined;
		return outline instanceof SVGGeometryElement ? outline : undefined;
	}

	function findPoiTarget(poi: Poi, node: Node) {
		const buildingId = getNodeBuildingId(node);
		const selector = `#${CSS.escape(poi.svgId)}`;
		const layer =
			buildingId === 'outdoor'
				? baseLayers.find((candidate) => elements.get(candidate)?.querySelector(selector))
				: floorLayers[buildingId]?.[node.floor];
		const element = layer ? elements.get(layer)?.querySelector(selector) : undefined;
		return layer && element instanceof SVGGraphicsElement ? { layer, element } : undefined;
	}

	function updateVisible(
		visibleBuildings: readonly BuildingMap[],
		floors: Readonly<Record<string, number>>,
		colors: Readonly<Record<string, string>>
	) {
		const next = new Set(
			visibleBuildings.flatMap(({ id }) => {
				const layer = floorLayers[id]?.[floors[id]];
				const svg = layer ? elements.get(layer) : undefined;
				svg?.classList.add('building-floor-focused');
				svg?.style.setProperty('--building-outline-color', colors[id]);
				return layer ? [layer] : [];
			})
		);
		for (const layer of visibleLayers) {
			if (!next.has(layer)) {
				const svg = elements.get(layer);
				svg?.classList.remove('building-floor-focused');
				svg?.style.removeProperty('--building-outline-color');
				layer.remove();
				visibleLayers.delete(layer);
			}
		}
		for (const [id, layer] of Object.entries(overviews)) {
			if (visibleBuildings.some((building) => building.id === id)) layer.remove();
			else if (!map.hasLayer(layer)) layer.addTo(map);
		}
		for (const layer of next) {
			if (!map.hasLayer(layer)) layer.addTo(map);
			visibleLayers.add(layer);
		}
	}

	function getControlBuildings(floors: Readonly<Record<string, number>>): FloorControlBuilding[] {
		const size = map.getSize();
		const rect = mapContainer.getBoundingClientRect();
		return buildings.map((building) => {
			const [left, top, right, bottom] = building.bounds;
			const northWest = map.latLngToContainerPoint([MAP_HEIGHT - top, left]);
			const southEast = map.latLngToContainerPoint([MAP_HEIGHT - bottom, right]);
			const layer = floorLayers[building.id]?.[floors[building.id]];
			const outline =
				layer && visibleLayers.has(layer)
					? getOutline(building.id, floors[building.id])
					: undefined;
			const matrix = outline?.getScreenCTM();
			const points =
				outline && matrix
					? getSvgOutlinePoints(outline).map((point) => ({
							x: matrix.a * point.x + matrix.c * point.y + matrix.e - rect.left,
							y: matrix.b * point.x + matrix.d * point.y + matrix.f - rect.top
						}))
					: [];
			const visible = points.filter(({ x, y }) => x >= 0 && x <= size.x && y >= 0 && y <= size.y);
			return {
				id: building.id,
				x: northWest.x,
				y: northWest.y,
				width: southEast.x - northWest.x,
				height: southEast.y - northWest.y,
				outline: visible.length ? visible : points
			};
		});
	}

	function dispose() {
		disposed = true;
		abortController.abort();
		for (const cleanup of selectionCleanups) cleanup();
		selectionCleanups.length = 0;
		for (const layer of [
			...baseLayers,
			...Object.values(overviews),
			...Object.values(floorLayers).flatMap((layers) => Object.values(layers))
		])
			layer?.remove();
		visibleLayers.clear();
	}

	return {
		load,
		getOutline,
		getElement: (layer: L.SVGOverlay) => elements.get(layer),
		findPoiTarget,
		updateVisible,
		getControlBuildings,
		dispose
	};
}

export type SvgLayers = ReturnType<typeof createSvgLayers>;
