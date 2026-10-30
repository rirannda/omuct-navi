# POIの選択と経路表示

SVGを使わない施設マーカーも同じ選択・経路APIで扱います。
別ファイルへの登録とトイレPOIの移行手順は[施設マーカーの登録](markers.md)を参照してください。

親でナビゲーション状態を生成し、検索・地図・詳細表示で同じインスタンスを共有します。
`Map.svelte`の`navigation`は必須です。状態の自動生成や選択のバインディングは提供しません。

```svelte
<script lang="ts">
	import Map from '#lib/components/Map.svelte';
	import { createNavigationState } from '#lib';

	const navigation = createNavigationState();
	let mapComponent: { focusOnPoiId: (poiId: string) => void } | undefined;
</script>

<Map {navigation} bind:this={mapComponent} />
<p>選択中: {navigation.selectedPoi?.name ?? '未選択'}</p>
<button onclick={() => navigation.setHighlight('poi_hr_1-1')}>1-1HRを選択</button>
<button onclick={() => mapComponent?.focusOnPoiId('poi_hr_1-1')}>1-1HRへ移動</button>
<button onclick={() => navigation.clearHighlight('selected')}>選択を解除</button>
```

状態は`navigation`のメソッドで変更し、`highlights`・`routePath`・`selectedPoi`は読み取り専用として扱います。
地図の公開メソッドは`focusOnPoiId(poiId)`のみです。地図初期化後に呼び出して、対応する階へ切り替え、カメラを移動します。
共有状態の変更とカメラ移動は別の操作です。ハイライトを変更してもPOIへ自動的に移動しません。

## POIのハイライト

`navigation.setHighlight(poiId, role = 'selected')`は役割・POI・ノードの存在を検証し、受理時に`true`を返します。
不正な入力では`false`を返し、現在の状態を維持します。
SVG要素の存在や読み込み完了を保証する戻り値ではありません。対応する図形がない場合も、存在するPOIは状態として受理します。

| 役割       | 色  | 用途          |
| ---------- | --- | ------------- |
| `start`    | 緑  | スタートのPOI |
| `goal`     | 赤  | ゴールのPOI   |
| `selected` | 黄  | 選択中のPOI   |

色の定義は`src/lib/map/highlightColors.ts`にあり、`#lib`から`highlightColors`と`HighlightColor`型を参照できます。
塗り・枠線・吹き出しの文字色をまとめて変更できます。

```ts
navigation.setHighlight('poi_hr_1-1', 'start');
navigation.setHighlight('poi_hr_1-2', 'goal');
navigation.setHighlight('poi_main-gate');
```

3枠にそれぞれ最大1つのPOIを保持し、同じ枠への設定で対象を置き換えます。
`selectedPoi`は`selected`枠から導出し、`start`・`goal`の変更では選択中のPOIを変更しません。
同じ部屋が複数の枠を兼ねる場合は、ハイライトと吹き出しを1つにまとめ、`selected`、`goal`、`start`の順で色を優先します。

描画では、POIの`nodeId`から建物・階を特定し、その階のSVG内にある`svgId`を強調して名前を表示します。
屋外のPOIは基本図のSVGから探します。階の切り替えで対象のSVGが非表示になると吹き出しを隠し、対象の階へ戻ると再表示します。

建物内や正門の対応する図形をタップすると、`selected`枠を更新します。
グループの子要素をタップした場合も親のPOIを選び、無関係な図形や別の階にある同名のSVGでは選択を変更しません。
Enter・Spaceでも選択できます。タップでは地図の位置とズームを維持します。

`navigation.clearHighlight(role)`で指定した枠を解除し、引数なしですべての枠を解除します。
`selected`枠を解除すると`selectedPoi`は`null`になります。階を切り替えても各枠のPOIは維持します。

## 経路

`navigation.showRoute(startNodeId, goalNodeId)`で探索し、経路のnode ID配列を返します。
到達不能または不明なノードの場合は`null`を返し、表示経路を解除します。
経路にはnode ID、ハイライトにはPOI IDを使い、それぞれ独立して変更できます。

経路を描画すると、始点の階を表示し、その階の経路が収まるよう地図を調整します。
スタート地点に緑の`S`、ゴール地点に赤の旗を表示し、始終点が同じ場合は`S/G`を表示します。
マークは各地点の階で表示します。経路を更新・解除すると古いマークとラベルを除去します。
`navigation.clearRoute()`で経路を解除しても、POIのハイライトは維持します。

## 初期化と状態の寿命

初期化前の状態は、SVGの読み込み完了時に反映します。
読み込み中に変更した場合は最新の状態だけを表示し、解除した状態を再表示しません。
POIへ移動する予約は行いません。地図を破棄しても親の状態は解除しません。
同じ地図の存続中は同じモデルを渡し、別の地図・ページには別のインスタンスを生成します。
