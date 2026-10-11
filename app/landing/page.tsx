import { ArrowRight, Check, LockKeyhole, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

const capabilities = [
  { icon: Sparkles, title: "Think with clarity", detail: "Turn scattered thoughts into useful direction." },
  { icon: Zap, title: "Move with momentum", detail: "Plan, write, build, and solve in one focused space." },
  { icon: LockKeyhole, title: "Your space, your choice", detail: "Sign in for saved history or start a temporary guest session." },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link href="/" className="landing-logo"><span className="landing-logo-mark">T</span><span>TIWAT<span className="landing-dot">.</span></span></Link>
        <div className="landing-nav-actions"><Link href="/login" className="landing-signin">Sign in</Link><Link href="/login?mode=signup" className="landing-nav-cta">Get started <ArrowRight size={15} /></Link></div>
      </nav>
      <section className="landing-hero">
        <div className="landing-eyebrow"><span /> PERSONAL AI WORKSPACE</div>
        <h1>Make room for<br /><span>better thinking.</span></h1>
        <p className="landing-subtitle">A focused AI workspace to explore ideas, solve problems, and turn your next move into real progress.</p>
        <div className="landing-cta-row">
          <Link href="/login?mode=signup" className="landing-primary">Create your account <ArrowRight size={17} /></Link>
          <Link href="/chat?guest=1" className="landing-secondary">Try as guest <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="landing-microcopy"><Check size={13} /> Start in seconds <span>·</span> Guest chats are temporary</p>
        <div className="landing-product-preview" aria-label="TIWAT workspace preview">
          <div className="preview-window">
            <div className="preview-top"><div className="preview-window-dots"><i /><i /><i /></div><span>TIWAT WORKSPACE</span><span className="preview-live"><i /> READY TO THINK</span></div>
            <div className="preview-body">
              <aside className="preview-sidebar"><div className="preview-brand"><span className="preview-brand-icon"><Sparkles size={15}/></span> TIWAT</div><div className="preview-nav-active">＋ <span>New conversation</span></div><div className="preview-nav-muted">◷ <span>Recent conversations</span></div><div className="preview-sidebar-bottom">A clear space to begin.</div></aside>
              <div className="preview-chat"><div className="preview-glow"><Sparkles size={20}/></div><div className="preview-kicker">YOUR THINKING SPACE</div><h3>What will you figure out<br/>today?</h3><p>Bring the question. Leave with a direction.</p><div className="preview-prompts"><span>✳ Plan an ambitious goal</span><span>⌘ Build or debug code</span><span>↗ Explore a new idea</span></div><div className="preview-input"><span>Message TIWAT…</span><i><ArrowRight size={14}/></i></div></div>
            </div>
          </div>
        </div>
      </section>
      <section className="landing-features"><div className="landing-section-label">MADE FOR YOUR MOMENTUM</div><div className="landing-feature-grid">{capabilities.map(({icon: Icon,title,detail}) => <article className="landing-feature" key={title}><div className="landing-feature-icon"><Icon size={18}/></div><h2>{title}</h2><p>{detail}</p></article>)}</div></section>
      <footer className="landing-footer"><Link href="/" className="landing-logo"><span className="landing-logo-mark">T</span><span>TIWAT<span className="landing-dot">.</span></span></Link><span>Think clearly. Move faster.</span><Link href="/login">Enter your workspace <ArrowRight size={13}/></Link></footer>
    </main>
  );
}
