import Link from 'next/link';

const linkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  padding: '0 24px',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
};

export default function PreviewPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#080d18',
        color: '#f3ead6',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section
        style={{
          width: 'min(100%, 560px)',
          padding: 'clamp(28px, 7vw, 56px)',
          border: '1px solid rgba(201, 153, 58, 0.28)',
          borderRadius: 20,
          background: 'linear-gradient(145deg, #101a2b, #0b1220)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.3)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 14px', color: '#c8993a', fontSize: 12, letterSpacing: '0.28em' }}>
          PREVIEW
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '0.12em' }}>
          紫微命盤
        </h1>
        <p style={{ margin: '16px 0 30px', color: '#aab4c5', fontSize: 15, lineHeight: 1.8 }}>
          開場動畫已移除。選擇下方連結即可直接瀏覽網站或開始排盤。
        </p>
        <nav aria-label="Preview 導覽" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          <Link href="/" style={{ ...linkStyle, background: '#c8993a', color: '#17120a' }}>
            進入首頁
          </Link>
          <Link href="/chart" style={{ ...linkStyle, border: '1px solid rgba(243, 234, 214, 0.3)', color: '#f3ead6' }}>
            直接排盤
          </Link>
        </nav>
      </section>
    </main>
  );
}
