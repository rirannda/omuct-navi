# 施設マーカーの登録

部屋の図形を選択する施設は`src/data/pois.ts`、座標にアイコンを置く施設は
`src/data/markers.ts`で管理します。`markers.ts`は空配列で追加しており、既存の
POI・ノード・エッジ・SVGと公開階の設定は変更していません。

トイレ・ごみ箱・模擬店・案内所などは、静的SVGの図形がなくても登録できます。
登録したマーカーは地図に表示され、タッチ・Enter・Spaceで施設情報を開けます。
POIと同じ検索、出発地・目的地の指定、役割別の色表示に対応しています。

## データ形式

型は`src/data/types.ts`の`MapMarker`です。次は形式の例です。実際の施設に合わせて
座標・建物・階・到達ノードを書き換え、`markers`配列に追加してください。

```ts
import type { MapMarker } from './types';
import trashIcon from '#lib/assets/markers/trash.svg';

export const markers: MapMarker[] = [
	{
		id: 'marker_courtyard_trash',
		name: '中庭のごみ箱',
		categoryId: 'trash',
		nodeId: 'node_outdoor_f0_main-gate',
		description: 'ごみを分別してください。経路は正門まで案内します。',
		keys: ['ごみ捨て場'],
		icon: trashIcon,
		buildingId: 'outdoor',
		floor: 0,
		visibility: 'always',
		x: 700,
		y: 800
	}
];
```

- `icon`には`src/lib/assets/`内の画像をimportして指定します。SVG・PNG・WebPなど、
  ブラウザーで表示できる画像を使えます。標準画像は`src/lib/assets/markers/`にあります。
  独自画像も同じ方法で指定できます。
  画像は24pxの枠に収めて表示し、タッチ領域は44pxを確保します。
- `x`・`y`は既存の`Node`と同じ地図座標です。元のSVGの座標を使う場合、
  `x`はそのまま、`y`は`1700 - SVGのy`に変換します。
- `buildingId`・`floor`は施設の所属先です。屋外は`outdoor`・`0`を使用します。
  内部階番号は`nodes.ts`・`maps.ts`に合わせてください。
- `nodeId`は経路の到達点です。表示位置とは別に、実在する近くの通路や入口の
  ノードを指定できます。内部経路がない建物では入口までの案内にし、施設情報に
  所在階や入口からの行き方を記載してください。内部までの経路が必要なら、
  ノードとエッジも追加します。
- `svgId`は指定しません。空文字や建物全体の図形IDを入れる必要はありません。
- トイレの`toiletType`は`men`・`women`・`accessible`で指定できます。
  高専祭版の施設検索で種別を絞り込むための項目です。

検索ボタンの有効化と将来のGPSの接続方法は[高専祭向けの施設検索と現在地](nearby_facilities.md)を参照してください。

## 表示名の改行

POI・マーカーの`name`は改行を含む文字列にできます。編集ツールの表示名欄でEnterを押すと
改行を入力でき、JSON・TypeScriptへは`\n`として保存されます。

```ts
name: '食品バザー村\n[各クラブ・有志]',
```

ボトムシートを中段・上段へ開くと、表示名の改行をそのまま表示します。
検索欄・検索候補・下段の短いタイトルでは、改行を空白に置き換えて表示します。
元データの改行は保持するため、検索や経路指定後も詳細では改行して表示できます。
HTMLとして解釈しないため、`<br>`ではなく実際の改行を入力してください。

## 標準アイコン

| 用途               | ファイル                | 見た目                   |
| ------------------ | ----------------------- | ------------------------ |
| 男子トイレ         | `toilet-men.svg`        | 青色の人物               |
| 女子トイレ         | `toilet-women.svg`      | 赤紫色のスカート姿の人物 |
| バリアフリートイレ | `toilet-accessible.svg` | 緑色の車いす             |
| ごみ箱             | `trash.svg`             | ごみ箱                   |
| 模擬店             | `booth.svg`             | 売店                     |
| ステージ           | `stage.svg`             | 音符                     |
| 食品バザー         | `food-bazaar.svg`       | フォークとナイフ         |
| 献血               | `blood-donation.svg`    | 赤い血液のしずく         |
| 時計塔             | `clock-tower.svg`       | 時計の文字盤と針         |
| 案内所             | `info.svg`              | インフォメーション       |

トイレは色に加えて形でも区別します。例えば男子トイレは、
`import toiletMenIcon from '#lib/assets/markers/toilet-men.svg';`として読み込み、
マーカーの`icon`に`toiletMenIcon`を指定します。施設名にも男子・女子・バリアフリーの
区分を記載してください。アイコンは施設の種別に合わせてデータ側で指定します。

## 表示する階

`visibility`は必須項目です。屋外以外のマーカーは、次の2種類から表示条件を選びます。

- `always`: 全体図から常に表示します。別の建物や階を選んだときも表示を続けます。
  時計塔・案内所・建物全体の催しなど、全体図から選びたい施設に使用します。
- `floor`: 所属する建物の詳細図で、`floor`と同じ階を表示しているときだけ表示します。
  全体図や別の建物・階へ切り替えると非表示になります。

```ts
visibility: 'always', // 全体図から常に表示
// または visibility: 'floor' // 所属階を表示中のみ
```

`buildingId: 'outdoor'`には`visibility: 'always'`を指定します。
編集ツールは保存・読み込み時に、屋外の`visibility`を自動で`always`に設定します。
旧データに表示条件がない場合は、屋外に`always`、それ以外に`floor`を補完します。
該当階の詳細図がない施設を全体図に表示する場合は、`always`を指定してください。
吹き出しと施設情報には、表示条件とは独立して所属する建物・階を表示します。
施設検索の絞り込みは引き続き有効です。公開しない施設はマーカーデータに含めないでください。

## 既存のトイレPOIを移行する手順

1. 移行する施設のPOIの`id`を、そのままマーカーに引き継ぎます。
2. マーカーの位置・建物・階・アイコンと、到達ノードを設定します。
3. 同じ施設を`pois.ts`から削除します。部屋のSVG図形自体は残せます。
4. `bun run check`・`bun run test`で検証します。

POIとマーカーのIDが重複すると、データのテストとナビゲーションの初期化でエラーに
なります。同じIDを引き継ぐことで、移行時のPOIの削除忘れを検出します。
異なるIDを付けた同一施設の重複は自動判定できないため、移行時にIDを変更しないでください。

## 選択と経路の共有状態

`navigation.pois`と`navigation.markers`は元のデータをそれぞれ保持し、
`navigation.destinations`が両方を含む検索対象です。
既存の`resolvePoi()`・`selectedPoi`・`setHighlight()`・`requestFocus()`は
マーカーのIDも扱います。`resolvePoi()`の`node`は経路の到達点、`location`は
表示位置と所属階です。検索パネルとカメラは`location`を使用し、経路探索には
`node`を使用します。

テスト等で`createNavigationState({ graph, pois, markers })`を呼ぶ場合は、
渡したデータだけを使用します。`markers`省略時は空配列になり、実データが混ざりません。

部屋のタッチ選択には、POIの登録、参照ノード、対応する建物・階のSVG図形が必要です。
POIを削除した部屋は図形が残っていても施設として選択できません。
建物自体をタップして階を開く操作は、POIの施設選択とは独立しています。
