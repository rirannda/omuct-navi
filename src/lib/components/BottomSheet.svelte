<script module lang="ts">
	export type BottomSheetSnap = 'bottom' | 'middle' | 'top';
	export const BOTTOM_SHEET_PEEK_HEIGHT = 144;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy, untrack } from 'svelte';

	let {
		snap = $bindable<BottomSheetSnap>('bottom'),
		onheightchange,
		onsettle,
		children
	}: {
		snap?: BottomSheetSnap;
		/** アニメーション・ドラッグ中も、画面を覆っている高さを通知します。 */
		onheightchange?: (height: number) => void;
		onsettle?: (snap: BottomSheetSnap, height: number) => void;
		children?: Snippet;
	} = $props();

	const snaps: readonly BottomSheetSnap[] = ['bottom', 'middle', 'top'];
	const MIDDLE_HEIGHT_RATIO = 0.3;
	const MIDDLE_MIN_HEIGHT = 320;
	const id = $props.id();
	const contentId = `${id}-content`;
	let availableHeight = $state(0);
	let height = $state(BOTTOM_SHEET_PEEK_HEIGHT);
	let dragging = $state(false);
	let animationFrame: number | undefined;
	let pointerId: number | undefined;
	let startY = 0;
	let startHeight = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0;
	let moved = false;
	let suppressClick = false;

	function snapHeight(position: BottomSheetSnap): number {
		const maximum = availableHeight || BOTTOM_SHEET_PEEK_HEIGHT;
		if (position === 'top') return maximum;
		if (position === 'middle')
			return Math.min(maximum, Math.max(MIDDLE_MIN_HEIGHT, maximum * MIDDLE_HEIGHT_RATIO));
		return Math.min(BOTTOM_SHEET_PEEK_HEIGHT, maximum);
	}

	function cancelAnimation() {
		if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
		animationFrame = undefined;
	}

	function animateTo(target: number) {
		cancelAnimation();
		const position = snap;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || height === target) {
			height = target;
			onsettle?.(position, target);
			return;
		}
		const from = height;
		const started = performance.now();
		function animate(now: number) {
			const progress = Math.min(1, (now - started) / 260);
			height = from + (target - from) * (1 - (1 - progress) ** 3);
			animationFrame = progress < 1 ? requestAnimationFrame(animate) : undefined;
			if (progress === 1) onsettle?.(position, target);
		}
		animationFrame = requestAnimationFrame(animate);
	}

	$effect(() => {
		// 親領域のリサイズ時も、現在のスナップ位置に合わせ直します。
		const position = snap;
		const maximum = availableHeight;
		if (maximum && !dragging) untrack(() => animateTo(snapHeight(position)));
	});
	$effect(() => {
		const currentHeight = height;
		untrack(() => onheightchange?.(currentHeight));
	});
	onDestroy(cancelAnimation);

	function startDrag(event: PointerEvent) {
		if (!event.isPrimary || event.button !== 0 || pointerId !== undefined) return;
		cancelAnimation();
		pointerId = event.pointerId;
		startY = lastY = event.clientY;
		startHeight = height;
		lastTime = event.timeStamp;
		velocity = 0;
		moved = suppressClick = false;
		dragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function moveDrag(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		const elapsed = event.timeStamp - lastTime;
		if (elapsed > 0) velocity = elapsed <= 100 ? (event.clientY - lastY) / elapsed : 0;
		lastY = event.clientY;
		lastTime = event.timeStamp;
		if (Math.abs(event.clientY - startY) > 4) moved = true;
		height = Math.max(
			snapHeight('bottom'),
			Math.min(snapHeight('top'), startHeight + startY - event.clientY)
		);
	}

	function endDrag(event: PointerEvent, cancelled = false) {
		if (event.pointerId !== pointerId) return;
		if (!cancelled && moved) {
			const momentum = event.timeStamp - lastTime <= 100 ? velocity * 160 : 0;
			const projectedHeight = height - momentum;
			snap = snaps.reduce((nearest, candidate) =>
				Math.abs(snapHeight(candidate) - projectedHeight) <
				Math.abs(snapHeight(nearest) - projectedHeight)
					? candidate
					: nearest
			);
		}
		suppressClick = moved;
		pointerId = undefined;
		dragging = false;
		const handle = event.currentTarget as HTMLElement;
		if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
	}

	function cycleSnap() {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		snap = snaps[(snaps.indexOf(snap) + 1) % snaps.length];
	}
</script>

<div
	class="bottom-sheet-root pointer-events-none absolute inset-x-0 top-[max(16px,env(safe-area-inset-top))] bottom-0 z-1200"
	bind:clientHeight={availableHeight}
>
	<section
		class="bottom-sheet pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-3px_20px_rgb(0_0_0/15%)]"
		style:height={`${height}px`}
		data-snap={snap}
		aria-label="ボトムシート"
	>
		<button
			class={[
				'drag-handle flex w-full flex-[0_0_48px] touch-none items-center justify-center rounded-t-3xl border-0 bg-transparent p-0 select-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#2563eb] focus-visible:outline-solid',
				dragging ? 'cursor-grabbing' : 'cursor-grab'
			]}
			type="button"
			aria-label="ボトムシートの高さを変更"
			aria-controls={contentId}
			aria-expanded={snap !== 'bottom'}
			onpointerdown={startDrag}
			onpointermove={moveDrag}
			onpointerup={(event) => endDrag(event)}
			onpointercancel={(event) => endDrag(event, true)}
			onlostpointercapture={(event) => endDrag(event, true)}
			onclick={cycleSnap}
		>
			<span class="h-1 w-9 rounded-full bg-[#b8bdc5]" aria-hidden="true"></span>
		</button>
		<div
			class="sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(16px,env(safe-area-inset-bottom))]"
			id={contentId}
		>
			{@render children?.()}
		</div>
	</section>
</div>
