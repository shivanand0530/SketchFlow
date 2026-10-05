import { ArrowRight, Check, LayoutTemplate, MousePointer2, Shapes, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/components/UserProfile';
import { useAuth } from '@/auth/AuthContext';

const features = [
  { icon: MousePointer2, title: 'Think spatially', text: 'Sketch diagrams, flows, and rough ideas without fighting the tool.' },
  { icon: LayoutTemplate, title: 'Keep everything together', text: 'Bring shapes, notes, and visual context into one calm workspace.' },
  { icon: Sparkles, title: 'Move from rough to clear', text: 'Shape a first thought into something your team can understand.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f3] text-[#173b36]">
      <header className="relative z-10 border-b border-black/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => navigate('/')}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f5148] text-white"><Shapes className="h-4 w-4" /></span>
            SketchFlow
          </button>
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            {user ? <><Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate('/boards')}>Open workspace</Button><UserProfile /></> : <><Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log in</Button><Button size="sm" className="bg-[#1f5148] hover:bg-[#173b36] sm:h-10 sm:px-6" onClick={() => navigate('/register')}>Start sketching <ArrowRight className="ml-1 h-4 w-4 sm:ml-2" /></Button></>}
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[620px] max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-28">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#d46b45]"><span className="h-px w-8 bg-[#d46b45]" />Visual thinking, made tangible</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#173b36] sm:text-7xl">Make the shape of an idea visible.</h1>
          <p className="mt-8 max-w-lg text-lg leading-8 text-[#53645f]">SketchFlow is a focused canvas for mapping ideas, planning systems, and turning a blank page into shared understanding.</p>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center"><Button size="lg" className="bg-[#1f5148] px-6 hover:bg-[#173b36]" onClick={() => navigate(user ? '/boards' : '/register')}>{user ? 'Open your workspace' : 'Create your free workspace'} <ArrowRight className="ml-2 h-4 w-4" /></Button><span className="flex items-center gap-2 text-sm text-[#53645f]"><Check className="h-4 w-4 text-[#d46b45]" />No clutter. Just room to think.</span></div>
        </div>
        <div className="relative min-h-[300px] sm:min-h-[360px] lg:min-h-[440px]">
          <div className="absolute inset-6 rotate-2 rounded-[2rem] border border-[#1f5148]/20 bg-[#e4ebe3] shadow-[18px_20px_0_#d7dfd7]" />
          <div className="absolute inset-0 rounded-[2rem] border border-black/10 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-black/10 pb-4"><div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-[#d46b45]" />Untitled exploration</div><span className="text-xs text-[#71827d]">Canvas</span></div>
            <div className="relative h-[240px] sm:h-[300px] overflow-hidden bg-[linear-gradient(#e5ebe6_1px,transparent_1px),linear-gradient(90deg,#e5ebe6_1px,transparent_1px)] bg-[size:28px_28px]"><div className="absolute left-[16%] top-[22%] h-16 w-24 rounded-xl border-2 border-[#1f5148] bg-[#dfece5] sm:h-20 sm:w-32" /><div className="absolute right-[14%] top-[42%] h-20 w-20 rounded-full border-2 border-[#d46b45] bg-[#f7e5db] sm:h-24 sm:w-24" /><div className="absolute left-[34%] top-[59%] h-14 w-32 -rotate-3 rounded-lg border-2 border-[#53645f] bg-[#f5f0df] sm:h-16 sm:w-44" /><div className="absolute left-[44%] top-[36%] h-20 w-px rotate-[48deg] bg-[#1f5148] sm:h-24" /><div className="absolute left-[47%] top-[48%] h-px w-16 rotate-[12deg] bg-[#1f5148] sm:w-24" /><div className="absolute bottom-4 right-4 rounded-full bg-[#1f5148] p-3 text-white"><MousePointer2 className="h-4 w-4" /></div></div>
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 bg-[#e9eee8] px-6 py-20"><div className="mx-auto max-w-6xl"><div className="mb-12 max-w-xl"><p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d46b45]">A quieter canvas</p><h2 className="text-4xl font-semibold tracking-tight">The useful parts are already here.</h2></div><div className="grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-black/10 bg-[#f7f8f3] p-6"><Icon className="mb-10 h-5 w-5 text-[#d46b45]" /><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-[#53645f]">{text}</p></article>)}</div></div></section>
      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-[#71827d]"><span>SketchFlow</span><span>Make room for the next good idea.</span></footer>
    </main>
  );
}
