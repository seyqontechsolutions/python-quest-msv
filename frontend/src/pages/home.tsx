import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Code2, Sparkles, Users } from 'lucide-react';
import { getGetStudentRosterQueryKey, useCreateStudent, useGetStudentRoster } from '../api-client-react';
import { Link, useLocation } from 'wouter';

const ROSTER = ['Aadhi Kailash', 'Anirudh Ram', 'Ajay', 'Mehabob', 'Varshika'];
type GradeCode = '6' | '7' | '8' | '9' | '10' | '11' | '12';

export default function Home() {
  const [, setLocation] = useLocation();
  const [grade, setGrade] = useState<GradeCode | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [customName, setCustomName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const createStudent = useCreateStudent();
  const rosterCode: GradeCode = grade ?? '6';
  const rosterQuery = useGetStudentRoster(rosterCode, { query: { enabled: Boolean(grade), queryKey: getGetStudentRosterQueryKey(rosterCode) } });
  const roster = useMemo(() => {
    const savedNames = rosterQuery.data ?? [];
    if (grade === '11') return [...ROSTER, ...savedNames.filter((name) => !ROSTER.includes(name))];
    return savedNames;
  }, [grade, rosterQuery.data]);
  const activeName = showCustom ? customName.trim() : selectedName;

  function chooseGrade(nextGrade: GradeCode | null) {
    setGrade(nextGrade);
    setSelectedName('');
    setCustomName('');
    setPassword('');
    setAuthError('');
    setShowCustom(false);
  }

  function goBack() {
    chooseGrade(null);
    setSelectedName('');
    setShowCustom(false);
  }

  function startQuest() {
    if (!activeName || !grade || password.length < 6) return;
    setAuthError('');
    createStudent.mutate(
      { data: { name: activeName, grade: rosterCode, password } },
      {
        onSuccess: (student) => {
          window.localStorage.setItem('pythonQuestStudentId', String(student.id));
          setLocation('/play');
        },
        onError: (cause) => setAuthError(cause instanceof Error ? cause.message : 'Could not open the student account.'),
      },
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="relative min-h-[100dvh]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[28px] border-secondary/50 sm:h-96 sm:w-96" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-primary/55 sm:h-96 sm:w-96" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center gap-3" data-testid="link-home-logo">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-primary ink-shadow-sm">
              <Code2 size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Python classroom</p>
              <p className="text-lg font-extrabold tracking-tight">Python Quest</p>
            </div>
          </Link>
          <Link href="/teacher" className="hidden items-center gap-2 rounded-full border border-foreground/20 px-4 py-2 text-sm font-semibold transition hover:bg-foreground hover:text-background sm:flex" data-testid="link-teacher-dashboard">
            <Users size={15} />
            Teacher view
          </Link>
        </header>

        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-14 pt-8 sm:px-10 sm:pb-20 lg:grid-cols-[1.1fr_.9fr] lg:px-16 lg:pt-14">
          <div className="animate-rise">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-card px-3 py-1.5 font-mono-ui text-[11px] font-medium uppercase tracking-[0.18em] ink-shadow-sm">
              <Sparkles size={13} className="text-secondary" />
              10 missions. One Python brain.
            </div>
            <h1 className="max-w-3xl text-balance text-[clamp(3.4rem,9vw,7.8rem)] font-extrabold leading-[.86] tracking-[-.07em]">
              Build your
              <span className="relative mx-2 inline-block whitespace-nowrap text-secondary">
                Python
                <span className="absolute -bottom-1 left-1 right-0 h-2 -rotate-2 bg-primary" />
              </span>
              instincts.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              A focused coding adventure for the ideas that matter. Pick a mission, write the code, see the result, and keep moving.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6 font-mono-ui text-xs uppercase tracking-[.16em] text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> live progress</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-secondary" /> 30 lives per level</span>
            </div>
          </div>

          <div className="relative animate-rise [animation-delay:120ms]">
            <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-secondary/25" />
            <div className="relative overflow-hidden rounded-[1.65rem] border-2 border-foreground bg-card p-6 ink-shadow sm:p-8">
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Player checkpoint</p>
                      <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                        {!grade ? 'Choose your grade' : 'Who is coding?'}
                      </h2>
                    </div>
                    {grade && <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground transition hover:bg-muted hover:text-foreground" data-testid="button-back-grade"><ArrowLeft size={13} /> Back</button>}
                  </div>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary">
                  <BookOpen size={20} />
                </div>
              </div>
              {!grade && (
                <label className="grid gap-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                  Grade
                  <select
                    value={grade ?? ''}
                    onChange={(event) => chooseGrade((event.target.value || null) as GradeCode | null)}
                    className="w-full rounded-xl border-2 border-foreground bg-background px-4 py-3 font-sans text-sm font-semibold normal-case tracking-normal text-foreground outline-none ring-primary transition focus:ring-4"
                    data-testid="select-grade"
                  >
                    <option value="">Select your grade</option>
                    {(['6', '7', '8', '9', '10', '11', '12'] as const).map((value) => (
                      <option key={value} value={value}>Grade {value}</option>
                    ))}
                  </select>
                </label>
              )}
              {grade && (
                <>
                <p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Grade {grade}</p>
                <div className="grid grid-cols-2 gap-2.5">
                {roster.map((name) => (
                  <button
                    key={name}
                    type="button"
                    data-testid={`button-roster-${name.toLowerCase()}`}
                    onClick={() => { setSelectedName(name); setShowCustom(false); setPassword(''); setAuthError(''); }}
                    className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      !showCustom && selectedName === name ? 'border-foreground bg-primary ink-shadow-sm' : 'border-border bg-background hover:-translate-y-0.5 hover:border-foreground'
                    }`}
                  >
                    {name}
                    {!showCustom && selectedName === name ? <Check size={16} /> : <span className="h-2 w-2 rounded-full bg-muted group-hover:bg-secondary" />}
                  </button>
                ))}
                </div>
              <button
                type="button"
                data-testid="button-custom-name"
                onClick={() => { setShowCustom(true); setSelectedName(''); setPassword(''); setAuthError(''); }}
                className={`mt-2.5 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  showCustom ? 'border-foreground bg-primary ink-shadow-sm' : 'border-border bg-background hover:border-foreground'
                }`}
              >
                Someone else
                {showCustom ? <Check size={16} /> : <span className="font-mono-ui text-xs text-muted-foreground">type a name</span>}
              </button>
              {showCustom && (
                <input
                  autoFocus
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') startQuest(); }}
                  data-testid="input-custom-name"
                  maxLength={80}
                  placeholder="Your first name"
                  className="mt-3 w-full rounded-xl border-2 border-foreground bg-background px-4 py-3 text-sm outline-none ring-primary transition focus:ring-4"
                />
              )}
              {activeName && (
                <label htmlFor="student-password" className="mt-4 block font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                  Student password
                  <input
                    id="student-password"
                    type="password"
                    autoComplete={showCustom ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    maxLength={128}
                    onKeyDown={(event) => { if (event.key === 'Enter') startQuest(); }}
                    data-testid="input-student-password"
                    placeholder="At least 6 characters"
                    className="mt-2 w-full rounded-xl border-2 border-foreground bg-background px-4 py-3 font-sans text-sm normal-case tracking-normal text-foreground outline-none ring-primary transition focus:ring-4"
                  />
                </label>
              )}
              <button
                type="button"
                data-testid="button-start-quest"
                onClick={startQuest}
                disabled={!activeName || password.length < 6 || createStudent.isPending}
                className="mt-6 flex w-full items-center justify-between rounded-xl border-2 border-foreground bg-foreground px-5 py-4 text-left text-sm font-bold text-background transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{createStudent.isPending ? 'Opening your quest...' : showCustom ? 'Create / resume account' : 'Sign in / resume quest'}</span>
                <ArrowRight size={18} />
              </button>
              {authError && <p className="mt-3 text-sm font-semibold text-destructive" data-testid="status-start-error">{authError}</p>}
              <p className="mt-4 text-center font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Progress follows your name and password</p>
              </>
              )}
            </div>
          </div>
        </section>
        <footer className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 pb-8 font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground sm:px-10 lg:px-16">
          <span>Made for curious minds</span>
          <span>Write it. Run it. Remember it.</span>
        </footer>
      </div>
    </main>
  );
}
