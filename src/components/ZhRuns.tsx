/**
 * 한국어 문장 속 중국어 구간만 중국어 서체로 감싼다. 한국어 서체(Pretendard)에는 간체자가 없어
 * 「麻烦您帮」처럼 일부 글자만 다른 서체로 그려지는 문제를 막는다(2026-10-09).
 */
const HAN_RUN = /([\p{Script=Han}][\p{Script=Han}，。？！、；：“”‘’（）…—\s]*[\p{Script=Han}，。？！、；：）…]?)/u;

export function ZhRuns({ text }: { text: string }) {
  if (!/\p{Script=Han}/u.test(text)) return <>{text}</>;
  return (
    <>
      {text.split(HAN_RUN).map((part, index) =>
        index % 2 === 1 ? <span key={index} className="font-zh">{part}</span> : part,
      )}
    </>
  );
}
