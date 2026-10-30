import 'leaflet/dist/leaflet.css';
import '../mapLayers.css';
import * as L from 'leaflet';
import { afterEach, describe, expect, it } from 'vitest';
import { createRouteLayer } from '../routeLayer';
import type { Node } from '../../../data/types';

let map: L.Map | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => {
	map?.remove();
	container?.remove();
});

describe('route labels', () => {
	it('中心に近い3つだけ吹き出しを表示し、移動・表示範囲の変更でも全アイコンを残す', () => {
		container = document.createElement('div');
		container.style.cssText = 'width:800px;height:600px';
		document.body.appendChild(container);
		map = L.map(container, { crs: L.CRS.Simple, zoomControl: false, attributionControl: false });
		map.createPane('route-lines');
		map.setView([300, 400], 0, { animate: false });
		const nodes: Node[] = [100, 200, 250, 350, 400, 500, 550, 650].map((x, index) => ({
			id: `node-${index}`,
			x,
			y: 300,
			floor: 1,
			buildingId: ['a', 'b', 'c', 'd'][Math.floor(index / 2)]
		}));
		let visibleHeight = 450;
		const route = createRouteLayer(
			L,
			map,
			container,
			nodes,
			() => ({
				activeFloor: 1,
				activeFloors: { a: 1, b: 1, c: 1, d: 1 },
				visibleBuildings: ['a', 'b', 'c', 'd'].map((id) => ({ id }))
			}),
			() => {},
			undefined,
			() => visibleHeight
		);
		route.draw(nodes.map(({ id }) => id));
		route.updateVisible();
		route.updateLabels();
		const labels = () =>
			Array.from(container!.querySelectorAll('.route-transition-label, .route-endpoint-label'))
				.filter((element) => getComputedStyle(element).visibility !== 'hidden')
				.map((element) => element.textContent)
				.sort();
		const icons = () =>
			container!.querySelectorAll('.route-transition-marker, .route-endpoint-marker').length;
		expect(icons()).toBe(8);
		expect(labels()).toEqual(['b 1階から進む', 'c 1階へ', 'd 1階へ'].sort());
		map.panBy([220, 0], { animate: false });
		route.updateLabels();
		expect(labels()).toEqual(['c 1階から進む', 'd 1階へ', 'ゴール'].sort());
		expect(icons()).toBe(8);
		visibleHeight = 100;
		route.updateLabels();
		expect(labels()).toEqual([]);
		expect(container.querySelector('.route-label-connector')).toBeNull();
		expect(icons()).toBe(8);
		visibleHeight = 600;
		route.updateLabels();
		expect(labels()).toHaveLength(3);
		route.clear();
		expect(icons()).toBe(0);
		expect(labels()).toEqual([]);
		expect(container.querySelector('.route-label-connector')).toBeNull();
	});
});
