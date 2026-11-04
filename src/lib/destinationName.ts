/** 改行を含む施設名を検索結果や単一行の入力欄に表示します。 */
export function singleLineDestinationName(name: string): string {
	return name.replace(/[ \t]*[\r\n]+[ \t]*/g, ' ');
}
