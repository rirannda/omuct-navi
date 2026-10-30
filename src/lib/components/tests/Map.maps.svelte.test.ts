import { tapBuilding } from './mapTestHelpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type * as LType from 'leaflet';
import Map from '../Map.svelte';
import { createNavigationState } from '../../states/navigation.svelte';
import { flushSync } from 'svelte';
import { baseMapFiles, buildingMaps } from '../../../data/maps';
import { MAX_FLOOR_CONTROL_LINE_LENGTH } from '../../map/floorControlLayout';

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

beforeEach(async () => {
	await page.viewport(1280, 900);
});

afterEach(() => {
	vi.restoreAllMocks();
	maps.length = 0;
});

function mockMaps(outlines: Record<string, string> = {}) {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const file = String(input).split('/').at(-1)!;
		const building = buildingMaps.find((building) => Object.values(building.floors).includes(file));
		const [left, top, right, bottom] = building?.bounds ?? [0, 0, 10, 10];
		const shapes =
			file === 'master.svg'
				? buildingMaps
						.map((building) => {
							const [x, y, right, bottom] = building.bounds;
							return `<g id="${building.svgId ?? building.id}"><rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" /></g>`;
						})
						.join('')
				: file === 'entrance.svg'
					? '<g id="entrance"><path d="M561 1276H766V1324H561Z" /></g>'
					: '';
		return new Response(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1700" data-map="${file}">${shapes}<path id="${file}_flame" d="${outlines[building?.id ?? ''] ?? `M${left} ${top}H${right}V${bottom}H${left}Z`}" fill="${building?.id === 'entrance' ? '#fff' : 'none'}" stroke="black" /><g><path id="${file}_room-wall" d="M${left} ${top}H${right}" stroke="black" /></g><path id="${file}_decoration" d="M${left} ${top}H${right}" stroke="none" /></svg>`,
			{ headers: { 'Content-Type': 'image/svg+xml' } }
		);
	});
}

async function renderMap() {
	const navigation = createNavigationState();
	const rendered = await render(Map, { props: { navigation } });
	return { ...rendered, navigation };
}

async function renderFloorMap() {
	const rendered = await renderMap();
	await expect
		.poll(() => rendered.container.querySelector('[data-map="master.svg"]'))
		.not.toBeNull();
	maps.at(-1)!.setView([555, 700], 0, { animate: false });
	return rendered;
}

function panelsFit(container: HTMLElement): boolean {
	const viewport = container.querySelector('.map-container')!.getBoundingClientRect();
	const panels = Array.from(container.querySelectorAll('[data-building]'));
	if (!panels.length) return false;
	const bounds = panels.map((panel) => panel.getBoundingClientRect());
	return bounds.every(
		(rect, index) =>
			rect.width > 0 &&
			rect.height > 0 &&
			rect.left >= viewport.left &&
			rect.right <= viewport.right &&
			rect.top >= viewport.top + 50 &&
			rect.bottom <= viewport.bottom &&
			bounds
				.slice(0, index)
				.every(
					(other) =>
						rect.right <= other.left ||
						rect.left >= other.right ||
						rect.bottom <= other.top ||
						rect.top >= other.bottom
				)
	);
}

function routeTouchesNode(map: LType.Map, node: { x: number; y: number }): boolean {
	let touches = false;
	map.eachLayer((layer) => {
		const line = layer as LType.Polyline;
		if (line.options.className !== 'route-path') return;
		const points = line.getLatLngs() as LType.LatLng[];
		if (
			points.some(
				(point) => Math.abs(point.lat - node.y) < 0.001 && Math.abs(point.lng - node.x) < 0.001
			)
		)
			touches = true;
	});
	return touches;
}

