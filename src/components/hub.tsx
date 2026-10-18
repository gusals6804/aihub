"use client";
/* Local illustration assets are deliberately served without external image dependencies. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import dynamic from "next/dynamic";
const PlaceMap = dynamic(() => import("./place-map"), {
  ssr: false,
  loading: () => <p className="field-help">지도를 불러오는 중…</p>,
});
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Plus,
  Copy,
  Play,
  Settings,
  ChevronDown,
  ChevronLeft,
  Check,
  X,
  Link2,
  BriefcaseBusiness,
  Sparkles,
  Compass,
  Users,
  BookOpen,
  ShieldCheck,
  FileCode2,
  Globe,
  Layers,
  Heart,
  Upload,
  Download,
  MapPin,
  SlidersHorizontal,
  Menu,
  LockKeyhole,
  ExternalLink,
  AlertCircle,
  Trash2,
  Pencil,
  RotateCcw,
  LoaderCircle,
} from "lucide-react";
import {
  builtins,
  catalog,
  findBuiltin,
  type PublicContent,
  type Result,
} from "@/lib/agents/catalog";

async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "요청을 처리할 수 없습니다.");
  return data;
}
const visibilityLabel: Record<string, string> = {
  private: "비공개",
  link: "링크 공유",
  public: "갤러리 공개",
};
const typeLabel: Record<string, string> = {
  structured: "입력 구조화 · 키 불필요",
  csv: "CSV/XLSX 분석 · 키 불필요",
  prompt: "문서 요약 · AI 연결 필요",
  translation: "번역 · AI 연결 필요",
  "url-summary": "공개 URL 요약 · AI 연결 필요",
  news: "네이버 뉴스 조회",
  rates: "FRED 환율·금리",
  places: "카카오 공개 장소 검색",
  companies: "기업 공개자료 탐색",
};
function download(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csv(rows: Record<string, string | number>[]) {
  const safe = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replace(/"/g, '""')}"`;
  const keys = Object.keys(rows[0] || {});
  return (
    "\uFEFF" +
    [keys.map(safe).join(","), ...rows.map((r) => keys.map((k) => safe(r[k])).join(","))].join("\n")
  );
}
async function fileData(file: File) {
  if (file.size > 2_000_000) throw new Error("파일은 2MB까지 업로드할 수 있습니다.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return { name: file.name, data: btoa(s) };
}
function Card({
  content,
  onClone,
}: {
  content: PublicContent;
  onClone: (c: PublicContent) => void;
}) {
  const builtin = findBuiltin(content.id);
  const image =
    content.image ||
    (content.kind === "agent"
      ? "/images/research.svg"
      : content.kind === "html"
        ? "/images/etf.svg"
        : "/images/companies.svg");
  return (
    <article className="agent-card">
      <Link className="card-image" href={`/agents/${content.id}`}>
        <img src={image} alt="" />
        <span className="image-label">
          {content.kind === "html"
            ? "HTML"
            : content.kind === "website"
              ? "웹사이트"
              : content.category === "work"
                ? "업무"
                : "개인"}
        </span>
      </Link>
      <div className="card-body">
        <span className="eyebrow">
          {builtin?.tag || (content.kind === "agent" ? "직접 만든 에이전트" : "동료의 공유 콘텐츠")}
        </span>
        <h3>
          <Link href={`/agents/${content.id}`}>{content.title}</Link>
        </h3>
        <p>{content.description}</p>
        <div className="card-actions">
          <Link className="btn small outline" href={`/agents/${content.id}`}>
            <Play size={13} />
            {content.kind === "agent" ? "바로 실행하기" : "열기"}
          </Link>
          <button
            className="btn small quiet"
            onClick={() => onClone(content)}
            aria-label={`${content.title} 복제`}
          >
            <Copy size={13} />
            복제
          </button>
        </div>
      </div>
    </article>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function Hub() {
  const path = usePathname();
  const query = useSearchParams();
  const router = useRouter();
  const [contents, setContents] = useState<PublicContent[]>([]);
  const [mine, setMine] = useState<PublicContent[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [share, setShare] = useState<{ content: PublicContent; url: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const notify = (s: string) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 4500);
  };
  async function refresh() {
    const pub = await api<{ contents: PublicContent[] }>("catalog");
    const own = await api<{ contents: PublicContent[] }>("catalog?mine=1");
    setContents(pub.contents);
    setMine(own.contents);
  }
  useEffect(() => {
    let cancelled = false;
    void api<{ contents: PublicContent[] }>("catalog")
      .then(async (pub) => {
        const own = await api<{ contents: PublicContent[] }>("catalog?mine=1");
        if (!cancelled) {
          setContents(pub.contents);
          setMine(own.contents);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  useEffect(() => {
    const timer = setTimeout(() => setMobile(false), 0);
    return () => clearTimeout(timer);
  }, [path]);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("복사했습니다.");
    } catch {
      notify("브라우저에서 복사를 허용해 주세요. 표시된 내용을 직접 복사할 수 있습니다.");
    }
  }
  async function clone(c: PublicContent, shareToken?: string) {
    try {
      const data = await api<{ content: PublicContent; recoveryKey: string }>(
        `content/${c.id}/clone${shareToken ? `?share=${shareToken}` : ""}`,
        {},
      );
      setRecovery(data.recoveryKey);
      await refresh();
      router.push(`/agents/${data.content.id}`);
      notify("독립적인 에이전트로 복제했습니다.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function createShare(c: PublicContent, days = 0) {
    setSharing(true);
    try {
      if (!c.owned) {
        const data = await api<{ content: PublicContent; recoveryKey: string }>(
          `content/${c.id}/clone`,
          {},
        );
        setRecovery(data.recoveryKey);
        c = data.content;
        await refresh();
      }
      const result = await api<{ path: string }>(`content/${c.id}/share`, { days });
      setShare({ content: c, url: location.origin + result.path });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSharing(false);
    }
  }
  const nav = [
    ["/", "홈"],
    ["/gallery", "갤러리"],
    ["/my", "내 에이전트"],
    ["/make", "만들기"],
    ["/tutorials", "튜토리얼"],
  ];
  return (
    <>
      <header className="topbar">
        <div className="header-inner">
          <Link href="/" className="logo" aria-label="Agent Hub 홈">
            <span className="logo-mark">
              <Layers size={21} />
            </span>
            Agent Hub<span className="logo-dot">.</span>
          </Link>
          <nav className={mobile ? "nav open" : "nav"} aria-label="주 메뉴">
            {nav.map(([href, title]) => (
              <Link key={href} className={path === href ? "active" : ""} href={href}>
                {title}
              </Link>
            ))}
          </nav>
          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/gallery?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={16} />
            <input
              aria-label="에이전트 검색"
              placeholder="어떤 도움이 필요하세요?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Link href="/settings" className="icon-btn settings-icon" aria-label="연결 및 사용 설정">
            <Settings size={19} />
          </Link>
          <Link href="/make" className="header-create">
            <Plus size={17} />
            만들기
          </Link>
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="메뉴"
            aria-expanded={mobile}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
            <button className="icon-btn" aria-label="오류 닫기" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        {path === "/" ? (
          <Home contents={contents} clone={clone} />
        ) : path === "/gallery" ? (
          <Gallery
            contents={contents}
            mine={mine}
            clone={clone}
            initialSearch={query.get("q") || ""}
          />
        ) : path === "/my" ? (
          <My
            mine={mine}
            refresh={refresh}
            notify={notify}
            setRecovery={setRecovery}
            setError={setError}
            clone={clone}
            createShare={createShare}
          />
        ) : path === "/make" ? (
          <Maker
            id={query.get("id")}
            onSaved={async (c, key) => {
              if (key) setRecovery(key);
              await refresh();
              router.push(`/agents/${c.id}`);
            }}
            notify={notify}
          />
        ) : path.startsWith("/agents/") || path.startsWith("/share/") ? (
          <Detail
            id={path.split("/")[2]}
            shared={path.startsWith("/share/")}
            clone={clone}
            createShare={createShare}
            notify={notify}
            copy={copy}
            sharing={sharing}
          />
        ) : path === "/tutorials" ? (
          <Tutorials />
        ) : path === "/settings" ? (
          <Connections />
        ) : (
          <div className="empty">
            <h1>페이지를 찾을 수 없습니다.</h1>
            <Link className="btn" href="/">
              홈으로 돌아가기
            </Link>
          </div>
        )}
      </main>
      <footer>
        <Link href="/" className="logo">
          <Layers size={18} /> Agent Hub
        </Link>
        <span>일을 가볍게, 가능성을 함께.</span>
        <span>로그인 없이 이용 · 링크 소지자 접근 가능</span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {recovery && (
        <Modal title="편집 권한 복구 키를 보관하세요" onClose={() => setRecovery("")}>
          <p>
            이 브라우저에서 수정·삭제할 수 있습니다. 브라우저 데이터를 지우거나 기기를 바꾸면 아래
            키로 복구하세요. 키를 가진 사람은 편집 권한을 얻습니다.
          </p>
          <div className="notice warning">
            <LockKeyhole size={18} />
            공유 링크에 이 키를 넣거나 동료에게 전달하지 마세요.
          </div>
          <textarea aria-label="복구 키" readOnly value={recovery} rows={2} />
          <div className="button-row">
            <button className="btn outline" onClick={() => copy(recovery)}>
              <Copy size={16} />키 복사
            </button>
            <button
              className="btn"
              onClick={() => {
                download("agent-hub-recovery.txt", recovery);
                notify("복구 키 파일을 저장했습니다.");
              }}
            >
              복구 키 저장
            </button>
          </div>
        </Modal>
      )}
      {share && !recovery && (
        <Modal title="동료에게 공유하기" onClose={() => setShare(null)}>
          <p>
            <strong>{share.content.title}</strong>
            <br />이 링크를 받은 사람은 로그인 없이 열람·실행·복제할 수 있습니다. 원본 수정 권한은
            포함되지 않습니다.
          </p>
          <div className="share-url">
            <input aria-label="공유 링크" value={share.url} readOnly />
            <button className="btn" onClick={() => copy(share.url)}>
              <Copy size={17} />
              복사
            </button>
          </div>
          <div className="notice warning">
            <ShieldCheck size={20} />
            외부 사용자도 링크로 접근할 수 있습니다. 업무자료 공개 범위를 확인하세요.
          </div>
          <label>
            새 링크 만료 기간
            <select
              onChange={(e) => void createShare(share.content, Number(e.target.value))}
              defaultValue="0"
            >
              <option value="0">만료 없음</option>
              <option value="1">1일</option>
              <option value="7">7일</option>
              <option value="30">30일</option>
            </select>
          </label>
          <button
            className="btn danger outline"
            onClick={async () => {
              try {
                await api(`content/${share.content.id}/revoke`, {});
                setShare(null);
                notify("기존 공유 링크를 모두 해제했습니다.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            이 콘텐츠의 모든 공유 링크 해제
          </button>
        </Modal>
      )}
    </>
  );
}

function Home({
  contents,
  clone,
}: {
  contents: PublicContent[];
  clone: (c: PublicContent) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const router = useRouter();
  const features = [
    {
      icon: BriefcaseBusiness,
      title: "업무 생산성",
      text: "리서치, 분석, 문서 정리",
      color: "purple",
    },
    { icon: Compass, title: "정보 탐색", text: "시장, 기업, 뉴스와 트렌드", color: "blue" },
    { icon: Sparkles, title: "일상 생활", text: "맛집, 웨딩, 나를 위한 시간", color: "teal" },
    { icon: Users, title: "동료와 공유", text: "좋은 아이디어를 함께 사용", color: "blue" },
  ];
  return (
    <div className="home">
      <section className="hero">
        <img
          className="hero-skyline"
          src="/images/seoul.svg"
          alt="한강과 서울 도심을 그린 일러스트"
        />
        <div className="hero-content">
          <div className="hero-copy">
            <span className="hero-eyebrow">YOUR EVERYDAY WORK PARTNER</span>
            <h1>
              오늘도,
              <br />
              Agent Hub와 함께<span>.</span>
            </h1>
            <p>
              업무는 더 효율적으로, 일상은 더 편리하게.
              <br />
              필요한 에이전트를 찾고 직접 만들어 공유해 보세요.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((f) => (
              <Link
                href={`/gallery?category=${f.color === "teal" ? "personal" : "work"}`}
                className="feature"
                key={f.title}
              >
                <span className={`feature-icon ${f.color}`}>
                  <f.icon size={23} />
                </span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </div>
        <form
          className="hero-search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/gallery?q=${encodeURIComponent(q)}`);
          }}
        >
          <Search size={22} />
          <input
            aria-label="도움이 필요한 주제"
            placeholder="어떤 도움이 필요하세요? 예: ETF 비교, 주변 기업, 야장, 웨딩홀"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button aria-label="검색" type="submit">
            <ArrowRight size={22} />
          </button>
        </form>
      </section>
      <section className="section">
        <div className="section-top">
          <div className="title-row">
            <h2>지금 바로 사용해 보세요</h2>
            <span className="soft-label">기본 에이전트 7</span>
          </div>
          <Link href="/gallery" className="text-link">
            전체 보기
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="section-sub">
          <p>반복되는 일은 줄이고, 중요한 일에 집중하세요.</p>
          <div className="pills">
            {[
              ["all", "전체"],
              ["work", "업무"],
              ["personal", "개인"],
            ].map(([id, title]) => (
              <button
                className={filter === id ? "selected" : ""}
                onClick={() => setFilter(id)}
                key={id}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
        <div className="home-agent-groups">
          {["work", "personal"]
            .filter((c) => filter === "all" || filter === c)
            .map((category) => (
              <div key={category} className={`agent-group ${category}`}>
                <div className="group-label">
                  {category === "work" ? <BriefcaseBusiness size={15} /> : <Heart size={15} />}
                  <h3>{category === "work" ? "업무 에이전트" : "개인 에이전트"}</h3>
                  <span>{category === "work" ? "5" : "2"}</span>
                </div>
                <div className="cards">
                  {catalog
                    .filter((a) => a.category === category)
                    .map((c) => (
                      <Card key={c.id} content={c} onClone={clone} />
                    ))}
                </div>
              </div>
            ))}
        </div>
      </section>
      <section className="section community">
        <div className="section-top">
          <div>
            <span className="eyebrow blue-text">BETTER TOGETHER</span>
            <h2>동료의 아이디어에서 시작해 보세요</h2>
          </div>
          <Link href="/make" className="text-link">
            나만의 에이전트 만들기
            <Plus size={15} />
          </Link>
        </div>
        {contents.filter((c) => c.kind === "agent").length ? (
          <div className="gallery-grid">
            {contents
              .filter((c) => c.kind === "agent")
              .slice(0, 4)
              .map((c) => (
                <Card key={c.id} content={c} onClone={clone} />
              ))}
          </div>
        ) : (
          <div className="community-empty">
            <span className="round-icon">
              <Users size={27} />
            </span>
            <div>
              <h3>첫 번째 아이디어의 주인공이 되어 보세요</h3>
              <p>
                나에게 유용한 에이전트가 동료에게도 도움이 될 수 있어요.
                <br />
                전체 공개는 제작자가 선택한 콘텐츠만 표시됩니다.
              </p>
            </div>
            <Link className="btn outline" href="/make">
              만들어 공유하기
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-top">
          <h2>HTML·웹사이트도 함께 나눠요</h2>
          <Link className="text-link" href="/make?kind=html">
            콘텐츠 등록
            <Plus size={15} />
          </Link>
        </div>
        {contents.some((c) => c.kind !== "agent") ? (
          <div className="gallery-grid">
            {contents
              .filter((c) => c.kind !== "agent")
              .map((c) => (
                <Card key={c.id} content={c} onClone={clone} />
              ))}
          </div>
        ) : (
          <div className="content-invite">
            <FileCode2 size={27} />
            <p>직접 만든 HTML 도구와 유용한 웹사이트를 공유해 보세요.</p>
            <Link href="/make?kind=website">
              웹사이트 등록
              <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="tutorial-banner">
        <div className="tutorial-art">
          <BookOpen size={42} />
          <span>START HERE</span>
        </div>
        <div>
          <span className="eyebrow blue-text">처음 오셨나요?</span>
          <h2>
            5분이면 충분해요.
            <br className="mobile-only" /> 나만의 업무 도우미를 만나세요.
          </h2>
          <p>실행부터 만들기, 공유까지. 직접 해보는 세 가지 튜토리얼.</p>
        </div>
        <Link className="btn" href="/tutorials">
          튜토리얼 시작하기
          <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}

function Gallery({
  contents,
  mine,
  clone,
  initialSearch,
}: {
  contents: PublicContent[];
  mine: PublicContent[];
  clone: (c: PublicContent) => void;
  initialSearch: string;
}) {
  const query = useSearchParams();
  const [category, setCategory] = useState(query.get("category") || "all");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("latest");
  const [own, setOwn] = useState(false);
  const [q, setQ] = useState(initialSearch);
  useEffect(() => {
    const timer = setTimeout(() => setQ(initialSearch), 0);
    return () => clearTimeout(timer);
  }, [initialSearch]);
  const all = own ? mine : [...catalog, ...contents];
  const items = all
    .filter(
      (c) =>
        (category === "all" || c.category === category) &&
        (kind === "all" || c.kind === kind) &&
        `${c.title} ${c.description}`.toLowerCase().includes(q.toLowerCase()),
    )
    .toSorted((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "ko")
        : (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  return (
    <div className="gallery-shell page-width">
      <aside className="sidebar">
        <h3>카테고리</h3>
        {[
          ["all", "전체", Layers],
          ["work", "업무", BriefcaseBusiness],
          ["personal", "개인", Heart],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof Layers;
          return (
            <button
              key={String(id)}
              className={category === id ? "active" : ""}
              onClick={() => setCategory(String(id))}
            >
              <I size={18} />
              {String(label)}
              <span>{all.filter((c) => id === "all" || c.category === id).length}</span>
            </button>
          );
        })}
        <div className="sidebar-divider" />
        <h3>콘텐츠 유형</h3>
        {[
          ["all", "모든 콘텐츠", Compass],
          ["agent", "에이전트", Sparkles],
          ["html", "HTML 도구", FileCode2],
          ["website", "웹사이트", Globe],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof Layers;
          return (
            <button
              key={String(id)}
              className={kind === id ? "active" : ""}
              onClick={() => setKind(String(id))}
            >
              <I size={18} />
              {String(label)}
            </button>
          );
        })}
        <div className="sidebar-tip">
          <ShieldCheck size={22} />
          <strong>계정 없이, 바로.</strong>
          <p>실행하고 만들고 공유하세요. 편집 권한은 제작 브라우저에 보관돼요.</p>
        </div>
      </aside>
      <section className="gallery-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow blue-text">EXPLORE YOUR POSSIBILITIES</span>
            <h1>에이전트 갤러리</h1>
            <p>일과 일상에 도움이 되는 다양한 도구를 발견하세요.</p>
          </div>
          <Link className="btn" href="/make">
            <Plus size={17} />
            에이전트 만들기
          </Link>
        </div>
        <div className="gallery-tools">
          <div className="pills">
            {[
              ["all", "전체"],
              ["work", "업무"],
              ["personal", "개인"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={category === id ? "selected" : ""}
                onClick={() => setCategory(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
            내가 만든 콘텐츠
          </label>
          <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">최신 등록순</option>
            <option value="name">이름순</option>
          </select>
        </div>
        <div className="list-search">
          <Search size={18} />
          <input
            aria-label="갤러리 검색"
            placeholder="이름이나 주제로 검색하세요"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button aria-label="검색 지우기" className="icon-btn" onClick={() => setQ("")}>
              <X size={16} />
            </button>
          )}
        </div>
        <p className="result-count">
          총 <strong>{items.length}</strong>개의 콘텐츠
        </p>
        <div className="gallery-grid">
          {items.map((c) => (
            <Card key={c.id} content={c} onClone={clone} />
          ))}
        </div>
        {!items.length && (
          <div className="empty">
            <Search size={32} />
            <h3>일치하는 콘텐츠가 없어요</h3>
            <p>다른 검색어를 입력하거나 직접 만들어 보세요.</p>
          </div>
        )}
      </section>
    </div>
  );
}

type SharedActions = {
  clone: (c: PublicContent, t?: string) => Promise<void>;
  createShare: (c: PublicContent, days?: number) => Promise<void>;
  notify: (s: string) => void;
};
function Detail({
  id,
  shared,
  clone,
  createShare,
  notify,
  copy,
  sharing,
}: SharedActions & { id: string; shared: boolean; copy: (s: string) => void; sharing: boolean }) {
  const [c, setC] = useState<PublicContent | null>(null);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("result");
  const [opts, setOpts] = useState({
    x: "",
    y: "",
    radius: "2000",
    count: "10",
    corpCode: "",
    date: "7",
    guests: "",
    budget: "",
  });
  const [advanced, setAdvanced] = useState(false);
  const token = shared ? id : undefined;
  const suffix = token ? `?share=${token}` : "";
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setC(null);
      setResult(null);
      setError("");
      setInput("");
      setFile(null);
      try {
        const data = await api<{ content: PublicContent }>(`${shared ? "share" : "content"}/${id}`);
        if (!cancelled) setC(data.content);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, shared]);
  async function execute(sample = false) {
    if (!c) return;
    setBusy(true);
    setError("");
    try {
      const { result: r } = await api<{ result: Result }>(`run/${c.id}${suffix}`, {
        input,
        sample,
        file: file ? await fileData(file) : undefined,
        options: {
          radius: Number(opts.radius),
          count: Number(opts.count),
          x: opts.x ? Number(opts.x) : undefined,
          y: opts.y ? Number(opts.y) : undefined,
          corpCode: opts.corpCode,
          date: opts.date,
          guests: opts.guests,
          budget: opts.budget,
        },
      });
      setResult(r);
      setTab("result");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!c)
    return (
      <div className="page-width empty">
        {error ? (
          <>
            <AlertCircle size={32} />
            <h2>{error}</h2>
            <Link href="/gallery" className="btn outline">
              갤러리로 이동
            </Link>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>콘텐츠를 불러오는 중…</p>
          </>
        )}
      </div>
    );
  const builtin = findBuiltin(c.id) || findBuiltin(c.definition.builtinId || "");
  const type = builtin?.type || c.definition.type;
  const example =
    builtin?.example ||
    (type === "csv"
      ? builtins[1].example
      : "주제: 이번 주 업무 정리\n핵심 내용: 공개 자료를 확인하세요.\n다음 행동: 담당자에게 검토를 요청하세요.");
  return (
    <div className="detail page-width">
      <Link href="/gallery" className="back-link">
        <ChevronLeft size={16} />
        에이전트 갤러리로 돌아가기
      </Link>
      {shared && (
        <div className="notice info">
          <Link2 size={19} />
          공유 링크로 열었습니다. 로그인 없이 실행·복제할 수 있으며 원본은 수정할 수 없습니다.
        </div>
      )}
      <div className="detail-heading">
        <img
          className="detail-thumb"
          src={c.image || builtin?.image || "/images/research.svg"}
          alt=""
        />
        <div>
          <span className="eyebrow blue-text">
            {c.kind === "html"
              ? "HTML TOOL"
              : c.kind === "website"
                ? "WEBSITE"
                : "YOUR EVERYDAY AGENT"}
          </span>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
          <div className="tags">
            <span>{c.category === "work" ? "업무" : "개인"}</span>
            <span>{visibilityLabel[c.visibility]}</span>
            <span>{c.kind === "agent" ? typeLabel[type] || type : c.kind.toUpperCase()}</span>
            {c.version && <span>버전 {c.version}</span>}
          </div>
        </div>
        <div className="detail-heading-actions">
          {c.owned && (
            <Link className="btn quiet" href={`/make?id=${c.id}`}>
              <Pencil size={15} />
              수정
            </Link>
          )}
          {!shared && (c.owned || builtin) && (
            <button className="btn outline" disabled={sharing} onClick={() => void createShare(c)}>
              <Link2 size={16} />
              공유하기
            </button>
          )}
          <button className="btn outline" onClick={() => void clone(c, token)}>
            <Copy size={16} />
            복제해서 만들기
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="notice error">
          <AlertCircle size={19} />
          {error}
        </div>
      )}
      {c.kind === "agent" ? (
        <div className="runner">
          <section className="panel input-panel">
            <div className="panel-title">
              <h2>입력 조건</h2>
              <button
                className="text-link"
                onClick={() => {
                  setInput(example);
                  setFile(null);
                  notify(
                    "예시값을 채웠습니다. 샘플 데이터로 체험하려면 예시 결과 보기를 눌러 주세요.",
                  );
                }}
              >
                <Sparkles size={14} />
                예시값 채우기
              </button>
            </div>
            <p className="field-help">필요한 내용만 입력하면 준비 끝이에요.</p>
            <label>
              {builtin?.input || c.definition.inputLabel || "분석할 내용"}
              <textarea
                aria-label={builtin?.input || c.definition.inputLabel || "분석할 내용"}
                rows={type === "csv" ? 9 : 5}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  type === "csv"
                    ? "name,return,fee,date\nETF A,8.2,0.15,2026-10-16"
                    : "여기에 입력해 주세요…"
                }
              />
            </label>
            {["csv", "translation", "prompt", "companies", "structured"].includes(type) && (
              <label className="upload-zone">
                <Upload size={23} />
                <strong>{file ? file.name : "파일을 선택하거나 여기에 놓으세요"}</strong>
                <span>CSV · XLSX · PDF · TXT / 최대 2MB</span>
                <input
                  type="file"
                  accept={
                    ["csv", "companies"].includes(type) ? ".csv,.xlsx" : ".txt,.pdf,.csv,.xlsx"
                  }
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 2_000_000) {
                      setError("파일은 2MB까지 가능합니다.");
                      return;
                    }
                    setFile(f || null);
                  }}
                />
              </label>
            )}
            {file && (
              <button className="text-link" onClick={() => setFile(null)}>
                파일 선택 해제
              </button>
            )}
            {["places", "companies"].includes(type) && (
              <div className="field-grid">
                <label>
                  검색 반경
                  <select
                    value={opts.radius}
                    onChange={(e) => setOpts({ ...opts, radius: e.target.value })}
                  >
                    <option value="500">500m</option>
                    <option value="2000">2km</option>
                    <option value="5000">5km</option>
                  </select>
                </label>
                <label>
                  조회 개수
                  <select
                    value={opts.count}
                    onChange={(e) => setOpts({ ...opts, count: e.target.value })}
                  >
                    <option>5</option>
                    <option>10</option>
                    <option>15</option>
                  </select>
                </label>
              </div>
            )}
            {type === "news" && (
              <label>
                조회 기간
                <select
                  value={opts.date}
                  onChange={(e) => setOpts({ ...opts, date: e.target.value })}
                >
                  <option value="1">최근 1일</option>
                  <option value="7">최근 7일</option>
                  <option value="30">최근 30일</option>
                </select>
              </label>
            )}
            <button
              className="advanced-toggle"
              onClick={() => setAdvanced(!advanced)}
              aria-expanded={advanced}
            >
              <SlidersHorizontal size={16} />
              고급 설정
              <ChevronDown size={16} />
            </button>
            {advanced && (
              <div className="advanced-fields">
                {["places", "companies"].includes(type) ? (
                  <>
                    <p className="field-help">
                      기준 좌표를 입력하면 반경 필터와 거리순 정렬이 적용됩니다. 미입력 시 키워드
                      관련도순입니다.
                    </p>
                    <div className="field-grid">
                      <label>
                        경도
                        <input
                          type="number"
                          value={opts.x}
                          onChange={(e) => setOpts({ ...opts, x: e.target.value })}
                        />
                      </label>
                      <label>
                        위도
                        <input
                          type="number"
                          value={opts.y}
                          onChange={(e) => setOpts({ ...opts, y: e.target.value })}
                        />
                      </label>
                    </div>
                    {type === "companies" && (
                      <label>
                        DART 고유번호 (선택)
                        <input
                          value={opts.corpCode}
                          onChange={(e) => setOpts({ ...opts, corpCode: e.target.value })}
                          placeholder="8자리 기업 고유번호"
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <p className="field-help">
                    실행 입력과 결과 원문은 서버에 자동 저장하지 않습니다. 기록에는 실행 상태와 처리
                    시간만 남습니다.
                  </p>
                )}
                {c.id === "wedding" && (
                  <>
                    <label>
                      예식 예정 시기
                      <input
                        type="month"
                        value={opts.date}
                        onChange={(e) => setOpts({ ...opts, date: e.target.value })}
                      />
                    </label>
                    <label>
                      예산·하객 규모 메모
                      <input
                        value={opts.budget}
                        onChange={(e) => setOpts({ ...opts, budget: e.target.value })}
                        placeholder="사용자 입력 · 장소 검색 필터로 사용하지 않음"
                      />
                    </label>
                  </>
                )}
              </div>
            )}
            <button className="btn run-button" disabled={busy} onClick={() => void execute()}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
              {busy ? "결과를 준비하고 있어요…" : "실행하기"}
            </button>
            <button className="btn quiet full" disabled={busy} onClick={() => void execute(true)}>
              예시 결과 보기 <span className="sample-inline">샘플</span>
            </button>
            <div className="input-footnote">
              <ShieldCheck size={15} />
              <span>
                서버 키는 공유되지 않아요.
                <br />
                실행 횟수·동시 실행 제한이 적용됩니다.
              </span>
            </div>
          </section>
          <section className="panel result-panel">
            <div className="panel-title">
              <h2>실행 결과</h2>
              {result && (
                <span className={`status-badge ${result.status}`}>
                  {result.status === "sample"
                    ? "샘플 데이터"
                    : result.status === "partial"
                      ? "부분 완료"
                      : "완료"}
                </span>
              )}
            </div>
            {!result ? (
              <div className="result-empty">
                <span className="result-empty-icon">
                  <Sparkles size={35} />
                </span>
                <h3>일의 다음 단계를 가볍게</h3>
                <p>
                  왼쪽에서 조건을 입력하고 실행해 보세요.
                  <br />
                  결과와 근거를 이곳에서 확인할 수 있어요.
                </p>
                <div className="empty-steps">
                  <span>01 조건 입력</span>
                  <ArrowRight size={14} />
                  <span>02 실행</span>
                  <ArrowRight size={14} />
                  <span>03 결과 확인</span>
                </div>
              </div>
            ) : (
              <>
                <div className="result-tabs">
                  {[
                    ["result", "결과"],
                    ["chart", "차트·지도"],
                    ["sources", "근거·출처"],
                  ].map(([id, title]) => (
                    <button
                      key={id}
                      className={tab === id ? "active" : ""}
                      onClick={() => setTab(id)}
                    >
                      {title}
                    </button>
                  ))}
                </div>
                <div className="result-summary">
                  <Sparkles size={22} />
                  <strong>{result.summary}</strong>
                </div>
                {result.warnings.map((w) => (
                  <p
                    className={`result-warning ${result.status === "sample" ? "sample-text" : ""}`}
                    key={w}
                  >
                    <AlertCircle size={14} />
                    {w}
                  </p>
                ))}
                {tab === "result" ? (
                  <>
                    {result.text && <pre className="result-text">{result.text}</pre>}
                    {result.rows && (
                      <ResultTable rows={result.rows} notify={notify} persist={type === "places"} />
                    )}
                    {result.rows?.length === 0 && (
                      <div className="empty">
                        <Search size={27} />
                        <p>검색 결과가 없습니다. 검색어·지역을 바꿔 주세요.</p>
                      </div>
                    )}
                  </>
                ) : tab === "chart" ? (
                  <DataVisual rows={result.rows || []} />
                ) : (
                  <div className="sources">
                    <p>조회 시각: {new Date(result.fetchedAt).toLocaleString("ko-KR")}</p>
                    {result.sources.map((s, i) => (
                      <div key={i}>
                        {s.url && /^https?:\/\//i.test(s.url) ? (
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.label}
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span>{s.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="result-toolbar">
                  <button
                    className="btn outline small"
                    onClick={() => copy(JSON.stringify(result, null, 2))}
                  >
                    <Copy size={14} />
                    결과 복사
                  </button>
                  <button
                    className="btn outline small"
                    onClick={() =>
                      download(
                        "agent-result.json",
                        JSON.stringify(result, null, 2),
                        "application/json",
                      )
                    }
                  >
                    <Download size={14} />
                    결과 저장
                  </button>
                  {result.rows?.length ? (
                    <button
                      className="btn outline small"
                      onClick={() =>
                        download("agent-result.csv", csv(result.rows!), "text/csv;charset=utf-8")
                      }
                    >
                      CSV 다운로드
                    </button>
                  ) : null}
                </div>
                <p className="field-help">
                  공유 링크에는 에이전트 정의만 포함됩니다. 이번 입력·문서·결과는 자동 공개되지
                  않습니다.
                </p>
              </>
            )}
          </section>
        </div>
      ) : c.kind === "html" ? (
        <section className="panel html-panel">
          <div className="notice info">
            <ShieldCheck size={19} />
            격리된 HTML · 임의 스크립트, 쿠키, 외부 통신, 폼 전송은 차단됩니다.
          </div>
          <iframe
            title="공유 HTML 미리보기"
            sandbox=""
            referrerPolicy="no-referrer"
            src={`/api/content/${c.id}/raw${suffix}`}
          />
        </section>
      ) : (
        <section className="panel website-panel">
          <Globe size={40} />
          <h2>{c.title}</h2>
          <p>
            외부 웹사이트는 새 탭에서 열립니다. 해당 사이트의 개인정보 정책과 이용조건이 적용됩니다.
          </p>
          <p className="website-url">{c.url}</p>
          <a className="btn" href={c.url || "#"} rel="noreferrer" target="_blank">
            웹사이트 열기
            <ExternalLink size={17} />
          </a>
        </section>
      )}
    </div>
  );
}

function ResultTable({
  rows,
  notify,
  persist,
}: {
  rows: Record<string, string | number>[];
  notify: (s: string) => void;
  persist: boolean;
}) {
  const keys = Object.keys(rows[0] || {});
  const [note, setNote] = useState("");
  if (!rows.length) return null;
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{k}</th>
              ))}
              {persist && <th>후보 저장</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k}>
                    {/^https?:\/\//i.test(String(row[k])) ? (
                      <a href={String(row[k])} target="_blank" rel="noreferrer">
                        열기
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      String(row[k])
                    )}
                  </td>
                ))}
                {persist && (
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`${row.이름 || i} 후보 저장`}
                      onClick={async () => {
                        try {
                          await api("favorites", {
                            key: String(row.지도 || row.이름 || i),
                            data: {
                              ...Object.fromEntries(
                                Object.entries(row).map(([k, v]) => [k, String(v)]),
                              ),
                              메모: note,
                              정보구분: "사용자 입력 메모",
                            },
                          });
                          notify("후보와 메모를 내 에이전트에 저장했습니다.");
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      <Heart size={17} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 100 && (
        <p className="field-help">처음 100행 표시 · 전체 자료는 CSV로 내려받으세요.</p>
      )}
      {persist && (
        <label>
          후보에 남길 개인 메모 · 사용자 입력
          <input
            placeholder="웨딩홀 가격·식대·보증 인원, 방문 체크리스트 등"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="field-help">
            메모 입력 후 해당 행의 하트를 누르면 내 브라우저에만 저장됩니다.
          </span>
        </label>
      )}
    </>
  );
}
function DataVisual({ rows }: { rows: Record<string, string | number>[] }) {
  const numeric = Object.keys(rows[0] || {}).filter((k) =>
    rows.some((r) => typeof r[k] === "number"),
  );
  const [key, setKey] = useState(numeric[0] || "");
  if (rows.some((r) => r.위도 && r.경도))
    return (
      <div className="map-list">
        <PlaceMap rows={rows} />
        <p className="field-help">공식 지도에서 실제 위치와 길찾기를 확인하세요.</p>
        {rows.map((r, i) => (
          <a key={i} target="_blank" rel="noreferrer" href={String(r.지도)}>
            <span className="map-pin">
              <MapPin size={21} />
              {i + 1}
            </span>
            <div>
              <strong>{r.이름}</strong>
              <p>{r.주소}</p>
              <small>
                {r.위도}, {r.경도}
              </small>
            </div>
            <ArrowUpRight size={17} />
          </a>
        ))}
      </div>
    );
  if (!numeric.length)
    return (
      <div className="empty">
        <Layers size={30} />
        <p>숫자 또는 위치 데이터가 있어야 차트·지도를 표시할 수 있습니다.</p>
      </div>
    );
  const vals = rows
    .slice(0, 40)
    .map((r) => Number(r[key]))
    .filter(Number.isFinite);
  const max = Math.max(...vals.map(Math.abs), 1);
  return (
    <div className="data-chart">
      <label>
        표시 항목
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {numeric.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <div className="bars">
        {rows.slice(0, 40).map((r, i) => (
          <div className="bar-item" key={i}>
            <span>{String(r.name || r.관측일 || r.종목 || i + 1)}</span>
            <div>
              <i style={{ width: `${(Math.abs(Number(r[key])) / max) * 100}%` }} />
            </div>
            <strong>{r[key]}</strong>
          </div>
        ))}
      </div>
      <p className="field-help">
        실제 결과 값 기준 · 최대 40개 관측 표시 · 단위는 원본 열 이름을 확인하세요.
      </p>
    </div>
  );
}

function Maker({
  id,
  onSaved,
  notify,
}: {
  id: string | null;
  onSaved: (c: PublicContent, key?: string) => void;
  notify: (s: string) => void;
}) {
  const query = useSearchParams();
  const [step, setStep] = useState("basic");
  const [kind, setKind] = useState(query.get("kind") || "agent");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("work");
  const [visibility, setVisibility] = useState("link");
  const [type, setType] = useState("structured");
  const [builtinId, setBuiltinId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [inputLabel, setInputLabel] = useState("도움이 필요한 내용");
  const [variables, setVariables] = useState("주제,핵심 내용,다음 행동");
  const [output, setOutput] = useState("핵심 내용을 간결한 표로 보여주세요.");
  const [schema, setSchema] = useState("");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testInput, setTestInput] = useState("이번 주 업무\n공개 자료 점검\n담당자 검토 요청");
  const [preview, setPreview] = useState<Result | null>(null);
  useEffect(() => {
    if (!id) return;
    void api<{ content: PublicContent }>(`content/${id}`)
      .then(({ content: c }) => {
        if (!c.owned) throw new Error("이 브라우저에 편집 권한이 없습니다.");
        setKind(c.kind);
        setTitle(c.title);
        setDescription(c.description);
        setCategory(c.category);
        setVisibility(c.visibility);
        setType(c.definition.type);
        setBuiltinId(c.definition.builtinId || "");
        setPrompt(c.definition.prompt || "");
        setInputLabel(c.definition.inputLabel || "입력");
        setVariables(c.definition.variables || "");
        setOutput(c.definition.output || "");
        setSchema(c.definition.schema || "");
        setUrl(c.url || "");
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const definition = {
    type,
    prompt,
    inputLabel,
    variables,
    output,
    schema,
    builtinId: builtinId || undefined,
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        kind,
        title,
        description,
        category,
        visibility,
        definition,
        html: kind === "html" ? html : undefined,
        url: kind === "website" ? url : undefined,
      };
      const data = await api<{ content: PublicContent; recoveryKey?: string }>(
        `content${id ? `/${id}` : ""}`,
        body,
        id ? "PATCH" : "POST",
      );
      onSaved(data.content, data.recoveryKey);
      notify(id ? "새 버전을 저장했습니다." : "내 에이전트에 저장했습니다.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ result: Result }>("preview", { definition, input: testInput });
      setPreview(r.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="maker-layout page-width">
      <aside className="maker-guide">
        <span className="eyebrow blue-text">FROM IDEA TO AGENT</span>
        <h2>
          나의 노하우가
          <br />
          모두의 가능성으로.
        </h2>
        <p>복잡한 코딩 없이, 내가 필요한 도구를 직접 만들어 보세요.</p>
        <ol>
          {[
            "어떤 도움을 줄까요?",
            "어떤 정보를 받을까요?",
            "어떤 자료를 사용할까요?",
            "결과는 어떻게 보여줄까요?",
            "누구와 나눌까요?",
          ].map((s, i) => (
            <li key={s}>
              <span>{i + 1}</span>
              <div>
                <strong>{s}</strong>
                <small>
                  {
                    [
                      "이름과 한 줄 소개를 적어요.",
                      "입력 항목을 정해요.",
                      "실제로 연결된 실행 방식을 골라요.",
                      "테스트 실행으로 미리 확인해요.",
                      "링크로 공유하고 함께 사용해요.",
                    ][i]
                  }
                </small>
              </div>
            </li>
          ))}
        </ol>
        <div className="notice info">
          <ShieldCheck size={21} />
          <span>원본 편집 권한은 이 브라우저에만. 공유 링크에는 포함되지 않아요.</span>
        </div>
        <Link href="/tutorials" className="text-link">
          튜토리얼 따라 만들기
          <ArrowRight size={15} />
        </Link>
      </aside>
      <section className="panel maker-form">
        <div className="page-heading">
          <div>
            <span className="eyebrow blue-text">CREATE SOMETHING USEFUL</span>
            <h1>{id ? "에이전트 수정" : "나만의 에이전트 만들기"}</h1>
            <p>작은 아이디어 하나로 매일의 일을 가볍게.</p>
          </div>
          <span className="step-counter">{step === "basic" ? "01" : "02"} / 02</span>
        </div>
        <div className="result-tabs">
          <button className={step === "basic" ? "active" : ""} onClick={() => setStep("basic")}>
            기본 설정
          </button>
          <button
            className={step === "advanced" ? "active" : ""}
            onClick={() => setStep("advanced")}
          >
            상세 설정·테스트
          </button>
        </div>
        <form onSubmit={submit}>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {step === "basic" ? (
            <>
              <fieldset className="kind-selector">
                <legend>무엇을 만들까요?</legend>
                {[
                  ["agent", "에이전트", Sparkles],
                  ["html", "HTML 도구", FileCode2],
                  ["website", "웹사이트", Globe],
                ].map(([key, label, Icon]) => {
                  const I = Icon as typeof Sparkles;
                  return (
                    <button
                      disabled={Boolean(id)}
                      className={kind === key ? "selected" : ""}
                      type="button"
                      key={String(key)}
                      onClick={() => setKind(String(key))}
                    >
                      <I size={20} />
                      {String(label)}
                    </button>
                  );
                })}
              </fieldset>
              <label>
                이름 <b className="required">*</b>
                <input
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예) 주간 업무 리포트 도우미"
                />
              </label>
              <label>
                한 줄 소개
                <textarea
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="어떤 도움을 주는지 간단하게 소개해 주세요."
                />
                <span className="char-count">{description.length}/500</span>
              </label>
              <div className="field-grid">
                <label>
                  카테고리
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="work">업무</option>
                    <option value="personal">개인</option>
                  </select>
                </label>
                <label>
                  공유 범위
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                    <option value="link">링크 공유 (기본)</option>
                    <option value="private">비공개</option>
                    <option value="public">갤러리 공개 · 전체 방문자</option>
                  </select>
                </label>
              </div>
              <p className="field-help">
                {visibility === "public"
                  ? "전체 방문자에게 갤러리로 공개됩니다. 민감한 정보를 포함하지 마세요."
                  : visibility === "link"
                    ? "갤러리에 자동 공개되지 않습니다. 공유 링크를 발급한 사람만 열 수 있습니다."
                    : "제작 브라우저에서만 열고 관리합니다."}
              </p>
              {kind === "agent" ? (
                <>
                  <label>
                    실행 방식
                    <select
                      value={type}
                      onChange={(e) => {
                        setType(e.target.value);
                        setBuiltinId("");
                      }}
                    >
                      {Object.entries(typeLabel).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="notice info">
                    <Layers size={18} />
                    {type === "structured"
                      ? "키 없이 입력한 줄을 항목별로 정리합니다. 외부 정보나 AI 분석을 생성하지 않습니다."
                      : type === "csv"
                        ? "사용자가 올린 실제 CSV/XLSX를 파싱하고 숫자 항목을 집계합니다."
                        : type === "news" ||
                            type === "rates" ||
                            type === "places" ||
                            type === "companies"
                          ? "운영자가 연결한 공식 공개 API를 사용합니다. 필요한 서버 키가 없으면 설정 안내를 표시합니다."
                          : "운영자의 Anthropic API 연결이 필요합니다. 키가 없으면 가짜 결과를 만들지 않습니다."}
                  </div>
                  <label>
                    어떤 정보를 입력받을까요?
                    <input
                      maxLength={100}
                      value={inputLabel}
                      onChange={(e) => setInputLabel(e.target.value)}
                    />
                  </label>
                </>
              ) : kind === "html" ? (
                <>
                  <label className="upload-zone">
                    <Upload size={24} />
                    <strong>{fileName || "단일 HTML 파일 업로드"}</strong>
                    <span>최대 2MB · 외부 파일·네트워크 접근 차단</span>
                    <input
                      type="file"
                      accept=".html,.htm,text/html"
                      disabled={Boolean(id)}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 2_000_000) {
                          setError("파일은 2MB까지 가능합니다.");
                          return;
                        }
                        setHtml(await f.text());
                        setFileName(f.name);
                      }}
                    />
                  </label>
                  <p className="field-help">
                    안전한 HTML 표시를 지원합니다. 임의 스크립트, 링크 이동, 외부 요청, 쿠키, 폼
                    전송, 팝업은 차단됩니다.
                  </p>
                </>
              ) : (
                <label>
                  공개 HTTPS 주소
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                  <span className="field-help">
                    내부망·로컬 주소는 등록할 수 없습니다. 새 탭에서 열립니다.
                  </span>
                </label>
              )}
            </>
          ) : (
            <>
              {kind === "agent" ? (
                <>
                  <label>
                    작업 지침 · 프롬프트
                    <textarea
                      rows={5}
                      maxLength={10000}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="자료에서 확인된 내용만 정리하고 근거를 표시해 주세요."
                    />
                  </label>
                  <label>
                    입력·출력 항목 정의 (쉼표로 구분)
                    <textarea
                      rows={2}
                      value={variables}
                      onChange={(e) => setVariables(e.target.value)}
                      placeholder="주제,핵심 내용,다음 행동"
                    />
                  </label>
                  <label>
                    결과 안내
                    <input value={output} onChange={(e) => setOutput(e.target.value)} />
                  </label>
                  <p className="field-help">
                    구조화 방식은 입력 줄을 위 항목 순서대로 정리합니다. AI 방식은 작업 지침과 결과
                    안내를 모델에 전달합니다. 공개 API 방식은 정해진 데이터만 조회합니다.
                  </p>
                  {["prompt", "translation", "url-summary"].includes(type) && (
                    <label>
                      출력 스키마 · 선택 사항
                      <textarea
                        rows={3}
                        value={schema}
                        onChange={(e) => setSchema(e.target.value)}
                        placeholder={'{"주제":"string","요약":"string","확인필요":"boolean"}'}
                      />
                      <span className="field-help">
                        JSON 키별 타입(string, number, boolean)을 정의합니다. 실제 AI 응답 형식을
                        검증합니다.
                      </span>
                    </label>
                  )}
                  <label>
                    테스트 입력
                    <textarea
                      rows={4}
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn outline"
                    disabled={busy}
                    onClick={() => void test()}
                  >
                    {busy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}저장 전
                    실제 테스트 실행
                  </button>
                  {preview && (
                    <div className="preview-result">
                      <strong>{preview.summary}</strong>
                      {preview.rows && (
                        <ResultTable rows={preview.rows} notify={notify} persist={false} />
                      )}
                      <pre className="result-text">{preview.text}</pre>
                    </div>
                  )}
                </>
              ) : kind === "html" && html ? (
                <iframe
                  className="html-maker-preview"
                  title="업로드 HTML 미리보기"
                  sandbox=""
                  srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">${html}`}
                />
              ) : (
                <div className="notice info">
                  <ShieldCheck size={20} />
                  저장 후 콘텐츠 화면에서 공유 링크를 생성할 수 있습니다.
                </div>
              )}
              <div className="notice warning">
                <LockKeyhole size={19} />새 콘텐츠를 저장하면 복구 키를 한 번 표시합니다. 안전한
                곳에 보관하세요. 브라우저 쿠키를 지우면 편집 권한을 잃을 수 있습니다.
              </div>
            </>
          )}
          <div className="maker-bottom">
            <p>
              <ShieldCheck size={15} />
              입력·실행 결과는 자동 공유되지 않아요.
            </p>
            {step === "basic" ? (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (!title.trim()) {
                    setError("이름을 입력해 주세요.");
                    return;
                  }
                  setError("");
                  setStep("advanced");
                }}
              >
                다음 단계
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button className="btn quiet" type="button" onClick={() => setStep("basic")}>
                  이전
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}저장하기
                </button>
              </>
            )}
          </div>
        </form>
      </section>
      <aside className="maker-share">
        <Link2 size={27} />
        <h3>좋은 도구는 함께.</h3>
        <p>저장 후 공유 링크를 만들면 동료가 바로 실행할 수 있어요.</p>
        <div className="share-demo">
          <span>입력</span>
          <ArrowRight size={15} />
          <span>실행</span>
          <ArrowRight size={15} />
          <span>공유</span>
        </div>
        <p>
          원본은 그대로,
          <br />
          복제한 도구는 각자의 방식으로.
        </p>
      </aside>
    </div>
  );
}

function My({
  mine,
  refresh,
  notify,
  setRecovery,
  setError,
  clone,
  createShare,
}: {
  mine: PublicContent[];
  refresh: () => Promise<void>;
  setRecovery: (s: string) => void;
  setError: (s: string) => void;
} & SharedActions) {
  const [key, setKey] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, string>[]>([]);
  const [deleting, setDeleting] = useState<PublicContent | null>(null);
  useEffect(() => {
    void api<{ favorites: Record<string, string>[] }>("favorites")
      .then((d) => setFavorites(d.favorites))
      .catch((e) => setError(e.message));
  }, [setError]);
  async function recover(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await api<{ id: string; recoveryKey: string }>("recover", {
        recoveryKey: key.trim(),
      });
      setRecovery(data.recoveryKey);
      setRecovering(false);
      setKey("");
      await refresh();
      notify("이 브라우저로 편집 권한을 복구했습니다. 이전 복구 키는 폐기되었습니다.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="page-width my-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow blue-text">YOUR PERSONAL WORKSPACE</span>
          <h1>내 에이전트</h1>
          <p>이 브라우저에서 만든 도구와 저장한 후보를 모아 보세요.</p>
        </div>
        <Link href="/make" className="btn">
          <Plus size={17} />
          새로 만들기
        </Link>
      </div>
      <div className="notice info">
        <LockKeyhole size={19} />
        <span>
          편집 권한은 이 브라우저에 보관됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 복구 키가
          필요합니다.
        </span>
        <button className="text-link" onClick={() => setRecovering(true)}>
          권한 복구
          <ArrowRight size={14} />
        </button>
      </div>
      {mine.length ? (
        <div className="my-grid">
          {mine.map((c) => (
            <section key={c.id} className="my-item">
              <Card content={c} onClone={clone} />
              <div className="my-controls">
                <span>{visibilityLabel[c.visibility]}</span>
                {c.owned ? (
                  <>
                    <Link href={`/make?id=${c.id}`} aria-label={`${c.title} 수정`}>
                      <Pencil size={16} />
                    </Link>
                    <button
                      className="icon-btn"
                      aria-label={`${c.title} 공유`}
                      onClick={() => void createShare(c)}
                    >
                      <Link2 size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`${c.title} 공유 해제`}
                      onClick={async () => {
                        try {
                          await api(`content/${c.id}/revoke`, {});
                          notify("모든 공유 링크를 해제했습니다.");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <LockKeyhole size={16} />
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={`${c.title} 삭제`}
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <span>편집 키 없음 · 복구 필요</span>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty large">
          <span className="round-icon">
            <Layers size={34} />
          </span>
          <h2>첫 번째 에이전트를 만들어 보세요</h2>
          <p>
            자주 하는 일을 나만의 도구로 만들어 보세요.
            <br />
            로그인 없이 저장하고, 동료에게 공유할 수 있어요.
          </p>
          <Link href="/make" className="btn">
            나만의 에이전트 만들기
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <section className="section">
        <div className="section-top">
          <h2>저장한 장소·웨딩홀 후보</h2>
          <span className="soft-label">{favorites.length}</span>
        </div>
        {favorites.length ? (
          <div className="favorites-grid">
            {favorites.map((f) => (
              <article className="panel favorite" key={f.key}>
                <Heart size={20} />
                <h3>{f.이름}</h3>
                <p>{f.주소}</p>
                <label>
                  개인 메모 · 사용자 입력
                  <textarea
                    defaultValue={f.메모}
                    onBlur={async (e) => {
                      try {
                        await api("favorites", {
                          key: f.key,
                          data: { ...f, 메모: e.target.value },
                        });
                        notify("메모를 저장했습니다.");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                </label>
                {f.지도 && (
                  <a href={f.지도} target="_blank" rel="noreferrer" className="text-link">
                    지도에서 보기
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  className="btn small quiet"
                  onClick={async () => {
                    await api(`favorites/${encodeURIComponent(f.key)}`, undefined, "DELETE");
                    setFavorites(favorites.filter((x) => x.key !== f.key));
                  }}
                >
                  후보 삭제
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="field-help">
            장소 검색 결과에서 하트를 누르면 여기에 저장됩니다. 공유 링크에 자동 포함되지 않습니다.
          </p>
        )}
      </section>
      {recovering && (
        <Modal title="편집 권한 복구" onClose={() => setRecovering(false)}>
          <p>
            콘텐츠를 만들 때 저장한 복구 키를 입력하세요. 복구 시 이전 편집·복구 키는 변경됩니다.
          </p>
          <form onSubmit={recover}>
            <label>
              복구 키
              <input
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="btn" type="submit">
              <RotateCcw size={16} />이 브라우저로 복구
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="콘텐츠를 삭제할까요?" onClose={() => setDeleting(null)}>
          <p>
            {deleting.title}
            <br />
            콘텐츠와 공유 링크가 삭제됩니다. 복구할 수 없습니다.
          </p>
          <button
            className="btn danger"
            onClick={async () => {
              try {
                await api(`content/${deleting.id}`, undefined, "DELETE");
                setDeleting(null);
                await refresh();
                notify("삭제했습니다.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            삭제하기
          </button>
        </Modal>
      )}
    </div>
  );
}

const tutorials = [
  {
    id: "first",
    title: "첫 에이전트 실행",
    description: "입력부터 결과 확인까지, 직접 해보세요.",
    icon: Play,
    steps: [
      [
        "에이전트를 골라요",
        "갤러리에서 ETF 비교 분석을 열어 주세요.",
        "/agents/etf",
        "ETF 분석 열기",
      ],
      [
        "예시 자료를 채워요",
        "예시값 채우기로 연습 자료를 확인하세요. 샘플임을 확인하세요.",
        "/agents/etf",
        "예시 자료 확인",
      ],
      [
        "실제로 실행해요",
        "실행하기를 누르면 업로드한 숫자를 코드로 비교합니다.",
        "/agents/etf",
        "실행해 보기",
      ],
      [
        "근거를 확인해요",
        "기준일·주의사항과 출처를 확인하고 CSV로 저장하세요.",
        "/agents/etf",
        "결과 확인하기",
      ],
    ],
  },
  {
    id: "data",
    title: "실데이터 연결",
    description: "어떤 데이터가 필요한지, 안전하게 연결하는 법.",
    icon: Globe,
    steps: [
      [
        "연결 상태를 확인해요",
        "설정 화면은 서버 키의 연결 여부만 보여줍니다.",
        "/settings",
        "연결 상태 확인",
      ],
      [
        "공식 사이트에서 발급해요",
        "API 키는 운영자가 공식 제공처에서 발급받습니다. 채팅이나 공유 링크에 넣지 마세요.",
        "/settings",
        "발급 안내 확인",
      ],
      [
        "운영자에게 연결을 요청해요",
        "서버 환경변수에만 등록합니다. 익명 사용자는 공용 키를 변경할 수 없습니다.",
        "/settings",
        "운영 방식 확인",
      ],
      [
        "실제로 조회해요",
        "뉴스·환율·장소 중 연결된 에이전트를 실행하고 출처와 관측일을 확인하세요.",
        "/gallery",
        "에이전트 선택",
      ],
    ],
  },
  {
    id: "create",
    title: "나만의 에이전트 만들기",
    description: "작은 아이디어를 동료와 쓰는 도구로.",
    icon: Sparkles,
    steps: [
      [
        "도움이 필요한 일을 정해요",
        "만들기에서 이름과 설명을 적고 실행 방식을 선택하세요.",
        "/make",
        "만들기 시작",
      ],
      [
        "저장 전에 테스트해요",
        "키 없이 체험하려면 입력 구조화나 CSV 분석을 골라 보세요.",
        "/make",
        "테스트 실행",
      ],
      [
        "저장하고 키를 보관해요",
        "내 에이전트에 저장하고 복구 키를 안전하게 보관하세요.",
        "/my",
        "내 에이전트 확인",
      ],
      [
        "링크로 공유해요",
        "공유하기로 발급한 링크를 시크릿 창에서 열어 실행해 보세요.",
        "/my",
        "공유하러 가기",
      ],
    ],
  },
];
function Tutorials() {
  const [current, setCurrent] = useState("first");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    void api<{ progress: { tutorial: string; step: number }[] }>("progress")
      .then((d) => setProgress(Object.fromEntries(d.progress.map((p) => [p.tutorial, p.step]))))
      .catch((e) => setError(e.message));
  }, []);
  const t = tutorials.find((t) => t.id === current)!;
  const step = progress[t.id] || 0;
  async function advance(n: number) {
    try {
      await api("progress", { tutorial: t.id, step: n });
      setProgress({ ...progress, [t.id]: n });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="page-width tutorials-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow blue-text">LEARN BY DOING</span>
          <h1>5분 만에 시작하는 Agent Hub</h1>
          <p>로그인 없이, 한 단계씩 직접 해보세요. 진행 상황은 이 브라우저에 저장됩니다.</p>
        </div>
        <BookOpen size={42} />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="tutorial-cards">
        {tutorials.map((v, i) => (
          <button
            key={v.id}
            className={`panel tutorial-card ${current === v.id ? "active" : ""}`}
            onClick={() => setCurrent(v.id)}
          >
            <span className="tutorial-number">0{i + 1}</span>
            <v.icon size={26} />
            <h2>{v.title}</h2>
            <p>{v.description}</p>
            <span className="tutorial-progress">
              <i style={{ width: `${(progress[v.id] || 0) * 25}%` }} />
            </span>
            <span>{progress[v.id] === 4 ? "완료" : `${progress[v.id] || 0}/4 단계`}</span>
          </button>
        ))}
      </div>
      <div className="panel tutorial-detail">
        <aside>
          {t.steps.map((s, i) => (
            <button
              key={s[0]}
              className={Math.min(step, 3) === i ? "active" : ""}
              onClick={() => void advance(i)}
            >
              <span>{step > i ? <Check size={15} /> : i + 1}</span>
              {s[0]}
            </button>
          ))}
        </aside>
        <section>
          {step === 4 ? (
            <>
              <span className="round-icon">
                <Check size={35} />
              </span>
              <h2>준비됐어요. 직접 시작해 보세요!</h2>
              <p>이제 실행하고, 만들고, 공유할 수 있어요.</p>
              <Link href="/gallery" className="btn">
                갤러리 둘러보기
                <ArrowRight size={16} />
              </Link>
              <button className="btn quiet" onClick={() => void advance(0)}>
                처음부터 다시
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow blue-text">STEP 0{step + 1}</span>
              <h2>{t.steps[step][0]}</h2>
              <p>{t.steps[step][1]}</p>
              <Link className="btn outline" href={t.steps[step][2]}>
                {t.steps[step][3]}
                <ArrowUpRight size={16} />
              </Link>
              <div className="tutorial-next">
                <button className="btn" onClick={() => void advance(step + 1)}>
                  이 단계 완료
                  <Check size={17} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
const providers = [
  {
    name: "네이버 뉴스",
    keys: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
    url: "https://developers.naver.com/apps/#/register",
    text: "애플리케이션 등록 → 검색 API 추가",
  },
  {
    name: "카카오 로컬",
    keys: ["KAKAO_REST_API_KEY"],
    url: "https://developers.kakao.com/console/app",
    text: "앱 등록 → REST API 키",
  },
  {
    name: "OpenDART",
    keys: ["DART_API_KEY"],
    url: "https://opendart.fss.or.kr/",
    text: "공시대상 기업의 공개 기업개황",
  },
  {
    name: "FRED",
    keys: ["FRED_API_KEY"],
    url: "https://fredaccount.stlouisfed.org/apikeys",
    text: "환율·미국 국채, 관측일 기준",
  },
  {
    name: "Anthropic",
    keys: ["ANTHROPIC_API_KEY"],
    url: "https://console.anthropic.com/settings/keys",
    text: "문서 번역·AI 요약 · 유료 API",
  },
];
function Connections() {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    void api<{ integrations: { name: string; connected: boolean }[] }>("status")
      .then((d) => setStatus(Object.fromEntries(d.integrations.map((s) => [s.name, s.connected]))))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page-width settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow blue-text">CONNECTIONS & PRIVACY</span>
          <h1>연결 및 사용 설정</h1>
          <p>필요한 데이터만 안전하게. 서버 키는 운영자가 관리합니다.</p>
        </div>
        <ShieldCheck size={40} />
      </div>
      <div className="notice info">
        <LockKeyhole size={21} />
        <span>
          이 화면은 연결 여부와 발급 안내만 제공합니다. 공용 API 키 변경·서버 관리는 익명 사용자에게
          제공하지 않습니다.
        </span>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="connection-grid">
        {providers.map((p) => (
          <article className="panel connection" key={p.name}>
            <div className="panel-title">
              <h2>{p.name}</h2>
              <span
                className={`status-badge ${p.keys.every((k) => status[k]) ? "success" : "pending"}`}
              >
                {p.keys.every((k) => status[k]) ? "서버 키 설정됨" : "설정 필요"}
              </span>
            </div>
            <p>{p.text}</p>
            <div className="env-names">
              {p.keys.map((k) => (
                <code key={k}>{k}</code>
              ))}
            </div>
            <a href={p.url} target="_blank" rel="noreferrer" className="text-link">
              공식 발급 안내
              <ExternalLink size={15} />
            </a>
            <p className="field-help">
              키 존재 여부이며 실제 연결 성공을 보장하지 않습니다. 연결 테스트는 해당 에이전트의
              실제 실행으로 확인하세요.
            </p>
          </article>
        ))}
      </div>
      <div className="panel privacy-card">
        <h2>알아두면 좋은 사용 안내</h2>
        <ul>
          <li>브라우저 쿠키는 제작·편집 권한을 보관합니다. 복구 키를 따로 보관하세요.</li>
          <li>공유 링크를 아는 외부 사용자도 열람·실행할 수 있습니다. 승인된 자료만 공유하세요.</li>
          <li>민감한 입력·실행 결과는 자동 저장·공개되지 않습니다.</li>
          <li>실행은 브라우저와 네트워크별로 제한됩니다. 잠시 후 다시 시도할 수 있습니다.</li>
          <li>
            노트북이 꺼지거나 절전 상태가 되면 서버도 중단됩니다. 외부 접속은 승인된 HTTPS 주소나
            VPN을 사용하세요.
          </li>
        </ul>
      </div>
    </div>
  );
}
