import { tapBuilding } from './mapTestHelpers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type * as LType from 'leaflet';
import Map from '../Map.svelte';
import { createNavigationState } from '../../states/navigation.svelte';

const { maps } = vi.hoisted(() => ({ maps: [] as LType.Map[] }));
vi.mock('leaflet', async (importOriginal) => {
	const L = await importOriginal<typeof LType>();
	return {
		...L,
		map: (...args: Parameters<typeof L.map>) => {
			const map = L.map(...args);
			maps.push(map);
			return map;
		}
	};
});

vi.mock('../../../data/maps', async (importOriginal) => {
	const data = await importOriginal<typeof import('../../../data/maps')>();
	return {
		...data,
		buildingMaps: data.buildingMaps.map((building) =>
			building.id === 'lib' ? { ...building, floors: { 2: 'lib_F2.svg' } } : building
		)
	};
});

afterEach(() => {
	vi.restoreAllMocks();
	maps.length = 0;
});

async function renderRestrictedMap() {
	const fetchMap = globalThis.fetch.bind(globalThis);
	const fetchMaps = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const file = String(input).split('/').at(-1);
		if (file === 'master.svg') return fetchMap(input);
		return new Response(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1700" data-map="${file}"></svg>`,
			{ headers: { 'Content-Type': 'image/svg+xml' } }
		);
	});
	const rendered = await render(Map, { props: { navigation: createNavigationState() } });
	await expect
		.poll(() => rendered.container.querySelector('.leaflet-overlay-pane #master'))
		.not.toBeNull();
	return { ...rendered, map: maps.at(-1)!, fetchMaps };
}

describe('Map restricted floors', () => {
	it('2階だけの建物を初めて表示すると2階を選び、非公開階を表示・取得しない', async () => {
		const { container, map, fetchMaps } = await renderRestrictedMap();
		map.setView([616, 867.5], 2, { animate: false });
		await tapBuilding(container, 'lib');
		await expect.poll(() => container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-building="lib"] h3')?.textContent).toBe('図書館');
		expect(container.querySelector('[data-connector="lib"]')).toBeNull();
		expect(container.querySelectorAll('[data-building="lib"] button').length).toBe(0);
		expect(container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-map="lib_F1.svg"]')).toBeNull();
		expect(fetchMaps.mock.calls.some(([url]) => String(url).endsWith('lib_F1.svg'))).toBe(false);
	});

	it('別の建物の4階から2階だけの建物へ移動すると2階を表示する', async () => {
		const { container, getByRole, map } = await renderRestrictedMap();
		map.setView([817, 780], 2, { animate: false });
		await tapBuilding(container, 'ss1');
		await getByRole('region', { name: '専門棟1の階' })
			.getByRole('button', { name: '4F', exact: true })
			.click();
		expect(container.querySelector('[data-map="ss-bldg_1_F4.svg"]')).not.toBeNull();
		map.setView([616, 867.5], 2, { animate: false });
		await tapBuilding(container, 'lib');
		await expect.poll(() => container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-building="lib"] h3')?.textContent).toBe('図書館');
		expect(container.querySelector('[data-connector="lib"]')).toBeNull();
		expect(container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
	});

	it('非公開の1階への移動を指定されても登録済みの2階を表示する', async () => {
		const { component, container, map } = await renderRestrictedMap();
		map.setView([616, 867.5], 2, { animate: false });
		await tapBuilding(container, 'lib');
		await expect.poll(() => container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		component.focusOnPoiId('poi_reading-room');
		await expect.poll(() => container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-building="lib"] h3')?.textContent).toBe('図書館');
		expect(container.querySelector('[data-connector="lib"]')).toBeNull();
		expect(container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-map="lib_F1.svg"]')).toBeNull();
	});
});
