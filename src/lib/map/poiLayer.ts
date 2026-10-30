import type * as LType from 'leaflet';
import type { Node, Poi } from '../../data/types';
import type { HighlightColor } from './highlightColors';
import { highlightRoles } from './highlightColors';
import type { PoiHighlights } from '../states/navigation.svelte';
import { getNodeBuildingId } from './nodeBuilding';
import type { SvgLayers } from './svgLayers';

type PoiHighlight = { poi: Poi; layer: LType.SVGOverlay; element: SVGGraphicsElement };
type PoiHighlightDisplay = PoiHighlight & { color: HighlightColor; tooltip: LType.Tooltip };

export function createPoiLayer(
	leaflet: typeof LType,
	map: LType.Map,
	mapContainer: HTMLElement,
	svgLayers: SvgLayers,
	nodes: readonly Node[],
	pois: readonly Poi[],
	onSelect: (poiId: string) => void
) {
	let poiHighlightDisplays: PoiHighlightDisplay[] = [];
	const poiSelectionCleanups: (() => void)[] = [];
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const poiById = new Map(pois.map((poi) => [poi.id, poi]));
	function findTarget(poiId: string): PoiHighlight | undefined {
		const poi = poiById.get(poiId);
		const node = poi ? nodeById.get(poi.nodeId) : undefined;
		if (!poi || !node) return;
		const target = svgLayers.findPoiTarget(poi, node);
		return target ? { ...target, poi } : undefined;
	}
	function updateVisiblePoi() {
		if (!map) return;
		for (const { layer, element, tooltip } of poiHighlightDisplays) {
			if (!map.hasLayer(layer)) {
				tooltip.remove();
				continue;
			}
			const bounds = element.getBBox();
			const matrix = element.getScreenCTM();
			if (!matrix) continue;
			const center = new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
			const screenPoint = center.matrixTransform(matrix);
			const containerBounds = mapContainer.getBoundingClientRect();
			const location = map.containerPointToLatLng([
				screenPoint.x - containerBounds.left,
				screenPoint.y - containerBounds.top
			]);
			tooltip.setLatLng(location);
			if (!map.hasLayer(tooltip)) tooltip.addTo(map);
		}
	}

	function render(highlights: PoiHighlights) {
		const L = leaflet;
		if (!L) return;
		const entries = highlightRoles.flatMap((color) => {
			const highlight = highlights[color] ? findTarget(highlights[color]!) : undefined;
			return highlight ? [{ ...highlight, color }] : [];
		});
		// 同じ部屋に複数の役割がある場合は、selected > goal > start の色を優先します。
		const targets = entries.filter(
			(entry, index) => !entries.slice(index + 1).some((other) => other.element === entry.element)
		);
		for (const display of poiHighlightDisplays) {
			if (!targets.some((target) => target.element === display.element)) {
				display.element.classList.remove('poi-highlight', `poi-color-${display.color}`);
				display.tooltip.remove();
			}
		}
		poiHighlightDisplays = targets.map((target) => {
			const previous = poiHighlightDisplays.find((display) => display.element === target.element);
			const tooltip =
				previous?.tooltip ??
				L.tooltip({
					permanent: true,
					direction: 'top',
					offset: [0, -8],
					opacity: 1
				});
			if (previous) {
				target.element.classList.remove(`poi-color-${previous.color}`);
				tooltip.getElement()?.classList.remove(`poi-color-${previous.color}`);
			}
			target.element.classList.add('poi-highlight', `poi-color-${target.color}`);
			tooltip.options.className = `poi-name-tooltip poi-color-${target.color}`;
			tooltip.getElement()?.classList.add(`poi-color-${target.color}`);
			const label = document.createElement('span');
			label.textContent = target.poi.name;
			tooltip.setContent(label);
			return { ...target, tooltip };
		});
		updateVisiblePoi();
	}

	function enablePoiSelection(layer: LType.SVGOverlay, buildingId: string, floor: number) {
		const svg = svgLayers.getElement(layer);
		if (!svg) return;
		const poiElements = pois.flatMap((poi) => {
			const node = nodeById.get(poi.nodeId);
			if (!node || node.floor !== floor) return [];
			const poiBuildingId = getNodeBuildingId(node);
			if (poiBuildingId !== buildingId) return [];
			const element = svg.querySelector(`#${CSS.escape(poi.svgId)}`);
			if (!(element instanceof SVGGraphicsElement)) return [];
			return [{ poi, element }];
		});
		const poiBySvgId = new Map(poiElements.map(({ poi }) => [poi.svgId, poi]));
		for (const { poi, element } of poiElements) {
			element.classList.add('poi-selectable');
			element.setAttribute('role', 'button');
			element.setAttribute('tabindex', '0');
			element.setAttribute('aria-label', poi.name);
		}

		function selectTarget(target: EventTarget | null): boolean {
			if (!map?.hasLayer(layer) || !(target instanceof Element)) return false;
			// POIのSVGがグループの場合は、タップした子要素から親へ辿って探します。
			for (
				let element: Element | null = target;
				element && element !== svg;
				element = element.parentElement
			) {
				const poi = poiBySvgId.get(element.id);
				if (poi) {
					onSelect(poi.id);
					return true;
				}
			}
			return false;
		}

		// Leafletのclickを使い、地図をドラッグした直後の誤選択を防ぎます。
		const onClick = (event: LType.LeafletMouseEvent) => {
			selectTarget(event.originalEvent.target);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.key === 'Enter' || event.key === ' ') && selectTarget(event.target)) {
				event.preventDefault();
			}
		};
		layer.on('click', onClick);
		svg.addEventListener('keydown', onKeyDown);
		poiSelectionCleanups.push(() => {
			layer.off('click', onClick);
			svg.removeEventListener('keydown', onKeyDown);
		});
	}

	function dispose() {
		for (const cleanup of poiSelectionCleanups) cleanup();
		poiSelectionCleanups.length = 0;
		for (const display of poiHighlightDisplays) {
			display.element.classList.remove('poi-highlight', `poi-color-${display.color}`);
			display.tooltip.remove();
		}
		poiHighlightDisplays = [];
	}
	return {
		render,
		findTarget,
		enableSelection: enablePoiSelection,
		updateVisible: updateVisiblePoi,
		dispose
	};
}
