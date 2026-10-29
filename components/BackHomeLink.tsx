import Link from 'next/link';

type BackHomeLinkProps = {
  className?: string;
};

export default function BackHomeLink({ className = '' }: BackHomeLinkProps) {
  const classes = ['back-home-link', className].filter(Boolean).join(' ');

  return (
    <Link href="/" aria-label="返回首頁" title="返回首頁" className={classes}>
      <span aria-hidden="true">←</span>
      <span>返回首頁</span>
    </Link>
  );
}
