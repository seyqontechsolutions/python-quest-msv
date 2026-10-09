import { Activity, ArrowLeft, Check, CircleAlert, Clock3, Code2, Pencil, RefreshCw, Save, ShieldAlert, Sparkles, Users, X, Zap } from 'lucide-react';
import { getGetTeacherDashboardQueryKey, useGetTeacherDashboard } from '../api-client-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';

function timeSince(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

function statusStyle(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('active')) return 'bg-primary text-foreground';
  if (normalized.includes('idle')) return 'bg-muted text-muted-foreground';
  return 'bg-secondary/25 text-foreground';
}

type StudentDataRecord = {
  id: number;
  name: string;
  grade: string;
  xp: number;
  level: number;
  lives: number;
  completedLevels: number[];
  lastSeenAt: string;
  status: string;
  tabSwitches: number;
  password: string | null;
  passwordSet: boolean;
};

export default function Teacher() {
  const [pin, setPin] = useState('');
  const [submittedPin, setSubmittedPin] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('6');
  const [rosterGradeFilter, setRosterGradeFilter] = useState('all');
  const [showStudentDataDialog, setShowStudentDataDialog] = useState(false);
  const [studentData, setStudentData] = useState<StudentDataRecord[]>([]);
  const [loadingStudentData, setLoadingStudentData] = useState(false);
  const [studentDataError, setStudentDataError] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useGetTeacherDashboard({
    query: { enabled: submittedPin.length > 0, retry: false, refetchInterval: 5000, queryKey: getGetTeacherDashboardQueryKey() },
    request: { headers: { 'x-teacher-pin': submittedPin } },
  });

  useEffect(() => {
    if (!showStudentDataDialog || !submittedPin) return;
    let current = true;
    setLoadingStudentData(true);
    setStudentDataError('');
    const loadStudentData = async () => {
      try {
        const response = await fetch(`/api/teacher/students/grade/${selectedGrade}`, { headers: { 'x-teacher-pin': submittedPin } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load student data.');
        if (current) {
          setStudentData(result as StudentDataRecord[]);
          setStudentDataError('');
        }
      } catch (cause) {
        if (current) setStudentDataError(cause instanceof Error ? cause.message : 'Could not load student data.');
      } finally {
        if (current) setLoadingStudentData(false);
      }
    };
    void loadStudentData();
    const interval = window.setInterval(() => { void loadStudentData(); }, 5000);
    return () => { current = false; window.clearInterval(interval); };
  }, [showStudentDataDialog, selectedGrade, submittedPin]);

  const visibleStudents = (data?.students ?? []).filter((student) => rosterGradeFilter === 'all' || student.grade === rosterGradeFilter);

  if (!submittedPin) return <TeacherGate pin={pin} setPin={setPin} onSubmit={() => setSubmittedPin(pin)} />;
  if (isLoading) return <TeacherSkeleton />;
  if (isError) return <TeacherGate pin={pin} setPin={setPin} onSubmit={() => { setSubmittedPin(''); setTimeout(() => setSubmittedPin(pin), 0); }} invalid />;

  function editStudent(student: StudentDataRecord) {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setNewPassword('');
    setEditError('');
  }

  async function saveStudent(studentId: number) {
    setSavingStudent(true);
    setEditError('');
    try {
      const response = await fetch(`/api/teacher/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-teacher-pin': submittedPin },
        body: JSON.stringify({ name: editName, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not update this student.');
      setStudentData((records) => records.map((record) => record.id === studentId ? { ...record, name: editName.trim(), password: newPassword || record.password, passwordSet: result.passwordSet ?? record.passwordSet } : record));
      setEditingStudentId(null);
      setNewPassword('');
      await refetch();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Could not update this student.');
    } finally {
      setSavingStudent(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-foreground text-background">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-5 sm:px-10 lg:px-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-foreground transition hover:bg-secondary" data-testid="link-teacher-home"><Code2 size={21} /></Link>
            <div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-background/55">Classroom command</p><h1 className="text-lg font-extrabold sm:text-xl">Teacher dashboard</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono-ui text-[10px] uppercase tracking-[.16em] text-background/50 sm:inline">Grade XI · Informatics Practices</span>
            <button type="button" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-dashboard" className="grid h-10 w-10 place-items-center rounded-xl border border-background/25 text-background transition hover:bg-background/10 disabled:opacity-50"><RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} /></button>
          </div>
        </div>
      </header>

      <div className="quest-grid min-h-[calc(100dvh-81px)]">
        <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
          <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <Link href="/" className="mb-4 inline-flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground transition hover:text-foreground" data-testid="link-back-to-start"><ArrowLeft size={13} /> Student start</Link>
              <h2 className="text-4xl font-extrabold tracking-[-.05em] sm:text-6xl">See the room<br /><span className="text-secondary">come alive.</span></h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">A quick read on who is coding, who is close to a milestone, and where a focus check might be useful.</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button type="button" onClick={() => setShowStudentDataDialog(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-primary px-5 py-4 text-sm font-bold ink-shadow-sm transition hover:-translate-y-0.5 hover:bg-secondary" data-testid="button-open-student-data"><Users size={17} />Student Data</button>
              <div className="rounded-2xl border-2 border-foreground bg-card px-5 py-4 ink-shadow-sm"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Quest pulse</p><p className="mt-1 text-sm font-bold"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />Live classroom data</p></div>
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Users size={18} />} label="Quest members" value={data?.totalStudents ?? 0} detail={`${data?.activeToday ?? 0} active today`} tone="primary" testId="stat-total-students" />
            <StatCard icon={<Activity size={18} />} label="Active today" value={data?.activeToday ?? 0} detail="students in motion" tone="aqua" testId="stat-active-today" />
            <StatCard icon={<Check size={18} />} label="Quest complete" value={data?.completedQuest ?? 0} detail="all 10 missions" tone="orange" testId="stat-completed-quest" />
            <StatCard icon={<Zap size={18} />} label="Average XP" value={data?.averageXp ?? 0} detail="across the room" tone="ink" testId="stat-average-xp" />
          </section>

          <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_350px]">
            <section className="overflow-hidden rounded-2xl border-2 border-foreground bg-card ink-shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground px-5 py-5 sm:px-6">
                <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Roster intelligence</p><h3 className="mt-1 text-xl font-extrabold">Student progress</h3></div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="roster-grade-filter" className="sr-only">Filter student records by grade</label>
                  <select id="roster-grade-filter" value={rosterGradeFilter} onChange={(event) => setRosterGradeFilter(event.target.value)} className="rounded-full border border-foreground/20 bg-background px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wider text-foreground outline-none focus:ring-2 focus:ring-primary" data-testid="select-roster-grade-filter">
                    <option value="all">All grades</option>
                    {['6', '7', '8', '9', '10', '11', '12'].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
                  </select>
                  <span className="rounded-full border border-foreground/20 bg-background px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wider">{visibleStudents.length} records</span>
                </div>
              </div>
              {visibleStudents.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                     <thead><tr className="border-b border-border font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground"><th className="px-6 py-4 font-medium">Student</th><th className="px-4 py-4 font-medium">Class</th><th className="px-4 py-4 font-medium">Status</th><th className="px-4 py-4 font-medium">XP / level</th><th className="px-4 py-4 font-medium">Missions</th><th className="px-4 py-4 font-medium">Lives</th><th className="px-6 py-4 text-right font-medium">Focus checks</th></tr></thead>
                    <tbody>
                      {visibleStudents.map((student) => {
                        const completedPercent = Math.min(100, (student.completedLevels / 10) * 100);
                        return <tr key={student.id} className="group border-b border-border/70 transition last:border-0 hover:bg-background/70" data-testid={`row-student-${student.id}`}>
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-extrabold">{student.name.slice(0, 1).toUpperCase()}</span><div><p className="font-bold">{student.name}</p><p className="font-mono-ui text-[10px] text-muted-foreground">{timeSince(student.lastSeenAt)}</p></div></div></td>
                           <td className="px-4 py-4"><span className="rounded-full bg-primary/50 px-2.5 py-1 font-mono-ui text-[10px] font-medium">{student.grade === '11' ? '11th' : student.grade}</span></td>
                          <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-wider ${statusStyle(student.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{student.status}</span></td>
                          <td className="px-4 py-4"><p className="font-mono-ui text-xs font-medium">{student.xp} XP</p><p className="mt-1 text-xs text-muted-foreground">Level {student.level}</p></td>
                          <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${completedPercent}%` }} /></div><span className="font-mono-ui text-xs">{student.completedLevels}/10</span></div></td>
                          <td className="px-4 py-4"><div className="flex items-center gap-1.5 font-mono-ui text-xs"><span className={`h-2 w-2 rounded-full ${student.lives < 10 ? 'bg-secondary' : 'bg-primary'}`} />{student.lives}</div></td>
                          <td className="px-6 py-4 text-right">{student.tabSwitches > 0 ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/20 px-2.5 py-1.5 font-mono-ui text-[10px] font-medium text-foreground"><ShieldAlert size={13} />{student.tabSwitches}</span> : <span className="font-mono-ui text-xs text-muted-foreground">clear</span>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState />}
            </section>

            <section className="rounded-2xl border-2 border-foreground bg-foreground p-5 text-background sm:p-6">
              <div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-background/55">Live feed</p><h3 className="mt-1 text-xl font-extrabold">Recent activity</h3></div><Sparkles size={19} className="text-primary" /></div>
              {data?.recentActivity?.length ? <div className="mt-7 space-y-5">{data.recentActivity.slice(0, 8).map((item, index) => <div key={`${item.createdAt}-${index}`} className="flex gap-3" data-testid={`activity-item-${index}`}><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="text-sm leading-snug text-background/90"><strong className="text-background">{item.studentName}</strong> {item.event}</p><p className="mt-1 font-mono-ui text-[10px] text-background/45">Mission {String(item.levelId).padStart(2, '0')} · {timeSince(item.createdAt)}</p></div></div>)}</div> : <div className="mt-8 rounded-xl border border-background/15 p-4 text-sm text-background/60" data-testid="empty-activity">Activity will appear as students make their first moves.</div>}
              <div className="mt-8 border-t border-background/15 pt-5"><div className="flex items-center gap-2 text-xs text-background/60"><Clock3 size={14} /> Updated when you refresh</div></div>
            </section>
          </div>
        </div>
      </div>
      {showStudentDataDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/55 p-4" onClick={() => setShowStudentDataDialog(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="student-data-title" className="max-h-[90dvh] w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-foreground bg-background text-foreground shadow-2xl" onClick={(event) => event.stopPropagation()} data-testid="student-data-dialog">
            <div className="flex items-start justify-between gap-4 border-b-2 border-foreground bg-card px-5 py-4 sm:px-7">
              <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Teacher tools</p><h2 id="student-data-title" className="mt-1 text-2xl font-extrabold">Student Data</h2><p className="mt-1 text-sm text-muted-foreground">Choose a grade to view student profiles and account details.</p></div>
              <button type="button" onClick={() => setShowStudentDataDialog(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-foreground/20 transition hover:bg-primary" aria-label="Close Student Data dialog"><X size={17} /></button>
            </div>
            <div className="max-h-[calc(90dvh-100px)] space-y-4 overflow-y-auto p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <label htmlFor="student-data-grade" className="block w-full max-w-xs font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Filter by grade<select id="student-data-grade" value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setEditingStudentId(null); setEditError(''); }} className="mt-2 w-full rounded-xl border-2 border-foreground bg-card px-3 py-2.5 font-sans text-sm font-semibold normal-case tracking-normal text-foreground outline-none focus:ring-4 focus:ring-primary/40" data-testid="select-student-data-grade">{['6', '7', '8', '9', '10', '11', '12'].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
                <span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">{studentData.length} student{studentData.length === 1 ? '' : 's'} in grade {selectedGrade}</span>
              </div>
              {loadingStudentData && <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Loading Grade {selectedGrade}…</p>}
              {studentDataError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">{studentDataError}</p>}
              {!loadingStudentData && !studentDataError && studentData.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No students are registered in Grade {selectedGrade} yet.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {studentData.map((student) => (
                  <article key={student.id} className="rounded-xl border-2 border-foreground/15 bg-card p-4" data-testid={`student-profile-${student.id}`}>
                    {editingStudentId === student.id ? (
                      <div className="space-y-3">
                        <label className="block font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Student name<input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm normal-case tracking-normal text-foreground" /></label>
                        <label className="block font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Set new password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" placeholder="Leave blank to keep current" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm normal-case tracking-normal text-foreground" /></label>
                        {editError && <p className="text-xs font-semibold text-destructive">{editError}</p>}
                        <div className="flex gap-2"><button type="button" onClick={() => saveStudent(student.id)} disabled={savingStudent || !editName.trim() || (newPassword.length > 0 && newPassword.length < 6)} className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background disabled:opacity-50"><Save size={13} />{savingStudent ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => { setEditingStudentId(null); setEditError(''); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><X size={13} />Cancel</button></div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{student.name}</p><p className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Grade {student.grade} · {student.status}</p></div><button type="button" onClick={() => editStudent(student)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-foreground/20 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-primary" data-testid={`button-edit-student-${student.id}`}><Pencil size={12} />Edit</button></div>
                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]"><span className="text-muted-foreground">XP / level</span><span className="text-right font-semibold">{student.xp} XP · {student.level}</span><span className="text-muted-foreground">Missions complete</span><span className="text-right font-semibold">{student.completedLevels.length}/10</span><span className="text-muted-foreground">Lives</span><span className="text-right font-semibold">{student.lives}</span><span className="text-muted-foreground">Focus checks</span><span className="text-right font-semibold">{student.tabSwitches}</span><span className="text-muted-foreground">Last seen</span><span className="text-right font-semibold">{timeSince(student.lastSeenAt)}</span></div>
                        <div className="mt-3 rounded-lg border border-border bg-background p-3"><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Student password</p>{student.password ? <code className="mt-1 block break-all text-sm font-semibold">{student.password}</code> : <p className="mt-1 text-xs text-muted-foreground">Not available for this older account. Use Edit to set a new password.</p>}</div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function TeacherGate({ pin, setPin, onSubmit, invalid = false }: { pin: string; setPin: (value: string) => void; onSubmit: () => void; invalid?: boolean }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border-2 border-foreground bg-card p-7 ink-shadow sm:p-9">
        <div className="mb-7 flex items-center justify-between">
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-foreground"><Code2 size={21} /></Link>
          <ShieldAlert size={20} className="text-secondary" />
        </div>
        <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-muted-foreground">Teacher access</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Enter the classroom PIN</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The student view stays open without a login. This dashboard is only for the teacher.</p>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="mt-7">
          <label htmlFor="teacher-pin" className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">PIN</label>
          <input id="teacher-pin" type="password" inputMode="numeric" autoComplete="new-password" autoFocus value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 w-full rounded-xl border-2 border-foreground bg-background px-4 py-3 font-mono-ui text-lg tracking-[.4em] outline-none focus:ring-4 focus:ring-primary/40" placeholder="••••" data-testid="input-teacher-pin" />
          {invalid && <p className="mt-3 text-sm font-semibold text-destructive" data-testid="status-invalid-teacher-pin">That PIN is not correct.</p>}
          <button type="submit" disabled={pin.length !== 4} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 font-bold text-background transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-submit-teacher-pin">Open teacher dashboard <ArrowLeft className="rotate-180" size={16} /></button>
        </form>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, detail, tone, testId }: { icon: ReactNode; label: string; value: number; detail: string; tone: 'primary' | 'aqua' | 'orange' | 'ink'; testId: string }) {
  const toneClass = { primary: 'bg-primary', aqua: 'bg-accent/25', orange: 'bg-secondary/35', ink: 'bg-foreground text-background' }[tone];
  return <div className={`rounded-2xl border-2 border-foreground p-5 transition hover:-translate-y-1 ${toneClass}`} data-testid={testId}><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl border border-foreground/20">{icon}</span><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] opacity-60">01</span></div><p className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] opacity-65">{label}</p><p className="mt-1 text-4xl font-extrabold tracking-[-.05em]">{value}</p><p className="mt-1 text-xs font-medium opacity-70">{detail}</p></div>;
}

function EmptyState() {
  return <div className="m-6 rounded-2xl border-2 border-dashed border-border p-10 text-center" data-testid="empty-students"><Users className="mx-auto mb-3 text-muted-foreground" size={26} /><p className="font-bold">No students yet.</p><p className="mt-1 text-sm text-muted-foreground">The roster will fill in when students start their quest.</p></div>;
}

function TeacherSkeleton() {
  return <main className="min-h-[100dvh] bg-background p-6 sm:p-12"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-10 w-56 rounded-lg bg-muted" /><div className="mt-16 h-16 w-96 max-w-full rounded-lg bg-muted" /><div className="mt-10 grid gap-3 sm:grid-cols-4"><div className="h-36 rounded-2xl bg-muted" /><div className="h-36 rounded-2xl bg-muted" /><div className="h-36 rounded-2xl bg-muted" /><div className="h-36 rounded-2xl bg-muted" /></div><div className="mt-8 h-96 rounded-2xl bg-muted" /></div></main>;
}

function TeacherError({ onRetry }: { onRetry: () => void }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="max-w-md rounded-2xl border-2 border-foreground bg-card p-8 text-center ink-shadow"><CircleAlert className="mx-auto mb-4 text-secondary" size={32} /><h1 className="text-2xl font-extrabold">Dashboard data missed a beat.</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">The classroom feed is not available right now.</p><button type="button" onClick={onRetry} data-testid="button-retry-teacher" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background transition hover:bg-secondary hover:text-foreground">Try again <RefreshCw size={15} /></button></div></main>;
}
