<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>位置情報の取り扱い | OMUCT Navi</title>
	<meta
		name="description"
		content="OMUCT Naviの位置情報の利用目的、端末内での処理、保存と利用停止について説明します。"
	/>
</svelte:head>

<main class="mx-auto min-h-dvh max-w-2xl space-y-7 bg-white px-6 py-10 text-slate-900">
	<a
		href={resolve('/')}
		class="inline-block min-h-11 py-2 text-blue-700 underline underline-offset-4">地図へ戻る</a
	>
	<h1 class="text-2xl font-semibold">位置情報の取り扱い</h1>
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">利用目的と取得する情報</h2>
		<p class="leading-7">
			利用者が現在地機能を選んだ場合、ブラウザから緯度・経度、位置の精度と取得時刻を受け取ります。周辺施設の検索、地図上の現在地表示、現在地への移動、ルート案内中の地図追従に利用します。
		</p>
	</section>
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">取得する期間と停止方法</h2>
		<p class="leading-7">
			現在地機能を選ぶと、初回はアプリの説明を表示します。同意後に説明を閉じてからブラウザの位置情報の許可へ進みます。同意が保存済みでも、ブラウザの許可が必要な場合はアプリの説明を先に表示します。許可状態を確認できないブラウザでも、取得を開始する前に説明を表示します。
		</p>
		<p class="leading-7">
			現在地機能の利用中は継続して取得します。地図のシートを上まで開いたところにある「位置情報の利用を停止」から停止できます。施設検索を閉じて案内もしていない場合、経路を解除して施設検索もしていない場合、または地図画面を離れた場合にも取得を停止します。
		</p>
		<p class="leading-7">
			ブラウザのサイト設定から位置情報の許可を取り消すこともできます。地図を手動で動かすと自動追従だけを解除し、測位は継続します。画面を閉じたりロックしたりしている間の位置更新は保証されません。
		</p>
	</section>
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">処理・送信・保存</h2>
		<p class="leading-7">
			取得した位置情報は利用中のブラウザのメモリ上だけで処理します。アプリから運営サーバーや外部の解析サービス、地図・経路APIへ送信せず、端末の永続ストレージにも保存しません。移動履歴は蓄積しません。利用停止時にアプリが保持する現在地を消去します。
		</p>
		<p class="leading-7">
			初回確認で位置情報を利用するかどうか選んだ結果だけを端末のローカルストレージに保存します。位置座標は含みません。「使わない」を選んだ場合、施設検索では確認を繰り返さず、現在地ボタンから利用を選び直せます。サイトデータを削除すると、次の利用時に再び確認が表示されます。ブラウザが管理する位置情報の許可は、この選択結果とは別です。
		</p>
	</section>
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">ブラウザ・端末による測位</h2>
		<p class="leading-7">
			測位にはGPSに加え、ブラウザやOSが提供する位置情報サービスが使われる場合があります。それらのサービスによる情報の取り扱いは、各提供元の方針に従います。このページは当アプリの位置情報機能についての説明です。
		</p>
	</section>
</main>