describe('Map floor maps', () => {
	it('建物をタップするまで階別表示せず、タップした1棟だけを表示する', async () => {
		mockMaps();
		const { container, component, navigation } = await renderFloorMap();
		const map = maps.at(-1)!;
		expect(navigation.highlights.start).toBe('poi_hr_2i');
		for (const zoom of [-1, 0, 2]) {
			map.setView([555, 700], zoom, { animate: false });
			expect(container.querySelector('.building-controls')).toBeNull();
			expect(container.querySelector('.leaflet-floor-maps-pane > svg')).toBeNull();
		}
		component.focusOnPoiId('poi_hr_2i');
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim'), { timeout: 3000 })
			.toBeNull();
		expect(container.querySelector('.building-controls')).toBeNull();
		await page
			.elementLocator(container.querySelector('.building-selectable#la-bldg rect')!)
			.click();
		await expect.poll(() => container.querySelector('[data-building="la"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
		expect(container.querySelectorAll('.leaflet-floor-maps-pane > svg')).toHaveLength(1);
		await tapBuilding(container, 'lib');
		expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
		expect(container.querySelector('[data-map="la-bldg_F2.svg"]')).toBeNull();
		expect(container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
		map.setView([817, 780], 2, { animate: false });
		expect(container.querySelector('[data-building="ss1"]')).toBeNull();
		expect(container.querySelector('[data-map="lib_F2.svg"]')).not.toBeNull();
	});

	it('行き先を確定したときに対象棟の階別図を表示し、再検索では棟と階を切り替える', async () => {
		mockMaps();
		const { container, getByRole, navigation } = await renderFloorMap();
		const goal = getByRole('combobox', { name: '行き先', exact: true });
		await goal.fill('HR教室:3I');
		expect(container.querySelector('.leaflet-floor-maps-pane > svg')).toBeNull();
		await getByRole('button', { name: 'HR教室:3I', exact: true }).click();
		await expect.poll(() => container.querySelector('[data-map="la-bldg_F3.svg"]')).not.toBeNull();
		expect(container.querySelector('[data-building="la"] button.active')?.textContent?.trim()).toBe(
			'3F'
		);
		expect(navigation.routePath).toBeNull();
		await goal.fill('ソフトウェア工学実験室');
		await getByRole('button', { name: 'ソフトウェア工学実験室', exact: true }).click();
		await expect
			.poll(() => container.querySelector('[data-map="ss-bldg_1_F3.svg"]'))
			.not.toBeNull();
		expect(container.querySelector('[data-map="la-bldg_F3.svg"]')).toBeNull();
		expect(container.querySelectorAll('.leaflet-floor-maps-pane > svg')).toHaveLength(1);
		await goal.fill('正門');
		await getByRole('button', { name: '正門', exact: true }).click();
		await expect.poll(() => container.querySelector('.leaflet-floor-maps-pane > svg')).toBeNull();
		expect(container.querySelector('.building-controls')).toBeNull();
	});

	it('出発地の確定では階別図を開かず、行き先確定後もルート表示の階UIは閉じて開始する', async () => {
		mockMaps();
		const { container, getByRole, navigation } = await renderFloorMap();
		await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await getByRole('combobox', { name: '出発地', exact: true }).fill('HR教室:1-2');
		await getByRole('button', { name: 'HR教室:1-2', exact: true }).click();
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim'), { timeout: 3000 })
			.toBeNull();
		expect(container.querySelector('.leaflet-floor-maps-pane > svg')).toBeNull();
		await getByRole('combobox', { name: '行き先', exact: true }).fill('HR教室:1-1');
		await getByRole('button', { name: 'HR教室:1-1', exact: true }).click();
		await expect.poll(() => container.querySelector('[data-map="la-bldg_F1.svg"]')).not.toBeNull();
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		await expect.poll(() => container.querySelector('.route-path')).not.toBeNull();
		expect(navigation.routePath).not.toBeNull();
		expect(container.querySelector('.building-controls')).toBeNull();
	});

	it('各棟の共通図を選んで公開階を切り替え、選択前の階別図を取り除く', async () => {
		const fetchMaps = mockMaps();
		const { container, getByRole } = await renderFloorMap();
		const map = maps.at(-1)!;
		const files = [
			...new Set([
				...baseMapFiles,
				...buildingMaps.flatMap((building) => [
					...Object.values(building.floors),
					...(building.overview ? [building.overview] : [])
				])
			])
		];
		expect(fetchMaps.mock.calls.map(([url]) => String(url)).toSorted()).toEqual(
			files.map((file) => `/maps/${file}`).toSorted()
		);
		for (const building of buildingMaps) {
			const [left, top, right, bottom] = building.bounds;
			map.setView([1700 - (top + bottom) / 2, (left + right) / 2], 2, { animate: false });
			await tapBuilding(container, building.id);
			expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
			if (Object.keys(building.floors).length === 1) {
				expect(container.querySelector(`[data-building="${building.id}"] h3`)?.textContent).toBe(
					building.name
				);
				expect(container.querySelector(`[data-building="${building.id}"] button`)).toBeNull();
				expect(container.querySelector(`[data-connector="${building.id}"]`)).toBeNull();
				continue;
			}
			const panel = getByRole('region', { name: `${building.name}の階` });
			for (const floor of Object.keys(building.floors).map(Number)) {
				await panel
					.getByRole('button', {
						name: building.floorLabels?.[floor] ?? `${floor}F`,
						exact: true
					})
					.click();
				expect(container.querySelector(`[data-map="${building.floors[floor]}"]`)).not.toBeNull();
				expect(container.querySelectorAll('.leaflet-floor-maps-pane > svg')).toHaveLength(1);
			}
		}
	});

	it('エントランスと食堂の地上ボタンを指定順で表示し、0階レイヤーを選ぶ', async () => {
		mockMaps();
		const { container, getByRole } = await renderFloorMap();
		const map = maps.at(-1)!;
		for (const [id, name, center, labels, file] of [
			['entrance', 'エントランス', [399.75, 664], ['2F', '地上', '1F'], 'entrance.svg'],
			['cafe', '食堂', [466.5, 790.25], ['1F', '地上'], 'cafe_B1.svg']
		] as const) {
			map.setView([...center], 2, { animate: false });
			await tapBuilding(container, id);
			expect(
				Array.from(container.querySelectorAll(`[data-building="${id}"] button`)).map((button) =>
					button.textContent?.trim()
				)
			).toEqual([...labels]);
			await getByRole('region', { name: `${name}の階` })
				.getByRole('button', { name: '地上', exact: true })
				.click();
			expect(
				container.querySelector(`.leaflet-floor-maps-pane [data-map="${file}"]`)
			).not.toBeNull();
		}
	});

	it('ルートの棟だけ階別表示し、タップした棟だけに階切替UIを出す', async () => {
		mockMaps();
		const { container, navigation } = await renderFloorMap();
		await tapBuilding(container, 'gym');
		flushSync(() => navigation.showRoute('node_outdoor_f0_main-gate', 'node_la_f1_hr_1-1'));
		await expect
			.poll(() => container.querySelectorAll('.leaflet-floor-maps-pane > svg').length)
			.toBe(3);
		expect(container.querySelector('.building-controls')).toBeNull();
		expect(container.querySelector('[data-map="gym_F1.svg"]')).toBeNull();
		await tapBuilding(container, 'entrance');
		expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
		expect(
			container.querySelector('[data-building="entrance"] button.active')?.textContent?.trim()
		).toBe('地上');
		await tapBuilding(container, 'la');
		expect(container.querySelector('[data-building="entrance"]')).toBeNull();
		expect(container.querySelectorAll('.leaflet-floor-maps-pane > svg')).toHaveLength(3);
		container
			.querySelector('.building-selectable#lib')!
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(container.querySelector('[data-building="lib"]')).toBeNull();
		// 棟の内部をタップした場合も、その棟のUIを開きます。
		container
			.querySelector('[data-map="skybridge_f1.svg"] [id$="_flame"]')!
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await expect.poll(() => container.querySelector('[data-building="skybridge"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
		maps.at(-1)!.fire('click', { originalEvent: new MouseEvent('click') });
		await expect.poll(() => container.querySelector('.building-controls')).toBeNull();
		expect(container.querySelectorAll('.leaflet-floor-maps-pane > svg')).toHaveLength(3);
		flushSync(() => navigation.clearRoute());
		await expect.poll(() => container.querySelector('[data-building="gym"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
	});

	it('建物外のタップで階別図を解除し、ドラッグでは解除しない', async () => {
		mockMaps();
		const { container, navigation } = await renderFloorMap();
		await tapBuilding(container, 'la');
		maps.at(-1)!.panBy([20, 0], { animate: false });
		expect(container.querySelector('.building-floor-focused')).not.toBeNull();
		maps.at(-1)!.fire('click', { originalEvent: new MouseEvent('click') });
		await expect.poll(() => container.querySelector('.building-controls')).toBeNull();
		expect(container.querySelector('.leaflet-floor-maps-pane > svg')).toBeNull();
		flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_la_f1_hr_1-2'));
		await expect.poll(() => container.querySelector('.building-floor-focused')).not.toBeNull();
		expect(container.querySelector('.building-controls')).toBeNull();
		flushSync(() => navigation.clearRoute());
		expect(container.querySelector('.leaflet-floor-maps-pane > svg')).toBeNull();
	});

	it('別の階を選ぶと経路と端点を隠し、ズームアウト後も選択階を維持する', async () => {
		mockMaps();
		const { container, getByRole, navigation } = await renderFloorMap();
		flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_la_f1_hr_1-2'));
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim'), { timeout: 3000 })
			.toBeNull();
		await tapBuilding(container, 'la');
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '2F', exact: true })
			.click();
		expect(container.querySelector('.route-path')).toBeNull();
		expect(container.querySelector('.route-endpoint-marker')).toBeNull();
		maps.at(-1)!.setZoom(-1, { animate: false });
		expect(container.querySelector('[data-map="la-bldg_F2.svg"]')).not.toBeNull();
		expect(container.querySelector('.route-path')).toBeNull();
		maps.at(-1)!.setView([555, 481], 1, { animate: false });
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '1F', exact: true })
			.click();
		await expect.poll(() => container.querySelector('.route-path')).not.toBeNull();
		expect(container.querySelectorAll('.route-endpoint-marker')).toHaveLength(2);
	});

	it('屋外と建物内で同じ階番号でも別々に経路の表示を判定する', async () => {
		mockMaps();
		const { container, getByRole, navigation } = await renderFloorMap();
		const map = maps.at(-1)!;
		const gate = navigation.resolvePoi('poi_main-gate')!.node;
		const goal = navigation.graph.nodes.find(({ id }) => id === 'node_entrance_f0_cnr_east')!;
		flushSync(() => navigation.showRoute(gate.id, goal.id));
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim'), { timeout: 3000 })
			.toBeNull();
		expect(routeTouchesNode(map, gate)).toBe(true);
		expect(routeTouchesNode(map, goal)).toBe(true);
		await tapBuilding(container, 'entrance');
		await getByRole('region', { name: 'エントランスの階' })
			.getByRole('button', { name: '1F', exact: true })
			.click();
		expect(routeTouchesNode(map, goal)).toBe(false);
		expect(routeTouchesNode(map, gate)).toBe(true);
		expect(container.querySelector('.route-endpoint-goal')).toBeNull();
		expect(container.querySelector('.route-endpoint-start')).not.toBeNull();
	});

	it.each([
		{ width: 390, fontSize: 16 },
		{ width: 390, fontSize: 24 },
		{ width: 1280, fontSize: 16 },
		{ width: 1280, fontSize: 24 }
	])(
		'middleでルート検索ボタンまでスクロールせず表示する ($width px / $fontSize px)',
		async ({ width, fontSize }) => {
			await page.viewport(width, 844);
			const root = document.documentElement;
			const originalFontSize = root.style.fontSize;
			try {
				root.style.fontSize = `${fontSize}px`;
				mockMaps();
				const { container, getByRole } = await renderFloorMap();
				await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
				const sheet = container.querySelector<HTMLElement>('.bottom-sheet')!;
				const content = container.querySelector<HTMLElement>('.sheet-content')!;
				const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
				await expect.poll(() => content.scrollHeight - content.clientHeight).toBeLessThanOrEqual(1);
				expect(sheet.dataset.snap).toBe('middle');
				expect(content.scrollTop).toBe(0);
				expect(submit.getBoundingClientRect().bottom).toBeLessThanOrEqual(
					content.getBoundingClientRect().bottom
				);
			} finally {
				root.style.fontSize = originalFontSize;
			}
		}
	);

	it('シートに帰属表示を追従させ、上段では階層UIを隠し、戻すと選択階を復元する', async () => {
		mockMaps();
		const { container, getByRole } = await renderFloorMap();
		await tapBuilding(container, 'la');
		const sheet = container.querySelector<HTMLElement>('.bottom-sheet')!;
		const attribution = container.querySelector<HTMLElement>('.leaflet-control-attribution')!;
		const zoom = container.querySelector<HTMLElement>('.leaflet-control-zoom')!;
		const handle = getByRole('button', { name: 'ボトムシートの高さを変更' });
		const follows = () =>
			Math.abs(attribution.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top) < 1;
		await expect.poll(follows).toBe(true);
		await handle.click();
		await expect.poll(() => sheet.dataset.snap).toBe('middle');
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '3F', exact: true })
			.click();
		await expect.poll(follows).toBe(true);
		await handle.click();
		await expect.poll(() => container.querySelector('.building-controls')).toBeNull();
		expect(getComputedStyle(attribution).visibility).toBe('hidden');
		expect(getComputedStyle(zoom).visibility).toBe('hidden');
		await handle.click();
		await expect
			.poll(() =>
				container.querySelector('[data-building="la"] button.active')?.textContent?.trim()
			)
			.toBe('3F');
		expect(container.querySelector('[data-map="la-bldg_F3.svg"]')).not.toBeNull();
		await expect.poll(follows).toBe(true);
	});

	it('単一階の棟は名前だけを表示し、複数階の棟は既存の枠と線をUIの色へ揃える', async () => {
		mockMaps();
		const { container } = await renderFloorMap();
		const map = maps.at(-1)!;
		map.setView([314, 1050], 2, { animate: false });
		await tapBuilding(container, 'mah');
		expect(container.querySelector('[data-building="mah"] h3')?.textContent).toBe('武道館');
		expect(container.querySelector('[data-building="mah"] button')).toBeNull();
		expect(container.querySelector('[data-connector="mah"]')).toBeNull();
		map.setView([555, 481], 1, { animate: false });
		await tapBuilding(container, 'la');
		await expect.poll(() => container.querySelector('[data-connector="la"]')).not.toBeNull();
		await expect.poll(() => panelsFit(container)).toBe(true);
		const panel = container.querySelector('[data-building="la"]')!;
		const svg = container.querySelector('.building-floor-focused')!;
		const color = getComputedStyle(panel).borderTopColor;
		expect(getComputedStyle(container.querySelector('[data-connector="la"]')!).stroke).toBe(color);
		for (const selector of ['[id$="_flame"]', '[id$="_room-wall"]']) {
			expect(getComputedStyle(svg.querySelector(selector)!).stroke).toBe(color);
		}
		expect(getComputedStyle(svg.querySelector('[stroke="none"]')!).stroke).toBe('none');
		expect(svg.querySelector('path:not([id])')).toBeNull();
		expect(getComputedStyle(svg.querySelector('[id$="_flame"]')!).filter).toBe('none');
		expect(getComputedStyle(container.querySelector('.building-controls')!).pointerEvents).toBe(
			'none'
		);
	});

	it('実際の輪郭への接続線の上限を移動・ズーム・画面幅の変更後も守る', async () => {
		mockMaps({
			cafe: 'M832.5 1272H757.5V1244.5H748V1195H832.5Z',
			lib: 'M814 1020H921V1148H826V1047H814Z'
		});
		const { container } = await renderFloorMap();
		const map = maps.at(-1)!;
		const wrapper = container.querySelector<HTMLElement>('.map-wrapper')!;
		for (const { width, zoom, center, id } of [
			{ width: 414, zoom: 0, center: [619, 743], id: 'lib' },
			{ width: 390, zoom: 1, center: [595, 620], id: 'la' },
			{ width: 390, zoom: 2, center: [315, 850], id: 'gym' },
			{ width: 1280, zoom: 0, center: [555, 700], id: 'cafe' }
		]) {
			wrapper.style.width = `${width}px`;
			wrapper.style.height = '770px';
			map.invalidateSize({ animate: false, pan: false });
			const sheetHeight = container.querySelector('.bottom-sheet')!.getBoundingClientRect().height;
			map.setView([center[0] - sheetHeight / 2 / 2 ** zoom, center[1]], zoom, { animate: false });
			await tapBuilding(container, id);
			await expect.poll(() => container.querySelector(`[data-connector="${id}"]`)).not.toBeNull();
			const line = container.querySelector<SVGLineElement>(`[data-connector="${id}"]`)!;
			expect(
				Math.hypot(
					line.x1.baseVal.value - line.x2.baseVal.value,
					line.y1.baseVal.value - line.y2.baseVal.value
				)
			).toBeLessThanOrEqual(MAX_FLOOR_CONTROL_LINE_LENGTH);
			const viewport = container.querySelector('.map-container')!.getBoundingClientRect();
			const outline = container.querySelector<SVGGeometryElement>(
				'.building-floor-focused [id$="_flame"]'
			)!;
			const point = new DOMPoint(
				viewport.left + line.x1.baseVal.value,
				viewport.top + line.y1.baseVal.value
			).matrixTransform(outline.getScreenCTM()!.inverse());
			expect(outline.isPointInStroke(point)).toBe(true);
		}
	});

	it('経路に含まれる接続先の階だけを同期する', async () => {
		mockMaps();
		const { container, getByRole, navigation } = await renderFloorMap();
		flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_ss2_f1_stair_west'));
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim'), { timeout: 3000 })
			.toBeNull();
		maps.at(-1)!.setView([920, 603], 0, { animate: false });
		await tapBuilding(container, 'skybridge');
		await getByRole('region', { name: '渡り廊下の階' })
			.getByRole('button', { name: '2F', exact: true })
			.click();
		for (const file of [
			'la-bldg_F2.svg',
			'skybridge_f2.svg',
			'staircase_F2.svg',
			'ss-bldg_2_F2.svg'
		]) {
			expect(container.querySelector(`[data-map="${file}"]`)).not.toBeNull();
		}
		expect(container.querySelectorAll('[data-building]')).toHaveLength(1);
		expect(container.querySelector('[data-building="ss1"]')).toBeNull();
		expect(container.querySelector('[data-building="gym"]')).toBeNull();
	});

	it('他棟を選択したり表示範囲を移動しても各棟の選択階と色を維持する', async () => {
		mockMaps();
		const { container, getByRole } = await renderFloorMap();
		const map = maps.at(-1)!;
		map.setView([315, 850], 2, { animate: false });
		await tapBuilding(container, 'gym');
		const firstFloor = container.querySelector('[data-map="gym_F1.svg"]')!;
		await getByRole('region', { name: '体育館の階' })
			.getByRole('button', { name: '2F', exact: true })
			.click();
		const color = getComputedStyle(
			container.querySelector('[data-building="gym"]')!
		).borderTopColor;
		expect(firstFloor.classList.contains('building-floor-focused')).toBe(false);
		await tapBuilding(container, 'lib');
		expect(container.querySelector('[data-map="gym_F2.svg"]')).toBeNull();
		map.setView([315, 850], 2, { animate: false });
		await tapBuilding(container, 'gym');
		expect(container.querySelector('[data-map="gym_F2.svg"]')).not.toBeNull();
		expect(getComputedStyle(container.querySelector('[data-building="gym"]')!).borderTopColor).toBe(
			color
		);
	});

	it('経路が見つからない場合は画面を揺らしてエラーを表示し、再試行でも揺らす', async () => {
		mockMaps();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const base = createNavigationState();
		const navigation = createNavigationState({
			graph: { nodes: base.graph.nodes, edges: [] },
			pois: base.pois
		});
		navigation.setHighlight('poi_hr_1-1', 'goal');
		const { container, getByRole } = await render(Map, { props: { navigation } });
		await expect.poll(() => container.querySelector('[data-map="master.svg"]')).not.toBeNull();
		await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		const wrapper = container.querySelector<HTMLElement>('.map-wrapper')!;
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		await expect.poll(() => wrapper.getAnimations().length).toBe(1);
		const firstAnimation = wrapper.getAnimations()[0];
		expect(
			(firstAnimation.effect as KeyframeEffect)
				.getKeyframes()
				.some(({ transform }) => transform === 'translateX(-6px)')
		).toBe(true);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain(
			'経路が見つかりません'
		);
		await firstAnimation.finished;
		await expect
			.poll(() => {
				const alert = container.querySelector('[role="alert"]')!.getBoundingClientRect();
				const sheet = container.querySelector('.bottom-sheet')!.getBoundingClientRect();
				return alert.bottom <= sheet.bottom - 8;
			})
			.toBe(true);
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		await expect.poll(() => wrapper.getAnimations().length).toBe(1);
		expect(wrapper.getAnimations()[0]).not.toBe(firstAnimation);
		expect(navigation.routeErrorVersion).toBe(2);
	});

	it('SVGの座標を保ち、移動できる範囲の上下左右へ各25%の余白を設ける', async () => {
		mockMaps();
		const { container } = await renderFloorMap();
		const map = maps.at(-1)!;
		const bounds = map.options.maxBounds as LType.LatLngBounds;
		expect([bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()]).toEqual([
			-425, -350, 2125, 1750
		]);
		const master = container.querySelector('[data-map="master.svg"]')!;
		expect(master.getAttribute('viewBox')).toBe('0 0 1400 1700');
		map.setView([-100, -100], 2, { animate: false });
		expect(map.getCenter().lat).toBeLessThan(0);
		expect(map.getCenter().lng).toBeLessThan(0);
		map.setView([1800, 1500], 2, { animate: false });
		expect(map.getCenter().lat).toBeGreaterThan(1700);
		expect(map.getCenter().lng).toBeGreaterThan(1400);
	});

	it('近い地点の案内・始点・終点の吹き出しを重ねず、ズームや幅の変更後も配置する', async () => {
		mockMaps();
		const { navigation, container } = await renderFloorMap();
		await expect.poll(() => container.querySelector('[data-map="master.svg"]')).not.toBeNull();
		const map = maps.at(-1)!;
		await new Promise<void>((resolve) => {
			map.once('moveend', () => resolve());
			flushSync(() => navigation.showRoute('node_la_f1_entrance', 'node_skybridge_f1_ee_la-south'));
		});
		const fitsWithoutOverlap = () => {
			const labels = Array.from(
				container.querySelectorAll('.route-transition-label, .route-endpoint-label')
			);
			if (labels.length !== 3) return false;
			const viewport = container.querySelector('.map-container')!.getBoundingClientRect();
			const bounds = labels.map((element) => element.getBoundingClientRect());
			return bounds.every(
				(rect, index) =>
					rect.width > 0 &&
					rect.left >= viewport.left &&
					rect.right <= viewport.right &&
					rect.top >= viewport.top &&
					rect.bottom <= viewport.bottom &&
					bounds
						.slice(0, index)
						.every(
							(other) =>
								rect.right <= other.left ||
								rect.left >= other.right ||
								rect.bottom <= other.top ||
								rect.top >= other.bottom
						)
			);
		};
		await expect.poll(fitsWithoutOverlap).toBe(true);
		expect(container.querySelector('.route-label-connector')).not.toBeNull();
		map.setZoom(0, { animate: false });
		await expect.poll(fitsWithoutOverlap).toBe(true);
		container.querySelector<HTMLElement>('.map-wrapper')!.style.width = '320px';
		map.invalidateSize({ animate: false });
		await expect.poll(fitsWithoutOverlap).toBe(true);
		flushSync(() => navigation.clearRoute());
		expect(container.querySelector('.route-label-connector')).toBeNull();
		await expect
			.poll(() => container.querySelector('.route-transition-label, .route-endpoint-label'))
			.toBeNull();
	});
});
