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

## 標準アイコン

| 用途               | ファイル                | 見た目                   |
| ------------------ | ----------------------- | ------------------------ |
| 男子トイレ         | `toilet-men.svg`        | 青色の人物               |
| 女子トイレ         | `toilet-women.svg`      | 赤紫色のスカート姿の人物 |
| バリアフリートイレ | `toilet-accessible.svg` | 緑色の車いす             |
| ごみ箱             | `trash.svg`             | ごみ箱                   |
| 模擬店             | `booth.svg`             | 売店                     |
| 案内所             | `info.svg`              | インフォメーション       |

トイレは色に加えて形でも区別します。例えば男子トイレは、
`import toiletMenIcon from '#lib/assets/markers/toilet-men.svg';`として読み込み、
マーカーの`icon`に`toiletMenIcon`を指定します。施設名にも男子・女子・バリアフリーの
区分を記載してください。アイコンは施設の種別に合わせてデータ側で指定します。

## 表示する階

屋外と、該当階の詳細図がない施設は、全体図上にアイコンを表示します。
吹き出しと施設情報には所属する建物・階を表示します。

詳細図がある施設は、その建物の選択中の階に合わせて表示・非表示を切り替えます。
階が未選択なら1階を優先し、1階もなければ公開されている最も低い階を使います。
2階のみ公開する設定にも対応します。公開しない施設はマーカーデータに含めないでください。

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
