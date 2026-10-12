import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Code2, Flag, Heart, LockKeyhole, Play as PlayIcon, RotateCcw, Terminal, Trophy, X } from 'lucide-react';
import { getGetStudentQueryKey, useGetGameLevels, useGetStudent, useRecordStudentAttempt, useSaveStudentProgress, useSubmitChallenge } from '../api-client-react';
import type { RunCodeResult } from '../api-client-react';
import { Link, useLocation } from 'wouter';
import { apiUrl } from '../lib/api-url';

const LESSONS: Record<number, { title: string; body: string; example: string; exampleoutput: string }> = {
  1: {
    title: 'Learn: print() displays text',
    body: 'The print() statement displays text on the screen. Put text inside quotation marks. Each print() call starts a new line; use the escape sequence \\n to print multiple lines in one statement.',
    example: 'print("Hello, Python!")',
    exampleoutput: 'Hello, Python!',
  },
  2: {
    title: 'Learn: input becomes text',
    body: 'input() reads text from the keyboard. Wrap it in int() when you need a whole number. The % operator gives the remainder, which is perfect for even and odd checks.',
    example: 'number = int(input("Number: "))\nif number % 2 == 0:\n    print("Even")',
    exampleoutput: '',
  },
  3: {
    title: 'Learn: repeat with a range',
    body: 'A for loop repeats an indented block. range(1, 4) produces 1, 2, 3 because the stop value is not included. end=" " keeps output on one line.',
    example: 'for i in range(1, 4):\n    print(i, end=" ")',
    exampleoutput: 'the generated sequence',
  },
  4: {
    title: 'Learn: strings are sequences',
    body: 'String positions start at 0. A slice text[2:5] starts at 2 and stops before 5. Negative indexes count from the end.',
    example: 'word = "PYTHON"\nprint(word[2:5])\nprint(word[-1])',
    exampleoutput: 'a slice of the word\nthe final character',
  },
  5: {
    title: 'Learn: lists can change',
    body: 'Lists keep ordered values. append() adds at the end, insert(index, value) adds at a position, and extend() adds several values.',
    example: 'skills = ["print", "if"]\nskills.append("loop")\nskills.insert(1, "list")\nprint(skills)\nprint(len(skills))',
    exampleoutput: 'the changed list\nits length',
  },
  6: {
    title: 'Learn: choose a branch',
    body: 'if checks the first condition, elif checks another, and else catches everything remaining. This is how a program chooses the largest of three numbers.',
    example: 'a, b, c = 12, 7, 9\nif a > b and a > c:\n    largest = a\nelif b > c:\n    largest = b\nelse:\n    largest = c\nprint(largest)',
    exampleoutput: 'the selected comparison result',
  },
  7: {
    title: 'Learn: dictionaries use keys',
    body: 'A dictionary stores key:value pairs inside { }. Use d[key] or d.get(key) to read a value. keys(), values(), and items() help you inspect the record.',
    example: 'student = {"name": "Ravi", "mark": 90}\nprint(student.get("mark"))\nstudent["city"] = "Chennai"\nprint(student.keys())',
    exampleoutput: 'a value read by key\nthe dictionary view',
  },
  8: {
    title: 'Learn: build a result list',
    body: 'A loop can inspect every item and append matching values to a new list. Start a running answer such as largest with the first item, then compare each next value.',
    example: 'numbers = [3, 8, 5, 10]\neven = []\nfor value in numbers:\n    if value % 2 == 0:\n        even.append(value)\nprint(even)',
    exampleoutput: 'the values that match the condition',
  },
  9: {
    title: 'Learn: lists can contain lists',
    body: 'Nested data uses one index after another: matrix[1][2]. To remove duplicates while keeping order, scan left to right and append only values you have not seen.',
    example: 'values = [3, 3, 1, 2, 1]\nseen = []\nfor value in values:\n    if value not in seen:\n        seen.append(value)\nprint(seen)',
    exampleoutput: 'the first occurrence of each value',
  },
  10: {
    title: 'Learn: combine the tools',
    body: 'Exam programs are built from small moves: input, store, loop through records, update a dictionary, and maintain totals or the highest mark.',
    example: 'students = {"Asha": 80, "Bala": 92, "Chetan": 76}\ntotal = 0\nfor name in students:\n    total += students[name]\naverage = total / len(students)\nprint(total)\nprint(average)',
    exampleoutput: 'the total\nthe average',
  },
};

