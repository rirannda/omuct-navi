import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BottomSheet from '../BottomSheet.svelte';

afterEach(() => vi.restoreAllMocks());

async function renderSheet() {
	const onheightchange = vi.fn();
	const onsettle = vi.fn();
	const rendered = await render(BottomSheet, { onheightchange, onsettle });
	rendered.container.style.cssText = 'position: relative; width: 390px; height: 800px';
	const sheet = rendered.container.querySelector<HTMLElement>('.bottom-sheet')!;
	const handle = rendered.container.querySelector<HTMLButtonElement>('.drag-handle')!;
	await expect.poll(() => sheet.getBoundingClientRect().height).toBe(144);
	return { ...rendered, sheet, handle, onheightchange, onsettle };
}

function pointer(handle: HTMLElement, type: string, y: number, time: number) {
	const event = new PointerEvent(type, {
		bubbles: true,
		pointerId: 1,
		pointerType: 'touch',
		isPrimary: true,
		button: 0,
		clientY: y
	});
	Object.defineProperty(event, 'timeStamp', { value: time });
	handle.dispatchEvent(event);
}

describe('BottomSheet', () => {
	it('初期状態は下に表示し、タップで中央・上・下に切り替える', async () => {
		const { sheet, handle, getByRole, onheightchange, onsettle } = await renderSheet();
		expect(sheet.dataset.snap).toBe('bottom');
		expect(handle.getAttribute('aria-expanded')).toBe('false');
		const button = getByRole('button', { name: 'ボトムシートの高さを変更' });
		await button.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBeCloseTo(470.4, 1);
		expect(sheet.dataset.snap).toBe('middle');
		await expect.poll(() => onsettle.mock.lastCall).toEqual(['middle', 470.4]);
		expect(handle.getAttribute('aria-expanded')).toBe('true');
		await button.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(784);
		expect(sheet.dataset.snap).toBe('top');
		await button.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(144);
		await expect.poll(() => onheightchange.mock.lastCall?.[0]).toBe(144);
		expect(onsettle).toHaveBeenLastCalledWith('bottom', 144);
	});

	it('タッチのドラッグに追従して3段階にスナップし、直後のクリックで飛ばさない', async () => {
		const { sheet, handle, onheightchange } = await renderSheet();
		vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {});
		pointer(handle, 'pointerdown', 720, 100);
		pointer(handle, 'pointermove', 440, 500);
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(424);
		expect(onheightchange).toHaveBeenLastCalledWith(424);
		pointer(handle, 'pointerup', 440, 700);
		handle.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBeCloseTo(470.4, 1);
		expect(sheet.dataset.snap).toBe('middle');
		pointer(handle, 'pointerdown', 440, 800);
		pointer(handle, 'pointermove', 0, 1200);
		pointer(handle, 'pointerup', 0, 1400);
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(784);
		expect(sheet.dataset.snap).toBe('top');
		pointer(handle, 'pointerdown', 0, 1500);
		pointer(handle, 'pointermove', 1000, 1900);
		pointer(handle, 'pointerup', 1000, 2100);
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(144);
		expect(sheet.dataset.snap).toBe('bottom');
	});

	it('ドラッグの中断では元のスナップ位置へ戻す', async () => {
		const { sheet, handle } = await renderSheet();
		vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {});
		pointer(handle, 'pointerdown', 720, 100);
		pointer(handle, 'pointermove', 240, 500);
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(624);
		pointer(handle, 'pointercancel', 240, 700);
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(144);
		expect(sheet.dataset.snap).toBe('bottom');
	});

	it('画面の高さが変わっても現在の段階を維持する', async () => {
		const { container, sheet, getByRole } = await renderSheet();
		const button = getByRole('button', { name: 'ボトムシートの高さを変更' });
		await button.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBeCloseTo(470.4, 1);
		container.style.height = '600px';
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(384);
		container.style.height = '360px';
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(344);
		expect(sheet.dataset.snap).toBe('middle');
		container.style.height = '600px';
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(384);
		await button.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(584);
		await button.click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(144);
	});

	it('内容の必要高さが中段を超える場合だけ、中段を内容に合わせて広げる', async () => {
		const { container, sheet, getByRole, rerender } = await renderSheet();
		await rerender({ contentMinHeight: 300 });
		await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await expect.poll(() => sheet.getBoundingClientRect().height).toBeCloseTo(470.4, 1);
		const content = container.querySelector<HTMLElement>('.sheet-content')!;
		const { paddingTop, paddingBottom } = getComputedStyle(content);
		const chrome = 48 + parseFloat(paddingTop) + parseFloat(paddingBottom);
		await rerender({ contentMinHeight: 600 });
		await expect.poll(() => sheet.getBoundingClientRect().height).toBeCloseTo(600 + chrome, 1);
		expect(sheet.dataset.snap).toBe('middle');
		await rerender({ contentMinHeight: 2000 });
		await expect.poll(() => sheet.getBoundingClientRect().height).toBe(784);
		await rerender({ contentMinHeight: undefined });
		await expect.poll(() => sheet.getBoundingClientRect().height).toBeCloseTo(470.4, 1);
	});
});
