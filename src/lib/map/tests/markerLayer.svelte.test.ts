import 'leaflet/dist/leaflet.css';
import '../mapLayers.css';
import * as L from 'leaflet';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { MapMarker } from '../../../data/types';
import { createMarkerLayer } from '../markerLayer';
import { highlightColors } from '../highlightColors';
import toiletMenIcon from '../../assets/markers/toilet-men.svg';
import toiletWomenIcon from '../../assets/markers/toilet-women.svg';
import toiletAccessibleIcon from '../../assets/markers/toilet-accessible.svg';
import trashIcon from '../../assets/markers/trash.svg';

let map: L.Map | undefined;
let container: HTMLDivElement | undefined;
let layer: ReturnType<typeof createMarkerLayer> | undefined;
afterEach(() => {
	layer?.dispose();
	map?.remove();
	container?.remove();
});

const marker = (id: string, buildingId: string, floor: number, x: number): MapMarker => ({
	id,
	name: id,
	categoryId: 'toilet',
	nodeId: 'entrance',
	description: '',
	icon: toiletMenIcon,
	buildingId,
	floor,
	x,
	y: 300
});

function setup() {
	container = document.createElement('div');
	container.style.cssText = 'width:800px;height:600px';
	for (const [role, colors] of Object.entries(highlightColors)) {
		for (const [property, value] of Object.entries(colors)) {
			container.style.setProperty(`--poi-${role}-${property}`, value);
		}
	}
	document.body.appendChild(container);
	map = L.map(container, { crs: L.CRS.Simple, zoomControl: false, attributionControl: false });
	map.setView([300, 400], 0, { animate: false });
	const view = { activeFloors: {} as Record<string, number> };
	const onSelect = vi.fn();
	layer = createMarkerLayer(
		L,
		map,
		[
			{ ...marker('outdoor', 'outdoor', 0, 100), icon: trashIcon },
			marker('floor1', 'la', 1, 300),
			{ ...marker('floor2', 'la', 2, 300), icon: toiletWomenIcon },
			{ ...marker('no-detail', 'admin', 2, 500), icon: toiletAccessibleIcon },
			{ ...marker('only2', 'only2', 2, 700), icon: toiletWomenIcon }
		],
		[
			{ id: 'la', name: '教養棟', bounds: [0, 0, 10, 10], floors: { 1: 'f1.svg', 2: 'f2.svg' } },
			{ id: 'only2', name: '2階のみ', bounds: [0, 0, 10, 10], floors: { 2: 'only2.svg' } }
		],
		() => view,
		onSelect
	);
	layer.render({});
	const element = (id: string) => container!.querySelector<HTMLElement>(`[data-marker-id="${id}"]`);
	const tooltip = (id: string) =>
		Array.from(container!.querySelectorAll('.facility-marker-tooltip')).find((element) =>
			element.textContent?.startsWith(`${id}（`)
		) ?? null;
	return { view, onSelect, element, tooltip };
}

describe('facility markers', () => {
	it('assetsの画像を読み込み、部屋のSVGなしでもタップとEnter・Spaceで選択できる', async () => {
		const { element, onSelect } = setup();
		const icon = element('outdoor')!;
		expect(icon.getBoundingClientRect().width).toBe(44);
		const image = icon.querySelector('img')!;
		expect(image.getAttribute('src')).toBe(trashIcon);
		await expect
			.poll(() =>
				Array.from(container!.querySelectorAll('img')).every(
					(image) => image.complete && image.naturalWidth > 0
				)
			)
			.toBe(true);
		await userEvent.click(icon);
		expect(onSelect).toHaveBeenLastCalledWith('outdoor');
		icon.focus();
		await userEvent.keyboard('{Enter}');
		expect(onSelect).toHaveBeenCalledTimes(2);
		await userEvent.keyboard(' ');
		expect(onSelect).toHaveBeenCalledTimes(3);
		const view = map!.getCenter();
		icon.click();
		expect(map!.getCenter()).toEqual(view);
	});

	it('建物の選択階だけ切り替え、屋外・詳細図なし・2階のみの施設も表示する', () => {
		const { element, view } = setup();
		expect(element('floor1')).not.toBeNull();
		expect(element('floor2')).toBeNull();
		expect(element('only2')).not.toBeNull();
		expect(element('no-detail')).not.toBeNull();
		expect(element('outdoor')).not.toBeNull();
		view.activeFloors.la = 2;
		layer!.updateVisible();
		expect(element('floor1')).toBeNull();
		expect(element('floor2')).not.toBeNull();
		expect(element('outdoor')).not.toBeNull();
		expect(element('no-detail')).not.toBeNull();
	});

	it('選択・出発地・目的地の色とラベルを同期し、解除後もアイコンを残す', async () => {
		const { element, tooltip } = setup();
		layer!.render({ start: 'floor1', goal: 'floor1', selected: 'floor1' });
		expect(element('floor1')?.classList.contains('poi-color-selected')).toBe(true);
		expect(tooltip('floor1')?.textContent).toContain('教養棟 1F');
		layer!.render({ start: 'floor1' });
		expect(element('floor1')?.classList.contains('poi-color-selected')).toBe(false);
		expect(element('floor1')?.classList.contains('poi-color-start')).toBe(true);
		expect(tooltip('floor1')?.classList.contains('poi-color-start')).toBe(true);
		layer!.render({});
		expect(element('floor1')).not.toBeNull();
		expect(container!.querySelector('.facility-marker-highlight')).toBeNull();
		await expect.poll(() => tooltip('floor1')).toBeNull();
	});

	it('非表示階のラベルを隠して復帰時に戻し、破棄後にイベントを残さない', async () => {
		const { element, view, onSelect, tooltip } = setup();
		layer!.render({ selected: 'floor1' });
		view.activeFloors.la = 2;
		layer!.updateVisible();
		await expect.poll(() => tooltip('floor1')).toBeNull();
		view.activeFloors.la = 1;
		layer!.updateVisible();
		expect(tooltip('floor1')).not.toBeNull();
		const icon = element('floor1')!;
		layer!.dispose();
		icon.click();
		icon.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
		expect(onSelect).not.toHaveBeenCalled();
		expect(container!.querySelector('.facility-marker')).toBeNull();
		await expect.poll(() => container!.querySelector('.facility-marker-tooltip')).toBeNull();
	});
});