const MISSION_PROMPTS: Record<number, string> = {
  1: 'Use print() statements to answer the five printing questions in order. No input is needed.',
  2: 'Read one integer and print exactly "Divisible by 3" or "Not divisible by 3".',
  3: 'Read a start integer and a stop integer. Print every integer from start through stop, one per line.',
  4: 'Read one word. Print the word without its first and last character, then print its final character.',
  5: 'Read three words on one line. Add "added" at the end, insert "inserted" at index 1, then print the list and its length.',
  6: 'Read three different integers from separate lines. Use if-elif-else to print the smallest.',
  7: 'Read a student name and mark. Store them in a dictionary and print the mark using get().',
  8: 'Read a space-separated list of integers. Build and print the even list, then the odd list.',
  9: 'Read a space-separated list with repeated values. Print each value once while preserving first-seen order.',
  10: 'Read three student name-and-mark pairs. Print the total, average, and highest student as name - mark.',
};

type LeaderboardEntry = { rank: number; name: string; xp: number; level: number; completedLevels: number };
type PrintChallenge = { questions: Array<{ id: number; prompt: string }> };
type StoredStudentAttempt = { questionId: string; correct: boolean; answer?: string; createdAt: string };

function promptForLevel(id: number) {
  return MISSION_PROMPTS[id] ?? 'Write a short Python example that demonstrates this mission.';
}

