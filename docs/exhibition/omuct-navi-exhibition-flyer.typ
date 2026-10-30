// omuct-navi 展示用 A4 1枚
#let accent = rgb("#1d4ed8")
#let ink = luma(20)
#let qr-size = 70mm

#set page(paper: "a4", margin: (x: 18mm, y: 16mm))
#set text(font: ("Noto Sans CJK JP", "Noto Sans JP", "IPAexGothic", "Source Han Sans"), lang: "ja", size: 11pt, fill: ink)
#set par(leading: 0.8em, justify: false)

#let heading-line(ja) = text(size: 13pt, weight: "bold", fill: accent)[#ja]

#text(size: 30pt, weight: "bold", fill: accent)[omuct-navi]

#text(size: 13pt, weight: "bold")[校内の目的地までの道のりを、スマホで地図に表示]

#line(length: 100%, stroke: 0.6pt + luma(190))

#heading-line("概要")

文化祭で来場した方が、校内の教室や施設を検索し、出発地から目的地までの経路を地図上で確認できるナビゲーションアプリです。

#v(2mm)
#heading-line("主な機能")

- 出発地・目的地を検索
- 経路を地図上に表示
- 建物・階ごとのマップ切り替え

#v(2mm)
#heading-line("使い方")

+ 下の QR コードをスマートフォンで読み取る
+ 開いたページで出発地と目的地を選び「ルート検索」

#v(1fr)

#align(center)[
  #image("qr.svg", width: qr-size)
  #v(2mm)
  #text(size: 14pt, weight: "bold")[スマートフォンで読み取ってください]
]

#v(1fr)

#line(length: 100%, stroke: 0.6pt + luma(190))
#text(size: 10pt)[制作: [team !ms]]
