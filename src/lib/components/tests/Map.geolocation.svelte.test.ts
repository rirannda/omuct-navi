import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import type * as L from 'leaflet';
import Map from '../Map.svelte';
import { createNavigationState } from '../../states/navigation.svelte';
import { LOCATION_CONSENT_KEY } from '../../states/geolocation.svelte';
import toiletIcon from '../../assets/markers/toilet-men.svg';

const { maps } = vi.hoisted(() => ({ maps: [] as L.Map[] }));
vi.mock('leaflet', async (importOriginal) => {
	const leaflet = await importOriginal<typeof L>();
	return {
		...leaflet,
		map: (...args: Parameters<typeof leaflet.map>) => {
			const map = leaflet.map(...args);
			maps.push(map);
			return map;
		}
	};
});

beforeEach(async () => {
	localStorage.removeItem(LOCATION_CONSENT_KEY);
	await page.viewport(390, 844);
});
afterEach(() => {
	vi.restoreAllMocks();
	localStorage.removeItem(LOCATION_CONSENT_KEY);
	maps.length = 0;
});

async function setup() {
	let success!: PositionCallback;
	const appConfirmationOpenAtWatch: boolean[] = [];
	const watchPosition = vi.fn<Geolocation['watchPosition']>((callback) => {
		appConfirmationOpenAtWatch.push(document.querySelector('dialog[open]') !== null);
		success = callback;
		return 11;
	});
	const clearWatch = vi.fn();
	vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({
		watchPosition,
		clearWatch,
		getCurrentPosition: vi.fn()
	});
	vi.spyOn(navigator.permissions, 'query').mockResolvedValue({
		state: 'prompt'
	} as PermissionStatus);
	vi.spyOn(globalThis, 'fetch').mockImplementation(
		async () =>
			new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1700"></svg>')
	);
	const navigation = createNavigationState({
		graph: {
			nodes: [400, 500, 600].map((x, index) => ({
				id: `node-${index}`,
				x,
				y: 500,
				floor: 0,
				buildingId: 'outdoor'
			})),
			edges: [0, 1].map((index) => ({
				id: `edge-${index}`,
				fromNode: `node-${index}`,
				toNode: `node-${index + 1}`,
				isStairs: false,
				weight: 100
			}))
		},
		pois: ['出発地点', '中間地点', '到着地点'].map((name, index) => ({
			id: `poi-${index}`,
			nodeId: `node-${index}`,
			svgId: `point-${index}`,
			name,
			categoryId: '',
			description: ''
		})),
		markers: [
			{
				id: 'toilet',
				nodeId: 'node-1',
				name: 'トイレ',
				categoryId: 'toilet',
				toiletType: 'men',
				description: '',
				icon: toiletIcon,
				buildingId: 'outdoor',
				floor: 0,
				visibility: 'always',
				x: 500,
				y: 500
			}
		],
		config: { mode: 'festival' },
		geolocationReferencePoints: [
			{ latitude: 35, longitude: 135, x: 400, y: 500 },
			{ latitude: 35, longitude: 135.001, x: 500, y: 500 },
			{ latitude: 35.001, longitude: 135, x: 400, y: 600 }
		]
	});
	const rendered = await render(Map, { navigation });
	await expect.poll(() => rendered.container.querySelector('.facility-marker')).not.toBeNull();
	const map = maps.at(-1)!;
	return {
		...rendered,
		navigation,
		map,
		watchPosition,
		appConfirmationOpenAtWatch,
		clearWatch,
		position(x: number, y = 500) {
			success({
				coords: {
					latitude: 35 + (y - 500) / 100000,
					longitude: 135 + (x - 400) / 100000,
					accuracy: 3
				},
				timestamp: Date.now()
			} as GeolocationPosition);
		},
		async expectCentered(x: number, y = 500) {
			await expect
				.poll(
					() => {
						const point = map.latLngToContainerPoint([y, x]);
						const height = rendered.container
							.querySelector('.bottom-sheet')!
							.getBoundingClientRect().height;
						return (
							Math.abs(point.x - map.getSize().x / 2) < 2 &&
							Math.abs(point.y - (map.getSize().y - height) / 2) < 2
						);
					},
					{ timeout: 3000 }
				)
				.toBe(true);
		}
	};
}

