export const builtins = [
  {
    id: "news",
    title: "시장 뉴스 브리핑",
    description: "시장 흐름을 읽는 시작. 필요한 뉴스만 한눈에.",
    category: "work",
    image: "/images/news.svg",
    type: "news",
    tag: "시장·투자",
    input: "관심 키워드",
    example: "반도체",
    source: "네이버 뉴스",
    key: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET",
  },
  {
    id: "etf",
    title: "ETF 비교 분석",
    description: "직접 올린 자료로 수익률과 비용을 비교하세요.",
    category: "work",
    image: "/images/etf.svg",
    type: "csv",
    tag: "리서치·분석",
    input: "CSV 데이터",
    example:
      "name,return,fee,dividend,date\nETF A,8.2,0.15,2.1,2026-10-16\nETF B,6.4,0.09,3.0,2026-10-16",
    source: "사용자 업로드",
    key: "",
  },
  {
    id: "research",
    title: "해외 리서치·어닝콜 요약",
    description: "긴 영문 자료를 한국어로, 핵심과 근거를 함께.",
    category: "work",
    image: "/images/research.svg",
    type: "translation",
    tag: "리서치·분석",
    input: "영문 본문",
    example: "Revenue increased by 12% year over year. Management noted higher operating costs.",
    source: "사용자 문서 · Anthropic",
    key: "ANTHROPIC_API_KEY",
  },
  {
    id: "rates",
    title: "환율·금리 모니터링",
    description: "환율과 미국 국채 흐름을 관측일 기준으로.",
    category: "work",
    image: "/images/rates.svg",
    type: "rates",
    tag: "경제 지표",
    input: "조회 기간 (일)",
    example: "30",
    source: "FRED",
    key: "FRED_API_KEY",
  },
  {
    id: "companies",
    title: "주변 법인·기업 잠재고객 탐색",
    description: "주변 기업의 공개정보로 영업 준비를 가볍게.",
    category: "work",
    image: "/images/companies.svg",
    type: "companies",
    tag: "영업·업무",
    input: "지역·기업명 또는 기업 CSV",
    example: "강남구 IT 기업",
    source: "카카오 로컬 · OpenDART · 사용자 자료",
    key: "KAKAO_REST_API_KEY (CSV는 불필요)",
  },
  {
    id: "outdoor",
    title: "야장맵·야외 식당 탐색",
    description: "퇴근 후 좋은 시간, 가까운 야장 후보를 찾아요.",
    category: "personal",
    image: "/images/outdoor.svg",
    type: "places",
    tag: "맛집·일상",
    input: "지역·음식·분위기",
    example: "서울 강남 야장",
    source: "카카오 로컬",
    key: "KAKAO_REST_API_KEY",
  },
  {
    id: "wedding",
    title: "웨딩홀 정보 모음",
    description: "우리에게 맞는 공간을 찾아 비교하고 기록해요.",
    category: "personal",
    image: "/images/wedding.svg",
    type: "places",
    tag: "웨딩·생활",
    input: "지역",
    example: "서울 웨딩홀",
    source: "카카오 로컬",
    key: "KAKAO_REST_API_KEY",
  },
] as const;
export type Builtin = (typeof builtins)[number];
export const findBuiltin = (id: string) => builtins.find((a) => a.id === id);
export type Definition = {
  type: string;
  builtinId?: string;
  prompt?: string;
  inputLabel?: string;
  output?: string;
  source?: string;
  variables?: string;
  schema?: string;
};
export type PublicContent = {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: string;
  visibility: string;
  definition: Definition;
  image?: string;
  url?: string | null;
  owned?: boolean;
  version?: number;
  createdAt?: string;
};
export const catalog: PublicContent[] = builtins.map((a) => ({
  ...a,
  kind: "agent",
  visibility: "public",
  definition: { type: a.type, builtinId: a.id },
}));
export type Result = {
  status: "success" | "partial" | "sample";
  summary: string;
  rows?: Record<string, string | number>[];
  text?: string;
  warnings: string[];
  sources: { label: string; url?: string }[];
  fetchedAt: string;
};
