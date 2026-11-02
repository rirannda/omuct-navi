<script lang="ts">
	import type { NavigationState } from '../states/navigation.svelte';

	let { navigation }: { navigation: NavigationState } = $props();
	let dialog = $state<HTMLDialogElement>();
	const id = $props.id();
	$effect(() => {
		if (navigation.gps.consentOpen) dialog?.showModal();
		else dialog?.close();
	});

	function confirm(allow: boolean) {
		// ブラウザの許可要求より先に、アプリの確認を閉じます。
		dialog?.close();
		navigation.gps.confirmConsent(allow);
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={`${id}-title`}
	aria-describedby={`${id}-description`}
	oncancel={() => confirm(false)}
	class="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/40"
>
	<h2 id={`${id}-title`} class="text-lg font-semibold">位置情報を利用しますか？</h2>
	<div id={`${id}-description`} class="mt-3 space-y-3 text-sm leading-6 text-slate-600">
		<p>近くの施設の検索、現在地への移動、ルート案内中の地図追従に位置情報を使います。</p>
		<p>
			現在地機能の利用中は位置情報を継続して取得します。取得した位置は端末内だけで処理し、サーバーへの送信・保存や移動履歴の蓄積は行いません。
		</p>
		<p>位置情報を使わず、場所を手動で選ぶこともできます。</p>
		<p>同意後、必要に応じてブラウザからも位置情報の許可を求められます。</p>
	</div>
	<a
		href="/privacy"
		target="_blank"
		rel="noopener"
		class="mt-3 inline-block min-h-11 py-2 text-sm text-blue-700 underline underline-offset-4"
		>位置情報の取り扱い（別タブ）</a
	>
	<div class="mt-4 flex flex-wrap justify-end gap-3">
		<button
			type="button"
			class="min-h-11 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium"
			onclick={() => confirm(false)}>使わない</button
		>
		<button
			type="button"
			class="min-h-11 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
			onclick={() => confirm(true)}>同意して利用</button
		>
	</div>
</dialog>
