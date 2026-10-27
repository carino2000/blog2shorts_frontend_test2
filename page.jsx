'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/* ───────── 네이버 블로그 URL 검증 ─────────
 * 허용 형태
 *  - https://blog.naver.com/{blogId}/{logNo}
 *  - https://m.blog.naver.com/{blogId}/{logNo}
 *  - https://blog.naver.com/PostView.naver?blogId=...&logNo=...
 * naver.me 단축 링크는 서버에서 리다이렉트를 따라가야 해서 이번 화면에선 받지 않음
 */
function parseNaverBlogUrl(input) {
  let url;
  try {
    const raw = input.trim();
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'blog.naver.com' && host !== 'm.blog.naver.com') return null;

  if (/^\/PostView\.n(aver|hn)$/i.test(url.pathname)) {
    const blogId = url.searchParams.get('blogId');
    const logNo = url.searchParams.get('logNo');
    return blogId && /^\d+$/.test(logNo ?? '') ? { blogId, logNo } : null;
  }

  const [, blogId, logNo] = url.pathname.split('/');
  return blogId && /^\d+$/.test(logNo ?? '') ? { blogId, logNo } : null;
}

/* ───────── 목업 API (AI 호출 없음) ───────── */
function mockGenerate(source, shouldFail) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('본문을 가져오지 못했습니다.'));
        return;
      }
      resolve({
        id: `draft-${Date.now()}`,
        source: { ...source, images: [] },
        script: {
          hook: '(목업) 시선을 끄는 첫 문장',
          body: '(목업) 블로그 핵심 내용 요약',
          cta: '(목업) 행동 유도 문장',
          estimatedSec: 45,
        },
        scenes: [],
        video: { status: 'idle', url: null, format: 'mp4', width: 1080, height: 1920 },
      });
    }, 1200);
  });
}

export default function ContentInputPage() {
  const router = useRouter();
  const [tab, setTab] = useState('url'); // 'url' | 'text'
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [error, setError] = useState('');
  const [mockFail, setMockFail] = useState(false);

  const value = tab === 'url' ? url : text;
  const isEmpty = value.trim() === '';
  const urlInvalid = tab === 'url' && !isEmpty && !parseNaverBlogUrl(url);
  const canSubmit = !isEmpty && !urlInvalid && status !== 'loading';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setError('');

    const source =
      tab === 'url'
        ? { type: 'url', url: url.trim(), text: '' }
        : { type: 'text', url: null, text: text.trim() };

    try {
      const project = await mockGenerate(source, mockFail);
      try {
        sessionStorage.setItem('draft', JSON.stringify(project));
      } catch {
        /* 저장 실패해도 이동은 진행 */
      }
      router.push('/script'); // 대본 확인 화면 (다음 작업)
    } catch (err) {
      setStatus('error');
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900">숏폼 영상 초안 만들기</h1>
        <p className="mt-2 text-sm text-gray-600">
          네이버 블로그 URL이나 본문을 넣으면 30~60초 숏폼 대본을 만들어 드립니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          {/* 탭 */}
          <div className="mb-4 flex gap-2" role="tablist">
            {[
              ['url', '블로그 URL'],
              ['text', '본문 직접 입력'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                disabled={status === 'loading'}
                onClick={() => {
                  setTab(key);
                  setStatus('idle');
                  setError('');
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  tab === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 입력 */}
          {tab === 'url' ? (
            <div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={status === 'loading'}
                placeholder="https://blog.naver.com/아이디/글번호"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
              {urlInvalid && (
                <p className="mt-2 text-sm text-red-600">
                  네이버 블로그 글 주소가 아닙니다. 주소창의 전체 URL을 넣어주세요. (naver.me 단축 링크는 지원하지 않습니다)
                </p>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={status === 'loading'}
                rows={10}
                placeholder="블로그 본문을 붙여넣으세요."
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
              <p className="mt-1 text-right text-xs text-gray-500">{text.length.toLocaleString()}자</p>
            </div>
          )}

          {/* 오류 상태 */}
          {status === 'error' && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              <p>{error}</p>
              {tab === 'url' && (
                <p className="mt-1">
                  비공개·삭제된 글일 수 있습니다.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('text');
                      setStatus('idle');
                      setError('');
                    }}
                    className="font-medium underline"
                  >
                    본문 직접 입력으로 전환
                  </button>
                </p>
              )}
            </div>
          )}

          {/* 제출 */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {status === 'loading' && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {status === 'loading'
              ? tab === 'url'
                ? '본문·이미지 불러오는 중…'
                : '대본 생성 중…'
              : status === 'error'
                ? '다시 시도'
                : '대본 생성'}
          </button>

          {/* 개발용: 목업 실패 토글 (배포 빌드에선 숨김) */}
          {process.env.NODE_ENV !== 'production' && (
            <label className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={mockFail} onChange={(e) => setMockFail(e.target.checked)} />
              [개발용] 목업 실패 응답
            </label>
          )}
        </form>
      </div>
    </main>
  );
}