describe('GPS interactions', () => {
	it.each(['current', 'route', 'nearby'] as const)(
		'同意が保存済みでも、機能起動→アプリの確認を閉じる→ブラウザの許可要求の順に進む (%s)',
		async (feature) => {
			localStorage.setItem(LOCATION_CONSENT_KEY, 'accepted');
			const app = await setup();
			expect(app.watchPosition).not.toHaveBeenCalled();
			expect(app.container.querySelector('dialog[open]')).toBeNull();
			if (feature === 'current')
				await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
			else {
				app.navigation.setHighlight('poi-0', 'start');
				app.navigation.setHighlight('poi-2', 'goal');
				await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
				await app
					.getByRole('button', {
						name: feature === 'route' ? 'ルート検索' : '近くのトイレを表示',
						exact: true
					})
					.click();
			}
			await expect.poll(() => app.container.querySelector('dialog[open]')).not.toBeNull();
			expect(app.watchPosition).not.toHaveBeenCalled();
			await app.getByRole('button', { name: '同意して利用', exact: true }).click();
			expect(app.appConfirmationOpenAtWatch).toEqual([false]);
			expect(app.watchPosition).toHaveBeenCalledTimes(1);
		}
	);
	it('全体表示の縮尺でも、経路上の現在地をシートに隠さず追従を開始する', async () => {
		const app = await setup();
		app.map.setView([850, 700], -2, { animate: false });
		app.navigation.setGpsLocation({ enabled: true, position: { x: 450, y: 500 } });
		app.navigation.showRoute('node-0', 'node-2');
		await app.expectCentered(450);
		expect(app.map.getZoom()).toBe(2);
	});
	it('ルート検索が初回のGPS利用でも共通の確認を出し、同意後にルート上の現在地へ追従する', async () => {
		const app = await setup();
		app.navigation.setHighlight('poi-0', 'start');
		app.navigation.setHighlight('poi-2', 'goal');
		await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await app.getByRole('button', { name: 'ルート検索', exact: true }).click();
		expect(app.container.querySelector('dialog[open]')).not.toBeNull();
		expect(app.watchPosition).not.toHaveBeenCalled();
		await app.getByRole('button', { name: '同意して利用', exact: true }).click();
		app.position(450);
		await app.expectCentered(450);
		app.position(470);
		await app.expectCentered(470);
	});
	it('検索の初回確認を現在地ボタンと共有し、同意前は測位せず、現在地を表示・移動する', async () => {
		const app = await setup();
		await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await app.getByRole('button', { name: '近くのトイレを表示', exact: true }).click();
		expect(app.container.querySelector('dialog[open]')).not.toBeNull();
		expect(app.watchPosition).not.toHaveBeenCalled();
		expect(app.container.querySelector('dialog a')?.getAttribute('href')).toBe('/privacy');
		await app.getByRole('button', { name: '同意して利用', exact: true }).click();
		await expect.poll(() => app.watchPosition.mock.calls.length).toBe(1);
		app.position(450);
		await expect.poll(() => app.container.querySelector('.current-location-marker')).not.toBeNull();
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await app.expectCentered(450);
		expect(app.container.querySelector('dialog[open]')).toBeNull();
		expect(app.watchPosition).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem(LOCATION_CONSENT_KEY)).toBe('accepted');
		await app.unmount();
		expect(app.clearWatch).toHaveBeenCalledWith(11);
	});
	it.each([390, 1280])(
		'現在地付近に停止方法を案内し、中段で停止した後は検索では再開せず現在地ボタンで確認し直す (%s)',
		async (width) => {
			await page.viewport(width, 844);
			const app = await setup();
			const currentLocation = app.getByRole('button', { name: '現在地に移動', exact: true });
			await currentLocation.click();
			await app.getByRole('button', { name: '同意して利用', exact: true }).click();
			app.position(450);
			const button = app.container.querySelector('.current-location-button')!;
			const hint = app.container.querySelector<HTMLElement>(
				`[id="${button.getAttribute('aria-describedby')}"]`
			)!;
			expect(hint.textContent).toContain('停止は下のシートから。');
			expect(hint.getBoundingClientRect().right).toBeLessThanOrEqual(
				button.getBoundingClientRect().left
			);
			expect(hint.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
			const attribution = app.container.querySelector('.leaflet-control-attribution')!;
			expect(hint.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				attribution.getBoundingClientRect().top
			);
			await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
			const sheet = app.container.querySelector<HTMLElement>('.bottom-sheet')!;
			const stop = Array.from(sheet.querySelectorAll('button')).find(
				(element) => element.textContent?.trim() === '位置情報の利用を停止'
			)!;
			expect(sheet.dataset.snap).toBe('middle');
			await expect
				.poll(() => stop.getBoundingClientRect().bottom <= sheet.getBoundingClientRect().bottom)
				.toBe(true);
			await app.getByRole('button', { name: '位置情報の利用を停止', exact: true }).click();
			expect(app.clearWatch).toHaveBeenCalledWith(11);
			expect(app.navigation.gpsLocation).toEqual({ enabled: false });
			expect(localStorage.getItem(LOCATION_CONSENT_KEY)).toBe('declined');
			await expect.poll(() => app.container.querySelector(`#${CSS.escape(hint.id)}`)).toBeNull();
			app.navigation.setHighlight('poi-0', 'start');
			app.navigation.setHighlight('poi-2', 'goal');
			await app.getByRole('button', { name: 'ルート検索', exact: true }).click();
			expect(app.navigation.routePath).toEqual(['node-0', 'node-1', 'node-2']);
			expect(await app.navigation.requestGps()).toBe(false);
			expect(app.container.querySelector('dialog[open]')).toBeNull();
			expect(app.watchPosition).toHaveBeenCalledTimes(1);
			await currentLocation.click();
			expect(app.container.querySelector('dialog[open]')).not.toBeNull();
			expect(app.watchPosition).toHaveBeenCalledTimes(1);
			await app.getByRole('button', { name: '同意して利用', exact: true }).click();
			expect(app.watchPosition).toHaveBeenCalledTimes(2);
		}
	);
	it('初回測位を待つ間も中段から停止でき、遅い位置更新を表示しない', async () => {
		const app = await setup();
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await app.getByRole('button', { name: '同意して利用', exact: true }).click();
		expect(
			app.container.querySelector<HTMLButtonElement>('.current-location-button')!.disabled
		).toBe(true);
		await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await app.getByRole('button', { name: '位置情報の利用を停止', exact: true }).click();
		app.position(450);
		expect(app.clearWatch).toHaveBeenCalledWith(11);
		expect(app.navigation.gpsLocation).toEqual({ enabled: false });
		expect(app.container.querySelector('.current-location-marker')).toBeNull();
	});
	it.each(['outside', 'timeout'] as const)(
		'測位エラー後もシートから利用停止を選び、エラーと次の検索での自動再開を解除できる (%s)',
		async (reason) => {
			const app = await setup();
			await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
			await app.getByRole('button', { name: '同意して利用', exact: true }).click();
			if (reason === 'outside') app.position(2000);
			else app.watchPosition.mock.calls[0][1]!({ code: 3 } as GeolocationPositionError);
			expect(app.navigation.gps.active).toBe(false);
			expect(app.navigation.gps.error).toContain(
				reason === 'outside' ? '範囲外' : '時間がかかっています'
			);
			expect(localStorage.getItem(LOCATION_CONSENT_KEY)).toBe('accepted');
			await expect
				.poll(() => app.container.querySelector('[id$="-location-stop-hint"]')?.textContent)
				.toContain('現在地を取得できません。');
			await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
			await app.getByRole('button', { name: '位置情報の利用を停止', exact: true }).click();
			expect(app.navigation.gps.error).toBeNull();
			expect(app.navigation.gpsLocation).toEqual({ enabled: false });
			expect(localStorage.getItem(LOCATION_CONSENT_KEY)).toBe('declined');
			app.navigation.requestGpsForRoute();
			expect(await app.navigation.requestGps()).toBe(false);
			expect(app.watchPosition).toHaveBeenCalledTimes(1);
			expect(app.container.querySelector('dialog[open]')).toBeNull();
		}
	);

	it('確認のキャンセルでは測位せず手動検索に進み、現在地ボタンの確認はEscapeでも閉じる', async () => {
		const app = await setup();
		await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await app.getByRole('button', { name: '近くのトイレを表示', exact: true }).click();
		await app.getByRole('button', { name: '使わない', exact: true }).click();
		await expect.poll(() => app.container.querySelector('[id$="-building"]')).not.toBeNull();
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await userEvent.keyboard('{Escape}');
		await expect.poll(() => app.container.querySelector('dialog[open]')).toBeNull();
		expect(app.watchPosition).not.toHaveBeenCalled();
		expect(localStorage.getItem(LOCATION_CONSENT_KEY)).toBe('declined');
	});

	it('検索後はルート上で追従し、操作で解除、現在地ボタンで再開、ルート外では移動しない', async () => {
		const app = await setup();
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await app.getByRole('button', { name: '同意して利用', exact: true }).click();
		app.position(450);
		await app.expectCentered(450);
		app.navigation.setHighlight('poi-0', 'start');
		app.navigation.setHighlight('poi-2', 'goal');
		await app.getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await app.getByRole('button', { name: 'ルート検索', exact: true }).click();
		await app.expectCentered(450);
		app.position(470);
		await app.expectCentered(470);
		// アプリ側のカメラ操作やmoveイベントでは追従を解除しません。
		app.map.panBy([10, 0], { animate: false });
		app.position(480);
		await app.expectCentered(480);
		app.container
			.querySelector('.map-container')!
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
		app.map.panBy([30, 0], { animate: false });
		const manuallyMoved = app.map.getCenter();
		app.position(490);
		await expect
			.poll(() => app.navigation.gpsLocation.enabled && app.navigation.gpsLocation.position?.x)
			.toBeCloseTo(490);
		expect(app.map.getCenter()).toEqual(manuallyMoved);
		await app.getByRole('button', { name: 'ルート検索', exact: true }).click();
		await app.expectCentered(490);
		app.container
			.querySelector('.map-container')!
			.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
		app.map.panBy([30, 0], { animate: false });
		const afterWheel = app.map.getCenter();
		app.position(495);
		await expect
			.poll(() => app.navigation.gpsLocation.enabled && app.navigation.gpsLocation.position?.x)
			.toBeCloseTo(495);
		expect(app.map.getCenter()).toEqual(afterWheel);
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await app.expectCentered(495);
		const onRoute = app.map.getCenter();
		app.position(490, 600);
		await expect
			.poll(() => app.navigation.gpsLocation.enabled && app.navigation.gpsLocation.position?.y)
			.toBeCloseTo(600);
		expect(app.map.getCenter()).toEqual(onRoute);
		app.position(520);
		await app.expectCentered(520);
		app.navigation.clearRoute();
		await expect.poll(() => app.container.querySelector('.current-location-marker')).toBeNull();
		expect(app.clearWatch).toHaveBeenCalledWith(11);
		app.position(550);
		expect(app.navigation.gpsLocation).toEqual({ enabled: false });
	});

	it('初回測位を待つ間に操作したら、遅れて位置を取得してもカメラを奪わない', async () => {
		const app = await setup();
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await app.getByRole('button', { name: '同意して利用', exact: true }).click();
		app.container
			.querySelector('.map-container')!
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
		const center = app.map.getCenter();
		app.position(450);
		await expect.poll(() => app.container.querySelector('.current-location-marker')).not.toBeNull();
		expect(app.map.getCenter()).toEqual(center);
		await app.getByRole('button', { name: '現在地に移動', exact: true }).click();
		await app.expectCentered(450);
	});
});