function formatTime(value?: string) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function Play() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [printQuestionIndex, setPrintQuestionIndex] = useState(0);
  const [printAnswers, setPrintAnswers] = useState<Record<number, string>>({});
  const [printSolved, setPrintSolved] = useState<boolean[]>([false, false, false, false, false]);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [lessonRead, setLessonRead] = useState(false);
  const [codeOutput, setCodeOutput] = useState<RunCodeResult | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [livesByLevel, setLivesByLevel] = useState<Record<number, number>>({});
  const [showMap, setShowMap] = useState(true);
  const initialized = useRef(false);
  const { data: levels, isLoading: levelsLoading, isError: levelsError } = useGetGameLevels();

  useEffect(() => {
    const savedId = Number(window.localStorage.getItem('pythonQuestStudentId') || 0);
    if (!savedId) setLocation('/');
    setStudentId(savedId);
  }, [setLocation]);

  const { data: student, isLoading: studentLoading, isError: studentError } = useGetStudent(studentId, {
    query: { enabled: studentId > 0, queryKey: getGetStudentQueryKey(studentId) },
  });
  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard', student?.grade],
    enabled: Boolean(student?.grade),
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/leaderboard?grade=${encodeURIComponent(student!.grade)}`));
      if (!response.ok) throw new Error('Could not load the grade leaderboard.');
      return response.json() as Promise<LeaderboardEntry[]>;
    },
  });
  const { data: printChallenge, isLoading: printChallengeLoading, isError: printChallengeError } = useQuery<PrintChallenge>({
    queryKey: ['/api/game/print-challenge', studentId],
    enabled: studentId > 0 && activeId === 1,
    queryFn: async () => {
      const response = await fetch(apiUrl('/api/game/print-challenge'));
      if (!response.ok) throw new Error('Could not load the print questions.');
      return response.json() as Promise<PrintChallenge>;
    },
  });
  const { data: studentAttempts } = useQuery<StoredStudentAttempt[]>({
    queryKey: ['/api/students', studentId, 'attempts'],
    enabled: studentId > 0,
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/students/${studentId}/attempts`));
      if (!response.ok) throw new Error('Could not load saved question progress.');
      return response.json() as Promise<StoredStudentAttempt[]>;
    },
  });
  const saveProgress = useSaveStudentProgress();
  const recordAttempt = useRecordStudentAttempt();
  const submitChallenge = useSubmitChallenge();
  const orderedLevels = useMemo(() => [...(levels ?? [])].sort((a, b) => a.id - b.id), [levels]);

  useEffect(() => {
    if (!orderedLevels.length || initialized.current) return;
    const next = orderedLevels.find((level) => !(student?.completedLevels ?? []).includes(level.id)) ?? orderedLevels[0];
    setActiveId(next.id);
    initialized.current = true;
  }, [orderedLevels, student?.completedLevels]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) setTabSwitches((count) => count + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const activeLevel = orderedLevels.find((level) => level.id === activeId) ?? orderedLevels[0];
  const currentPrintQuestion = printChallenge?.questions[printQuestionIndex];
  const allPrintQuestionsSolved = printSolved.every(Boolean);

  useEffect(() => {
    if (!studentAttempts) return;
    const restoredSolved = [false, false, false, false, false];
    const restoredAnswers: Record<number, string> = {};
    for (const attempt of studentAttempts) {
      const match = attempt.questionId.match(/^mission-1-print-v2-question-(\d+)$/);
      if (!match || !attempt.correct) continue;
      const index = Number(match[1]) - 1;
      if (index < 0 || index >= restoredSolved.length) continue;
      restoredSolved[index] = true;
      if (!(index in restoredAnswers) && attempt.answer) restoredAnswers[index] = attempt.answer;
    }
    setPrintSolved((current) => current.map((solved, index) => solved || restoredSolved[index]));
    setPrintAnswers((current) => ({ ...restoredAnswers, ...current }));
  }, [studentAttempts]);

  useEffect(() => {
    if (activeLevel?.id === 1 && !answer && printAnswers[printQuestionIndex]) {
      setAnswer(printAnswers[printQuestionIndex]);
    }
  }, [activeLevel?.id, answer, printAnswers, printQuestionIndex]);
  const completed = activeLevel ? (student?.completedLevels ?? []).includes(activeLevel.id) : false;
  const currentLives = activeLevel ? (livesByLevel[activeLevel.id] ?? 30) : 30;
  const progressPercent = orderedLevels.length ? Math.min(100, (((student?.completedLevels?.length ?? 0) / orderedLevels.length) * 100)) : 0;

  function chooseLevel(id: number) {
    setActiveId(id);
    setFeedback('idle');
    setAnswer('');
    setLessonRead(false);
    setCodeOutput(null);
    if (window.innerWidth < 1024) setShowMap(false);
  }

  function choosePrintQuestion(index: number) {
    if (index < 0 || index >= (printChallenge?.questions.length ?? 0) || submitChallenge.isPending) return;
    setPrintAnswers((current) => ({ ...current, [printQuestionIndex]: answer }));
    setPrintQuestionIndex(index);
    setAnswer(printAnswers[index] ?? '');
    setCodeOutput(null);
    setFeedback('idle');
  }

  async function submitAnswer() {
    if (!activeLevel || !studentId || !answer.trim() || recordAttempt.isPending || submitChallenge.isPending) return;
    if (activeLevel.id === 1 && !printChallenge) return;
    let execution: RunCodeResult;
    try {
      const challengeData = activeLevel.id === 1
        ? { code: answer, questionId: currentPrintQuestion?.id }
        : { code: answer };
      execution = await submitChallenge.mutateAsync({
        challengeId: activeLevel.id,
        data: challengeData,
      });
    } catch {
      execution = {
        success: false,
        correct: false,
        output: '',
        error: 'Code execution service is temporarily unavailable. Please try again.',
        sampleInput: '',
        passedTests: 0,
        totalTests: 0,
        message: 'The execution service could not validate this submission.',
        status: 'service_unavailable',
      };
    }
    setCodeOutput(execution);
    const isCorrect = execution.correct;
    const nextPrintSolved = activeLevel.id === 1
      ? printSolved.map((solved, index) => solved || (index === printQuestionIndex && isCorrect))
      : printSolved;
    const missionPassed = activeLevel.id === 1 ? nextPrintSolved.every(Boolean) : isCorrect;
    if (activeLevel.id === 1 && isCorrect) setPrintSolved(nextPrintSolved);
    const livesRemaining = isCorrect ? currentLives : Math.max(0, currentLives - 1);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setLivesByLevel((current) => ({ ...current, [activeLevel.id]: livesRemaining }));
    recordAttempt.mutate({
      studentId,
      data: {
        levelId: activeLevel.id,
        questionId: activeLevel.id === 1 ? `mission-1-print-v2-question-${printQuestionIndex + 1}` : `mission-${activeLevel.id}-practice`,
        correct: isCorrect,
        answer,
        tabSwitchDetected: tabSwitches > 0,
      },
    }, {
      onSuccess: (attempt) => {
        const attemptsKey = ['/api/students', studentId, 'attempts'];
        queryClient.setQueryData<StoredStudentAttempt[]>(attemptsKey, (current) => [attempt, ...(current ?? [])]);
      },
    });
    saveProgress.mutate(
      {
        studentId,
        data: {
          levelId: activeLevel.id,
          xpEarned: missionPassed ? activeLevel.xp : 0,
          livesRemaining,
          completed: missionPassed,
          tabSwitches,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
        },
      },
    );
  }

  if (levelsLoading || (studentId > 0 && studentLoading)) return <PlaySkeleton />;
  if (levelsError || studentError) return <ErrorPanel onRetry={() => window.location.reload()} />;
  if (!studentId) return null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 shrink-0 border-b-2 border-foreground bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-7">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" data-testid="link-play-logo">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-foreground text-primary"><Code2 size={19} /></div>
            <span className="hidden text-base font-extrabold sm:inline">Python Quest</span>
          </Link>
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 sm:flex">
            <span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Quest progress</span>
            <div className="h-2 w-44 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} /></div>
            <span className="font-mono-ui text-xs font-medium">{student?.completedLevels?.length ?? 0}/{orderedLevels.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-foreground/20 bg-card px-3 py-1.5" data-testid="status-lives">
              <Heart size={14} className="fill-secondary text-secondary" />
              <span className="font-mono-ui text-xs font-medium">{currentLives}<span className="hidden text-muted-foreground sm:inline"> lives</span></span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-foreground/20 bg-primary px-3 py-1.5 sm:flex" data-testid="status-xp">
              <Trophy size={14} />
              <span className="font-mono-ui text-xs font-medium">{student?.xp ?? 0} XP</span>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-extrabold" data-testid="text-student-initials">{student?.name?.slice(0, 1).toUpperCase()}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 gap-0 overflow-hidden lg:gap-8">
        <aside className={`${showMap ? 'block' : 'hidden'} h-full min-h-0 w-full shrink-0 overflow-y-auto overscroll-contain border-r-0 border-foreground/15 px-4 py-6 pb-24 sm:px-7 lg:block lg:w-[370px] lg:border-r-2 lg:py-9 lg:pb-28`}>
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-muted-foreground">Mission map</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight">The Python trail</h1>
            </div>
            <span className="rounded-full bg-primary px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-wider">{student?.streak ?? 0} day streak</span>
          </div>
          {orderedLevels.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="empty-levels">No missions are waiting yet.</div>
          ) : (
            <div className="relative space-y-3">
              <div className="absolute bottom-8 left-[22px] top-8 w-px border-l border-dashed border-foreground/30" />
              {orderedLevels.map((level, index) => {
                const isComplete = (student?.completedLevels ?? []).includes(level.id);
                const isActive = activeLevel?.id === level.id;
                const locked = index > 0 && !(student?.completedLevels ?? []).includes(orderedLevels[index - 1].id) && !isActive;
                return (
                  <button
                    key={level.id}
                    type="button"
                    disabled={locked}
                    onClick={() => chooseLevel(level.id)}
                    data-testid={`button-mission-${level.id}`}
                    className={`group relative flex w-full items-center gap-4 rounded-2xl border-2 p-3.5 text-left transition ${
                      isActive ? 'border-foreground bg-card ink-shadow-sm' : 'border-transparent hover:border-foreground/30'
                    } ${locked ? 'cursor-not-allowed opacity-45' : ''}`}
                  >
                    <span className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-foreground text-sm font-extrabold ${
                      isComplete ? 'bg-primary' : isActive ? 'bg-secondary' : 'bg-background'
                    }`}>
                      {isComplete ? <Check size={18} strokeWidth={3} /> : locked ? <LockKeyhole size={16} /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{level.title}</span>
                        {isActive && <ChevronRight size={15} />}
                      </span>
                      <span className="mt-1 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{level.chapter}</span><span className="h-1 w-1 rounded-full bg-secondary" /><span>{level.xp} XP</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-8 rounded-2xl bg-foreground p-5 text-background">
            <div className="flex items-center justify-between">
              <span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-background/60">Rank</span>
              <span className="font-mono-ui text-xs text-primary">LVL {student?.level ?? 1}</span>
            </div>
            <p className="mt-3 text-lg font-bold">Keep the streak alive.</p>
            <p className="mt-1 text-sm leading-relaxed text-background/60">Every correct attempt adds XP to your run.</p>
          </div>
          <div className="mt-4 rounded-2xl border-2 border-foreground bg-card p-5">
            <div className="flex items-center justify-between">
              <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Class leaderboard</p><p className="mt-1 text-lg font-extrabold">Who is ahead?</p></div>
              <Trophy size={18} className="text-secondary" />
            </div>
            {leaderboard?.length ? (
              <div className="mt-4 space-y-2">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.name} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${entry.name === student?.name ? 'bg-primary' : 'bg-background'}`} data-testid={`leaderboard-row-${entry.rank}`}>
                    <span className="w-5 font-mono-ui text-[10px] text-muted-foreground">#{entry.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{entry.name}</span>
                    <span className="font-mono-ui text-[10px] text-muted-foreground">{entry.xp} XP</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-muted-foreground">The leaderboard will appear after students start.</p>}
          </div>
        </aside>

        <section className={`${showMap ? 'hidden lg:block' : 'block'} h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 pb-24 sm:px-7 lg:py-9 lg:pb-28 lg:pr-10`}>
          <button type="button" onClick={() => setShowMap(true)} className="mb-6 flex items-center gap-2 text-sm font-semibold lg:hidden" data-testid="button-back-to-map"><ArrowLeft size={16} /> All missions</button>
          {!activeLevel ? (
            <div className="grid min-h-[50vh] place-items-center text-center" data-testid="empty-active-mission"><div><Flag className="mx-auto mb-4 text-secondary" size={30} /><p className="font-bold">Choose a mission to begin.</p></div></div>
          ) : (
            <div className="animate-rise">
              <div className="flex flex-wrap items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">
                <span>Mission {String(orderedLevels.findIndex((level) => level.id === activeLevel.id) + 1).padStart(2, '0')}</span>
                <span className="h-1 w-1 rounded-full bg-secondary" />
                <span>{activeLevel.chapter}</span>
                <span className="h-1 w-1 rounded-full bg-secondary" />
                <span>{activeLevel.difficulty}</span>
              </div>
              <div className="mt-5 flex flex-col justify-between gap-5 border-b-2 border-foreground pb-7 sm:flex-row sm:items-end">
                <div>
                  <h2 className="max-w-2xl text-4xl font-extrabold tracking-[-.045em] sm:text-6xl">{activeLevel.title}</h2>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{activeLevel.mission}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-3 py-2 ink-shadow-sm">
                  <Trophy size={17} />
                  <span className="font-mono-ui text-xs font-medium">+{activeLevel.xp} XP</span>
                </div>
              </div>

              <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_300px]">
                <div className="overflow-hidden rounded-2xl border-2 border-foreground bg-[#17203d] ink-shadow">
                  <div className="flex items-center justify-between border-b border-background/15 px-4 py-3">
                    <div className="flex items-center gap-2"><Terminal size={15} className="text-primary" /><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-background/60">Practice console</span></div>
                    <span className="font-mono-ui text-[10px] text-background/45">python3</span>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="mb-5 rounded-xl border border-primary/25 bg-primary/10 p-4">
                      <div className="flex items-start gap-3">
                        <BookOpen size={16} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">{LESSONS[activeLevel.id]?.title}</p>
                          <p className="mt-2 text-sm leading-relaxed text-background/80">{LESSONS[activeLevel.id]?.body}</p>
                          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#11182e] p-3 font-mono-ui text-xs leading-6 text-primary">{LESSONS[activeLevel.id]?.example}</pre>
                           <div className="mt-3 border-t border-primary/20 pt-3">
                             <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary">Output shape</p>
                             <pre className="mt-2 overflow-x-auto rounded-lg bg-[#11182e] p-3 font-mono-ui text-xs leading-6 text-background/75">{LESSONS[activeLevel.id]?.exampleoutput}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                    {!lessonRead ? (
                      <div className="rounded-xl border border-background/20 bg-background/5 p-5">
                        <p className="font-mono-ui text-xs font-semibold uppercase tracking-[.16em] text-primary">Read the example first</p>
                         <p className="mt-2 text-sm leading-relaxed text-background/70">Look at what the code does and study the output shape. When you are ready, reveal a new task that uses the same idea with fresh hidden inputs.</p>
                        <button type="button" onClick={() => setLessonRead(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-secondary" data-testid="button-reveal-challenge">
                          I understand — show my challenge <ArrowRight size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-6 flex gap-3">
                          <span className="font-mono-ui text-xs text-secondary">01</span>
                          <div>
                            <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">Your changed challenge</p>
                            {activeLevel.id === 1 ? (
                              <div className="mt-3 max-w-xl rounded-lg border border-background/15 bg-background/5 p-3 text-sm leading-relaxed text-background/90">
                                <p className="mb-3">Complete each print question separately. No input is needed; print only the requested output.</p>
                                {printChallengeLoading && <p className="text-background/60">Loading the five printing questions…</p>}
                                {printChallengeError && <p className="text-secondary">Could not load the questions. Refresh the page to try again.</p>}
                                {printChallenge && <div className="mb-3 flex flex-wrap gap-2" aria-label="Printing question progress">
                                  {printChallenge.questions.map((question, index) => (
                                    <button key={question.id} type="button" onClick={() => choosePrintQuestion(index)} disabled={submitChallenge.isPending} aria-current={printQuestionIndex === index ? 'step' : undefined} aria-label={`Question ${index + 1}${printSolved[index] ? ', completed' : ''}`} className={`grid h-9 min-w-10 place-items-center rounded-lg border px-2 font-mono-ui text-xs font-bold transition disabled:cursor-wait ${printSolved[index] ? 'border-emerald-400 bg-emerald-500 text-white' : printQuestionIndex === index ? 'border-primary bg-primary text-foreground' : 'border-background/25 bg-background/10 text-background/70 hover:border-primary'}`}>
                                      {String(index + 1).padStart(2, '0')}{printSolved[index] && <Check size={12} className="ml-1 inline" />}
                                    </button>
                                  ))}
                                </div>}
                                {currentPrintQuestion && <p className="whitespace-pre-wrap leading-relaxed"><span className="mr-2 font-mono-ui font-bold text-primary">{String(printQuestionIndex + 1).padStart(2, '0')}.</span>{currentPrintQuestion.prompt}</p>}
                              </div>
                            ) : <p className="mt-2 max-w-xl font-mono-ui text-sm leading-relaxed text-background/90">{promptForLevel(activeLevel.id)}</p>}
                          </div>
                        </div>
                        <textarea
                          value={answer}
                          onChange={(event) => { setAnswer(event.target.value); if (activeLevel.id === 1) setPrintAnswers((current) => ({ ...current, [printQuestionIndex]: event.target.value })); setCodeOutput(null); if (feedback !== 'idle') setFeedback('idle'); }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Tab') return;
                            event.preventDefault();
                            const editor = event.currentTarget;
                            const start = editor.selectionStart;
                            const end = editor.selectionEnd;
                            const indentation = '    ';
                            setAnswer((current) => current.slice(0, start) + indentation + current.slice(end));
                            if (activeLevel.id === 1) setPrintAnswers((current) => ({ ...current, [printQuestionIndex]: answer.slice(0, start) + indentation + answer.slice(end) }));
                            setCodeOutput(null);
                            if (feedback !== 'idle') setFeedback('idle');
                            window.requestAnimationFrame(() => {
                              editor.focus();
                              editor.selectionStart = editor.selectionEnd = start + indentation.length;
                            });
                          }}
                          data-testid="input-code-answer"
                          placeholder={'# write your Python here\n'}
                          spellCheck={false}
                          className="min-h-[220px] w-full resize-y rounded-xl border border-background/20 bg-[#11182e] p-4 font-mono-ui text-sm leading-7 text-primary outline-none transition placeholder:text-background/25 focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                        {codeOutput && (
                          <div className="mt-4 rounded-xl border border-background/20 bg-[#11182e] p-4" data-testid="student-code-output">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">Your code output</p>
                               <span className={`font-mono-ui text-[10px] uppercase tracking-wider ${codeOutput.correct ? 'text-primary' : codeOutput.success ? 'text-secondary' : 'text-secondary'}`}>{codeOutput.correct ? 'all tests passed' : codeOutput.success ? 'ran, logic needs work' : codeOutput.status.replaceAll('_', ' ')}</span>
                            </div>
                             {codeOutput.sampleInput && <p className="mt-2 font-mono-ui text-[10px] text-background/45">Input format: {codeOutput.sampleInput}</p>}
                             <pre className={`mt-2 max-h-64 overflow-auto rounded-lg bg-[#0b1022] p-3 font-mono-ui text-xs leading-6 ${codeOutput.correct ? 'text-primary' : 'text-secondary'}`}>{codeOutput.output || codeOutput.error || 'Python stopped without an error message.'}</pre>
                             <p className="mt-2 text-[11px] leading-relaxed text-background/45">{codeOutput.message}</p>
                             <p className="mt-2 font-mono-ui text-[10px] uppercase tracking-wider text-background/55">Hidden tests: {codeOutput.passedTests}/{codeOutput.totalTests} passed</p>
                             {codeOutput.failedTest && !codeOutput.correct && (
                               <div className="mt-3 rounded-lg border border-secondary/30 bg-secondary/10 p-3 text-[11px] leading-relaxed text-background/70">
                                 <p className="font-mono-ui text-[10px] uppercase tracking-wider text-secondary">First failing test</p>
                                  <p className="mt-2">Your output did not match the expected result for this generated input:</p>
                                  <pre className="mt-2 overflow-auto rounded bg-[#0b1022] p-2 text-primary">test input:{'\n'}{codeOutput.failedTest.input || '(no input)'}</pre>
                                 <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                   <pre className="overflow-auto rounded bg-[#0b1022] p-2 text-secondary">actual: {codeOutput.failedTest.actual || '(nothing)'}</pre>
                                   <pre className="overflow-auto rounded bg-[#0b1022] p-2 text-primary">expected: {codeOutput.failedTest.expected}</pre>
                                 </div>
                               </div>
                             )}
                          </div>
                        )}
                        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {activeLevel.id === 1 && <>
                              <button type="button" onClick={() => choosePrintQuestion(printQuestionIndex - 1)} disabled={printQuestionIndex === 0 || submitChallenge.isPending} className="flex items-center gap-1 rounded-xl border border-background/25 px-3 py-3 text-sm font-semibold text-background/80 transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-35" aria-label="Previous question"><ArrowLeft size={15} /> Previous</button>
                              <button type="button" onClick={() => choosePrintQuestion(printQuestionIndex + 1)} disabled={printQuestionIndex >= (printChallenge?.questions.length ?? 0) - 1 || submitChallenge.isPending} className="flex items-center gap-1 rounded-xl border border-background/25 px-3 py-3 text-sm font-semibold text-background/80 transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-35" aria-label="Next question">Next <ArrowRight size={15} /></button>
                            </>}
                            <button type="button" onClick={submitAnswer} disabled={!answer.trim() || (activeLevel.id === 1 && !currentPrintQuestion) || recordAttempt.isPending || saveProgress.isPending || submitChallenge.isPending} data-testid="button-submit-answer" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45">
                               {recordAttempt.isPending || submitChallenge.isPending ? 'Running...' : activeLevel.id === 1 && printSolved[printQuestionIndex] ? 'Run again' : completed ? 'Run again' : 'Run and check'} <PlayIcon size={15} fill="currentColor" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-foreground bg-card p-5">
                    <div className="flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Objective feedback</span><CircleAlert size={15} className="text-secondary" /></div>
                    {feedback === 'idle' && <div className="mt-6"><p className="text-lg font-bold">Your move.</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use the console to make the idea visible. Clear code beats clever code.</p></div>}
                    {feedback === 'correct' && <div className="mt-6 animate-rise"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary"><Check size={21} strokeWidth={3} /></div><p className="text-lg font-bold">{activeLevel.id === 1 && !allPrintQuestionsSolved ? 'Question passed.' : 'Mission objective met.'}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeLevel.id === 1 && !allPrintQuestionsSolved ? 'This question is marked green. Continue through the remaining questions.' : 'That answer has the right shape. XP saved to your run.'}</p></div>}
                    {feedback === 'incorrect' && <div className="mt-6 animate-rise"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><X size={21} strokeWidth={3} /></div><p className="text-lg font-bold">Not quite there yet.</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Read the objective once more, then make one small change. You still have room to experiment.</p></div>}
                  </div>
                  <div className="rounded-2xl border-2 border-foreground/15 bg-primary/35 p-5">
                    <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-primary"><Flag size={14} /></span><span className="font-mono-ui text-[10px] uppercase tracking-[.18em]">Mission intel</span></div>
                    <div className="mt-4 flex flex-wrap gap-2">{activeLevel.skills.map((skill) => <span key={skill} className="rounded-full border border-foreground/25 bg-background/35 px-2.5 py-1 font-mono-ui text-[10px]">{skill}</span>)}</div>
                    <p className="mt-4 text-sm leading-relaxed">There are {activeLevel.questionCount} checkpoints in this mission.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border-2 border-foreground/15 px-4 py-3">
                    <span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Last checkpoint</span>
                    <span className="text-xs font-semibold">{formatTime(student?.lastSeenAt)}</span>
                  </div>
                </div>
              </div>
              {tabSwitches > 0 && <div className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-secondary bg-secondary/15 p-4 text-sm" data-testid="status-tab-switch-warning"><CircleAlert className="mt-0.5 shrink-0" size={17} /><p><strong>Focus check:</strong> we noticed {tabSwitches} tab switch{tabSwitches === 1 ? '' : 'es'} while this mission was open. Your teacher can see this checkpoint.</p></div>}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => { setAnswer(''); if (activeLevel.id === 1) setPrintAnswers((current) => ({ ...current, [printQuestionIndex]: '' })); setFeedback('idle'); }} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground" data-testid="button-reset-code"><RotateCcw size={15} /> Clear code</button>
                {((activeLevel.id === 1 && allPrintQuestionsSolved) || (activeLevel.id !== 1 && feedback === 'correct')) && <button type="button" onClick={() => { const next = orderedLevels[orderedLevels.findIndex((level) => level.id === activeLevel.id) + 1]; if (next) chooseLevel(next.id); else setShowMap(true); }} className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-foreground px-4 py-2.5 text-sm font-bold text-background transition hover:bg-secondary hover:text-foreground" data-testid="button-next-mission">{orderedLevels.findIndex((level) => level.id === activeLevel.id) === orderedLevels.length - 1 ? 'Back to map' : activeLevel.id === 1 ? 'Next lesson' : 'Next mission'} <ArrowRight size={16} /></button>}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PlaySkeleton() {
  return <main className="min-h-[100dvh] bg-background p-5 sm:p-10"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-10 w-40 rounded-lg bg-muted" /><div className="mt-16 grid gap-8 lg:grid-cols-[320px_1fr]"><div className="h-[500px] rounded-2xl bg-muted" /><div><div className="h-12 w-2/3 rounded-lg bg-muted" /><div className="mt-5 h-5 w-1/2 rounded-lg bg-muted" /><div className="mt-12 h-80 rounded-2xl bg-muted" /></div></div></div></main>;
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="max-w-md rounded-2xl border-2 border-foreground bg-card p-8 text-center ink-shadow"><CircleAlert className="mx-auto mb-4 text-secondary" size={32} /><h1 className="text-2xl font-extrabold">The quest map is offline.</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">We could not load your missions right now. Your progress is safe. Try the map again.</p><button type="button" onClick={onRetry} data-testid="button-retry-play" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background transition hover:bg-secondary hover:text-foreground">Retry <RotateCcw size={15} /></button></div></main>;
}
