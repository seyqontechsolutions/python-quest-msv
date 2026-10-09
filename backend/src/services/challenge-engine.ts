import { randomInt } from "node:crypto";
import type { CodeExecutionResult } from "./code-executor";

type TestCase = { stdin: string };
type ReferenceFunction = (stdin: string) => string;
type Generator = () => TestCase[];

export type ChallengeDefinition = {
  id: number;
  title: string;
  concept: string;
  starterCode: string;
  inputSpecification: string;
  outputSpecification: string;
  generateTestCases: Generator;
  referenceFunction: ReferenceFunction;
};

export type ValidationResult = {
  success: boolean;
  correct: boolean;
  output: string;
  error: string;
  sampleInput: string;
  passedTests: number;
  totalTests: number;
  message: string;
  status: "passed" | "wrong_answer" | "syntax_error" | "runtime_error" | "timeout" | "service_unavailable";
  failedTest?: { input: string; expected: string; actual: string };
};

const TEST_COUNT = 5;

function normalizeOutput(value: string) {
  return value
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

function randomInteger(min: number, max: number) {
  return randomInt(min, max + 1);
}

function twoIntegerCases() {
  return Array.from({ length: TEST_COUNT }, () => {
    const a = randomInteger(-200, 200);
    let b = 0;
    while (b === 0) b = randomInteger(-25, 25);
    return { stdin: `${a}\n${b}\n` };
  });
}

function oneIntegerCases() {
  return Array.from({ length: TEST_COUNT }, () => ({ stdin: `${randomInteger(-500, 500)}\n` }));
}

function rangeCases() {
  return Array.from({ length: TEST_COUNT }, () => {
    const start = randomInteger(-5, 10);
    const stop = start + randomInteger(2, 8);
    return { stdin: `${start}\n${stop}\n` };
  });
}

function randomWord(length = randomInteger(5, 10)) {
  return Array.from({ length }, () => String.fromCharCode(randomInteger(65, 90))).join("");
}

function wordCases() {
  return Array.from({ length: TEST_COUNT }, () => ({ stdin: `${randomWord()}\n` }));
}

function numberList() {
  return Array.from({ length: randomInteger(4, 8) }, () => randomInteger(-20, 40));
}

function listCases() {
  return Array.from({ length: TEST_COUNT }, () => ({ stdin: `${numberList().join(" ")}\n` }));
}

function colorCases() {
  return Array.from({ length: TEST_COUNT }, () => ({
    stdin: `${randomWord(4).toLowerCase()} ${randomWord(5).toLowerCase()} ${randomWord(6).toLowerCase()}\n`,
  }));
}

function dictionaryCases() {
  return Array.from({ length: TEST_COUNT }, () => {
    const mark = randomInteger(20, 100);
    return { stdin: `${randomWord(5)}\n${mark}\n` };
  });
}

function marksCases(): TestCase[] {
  return Array.from({ length: TEST_COUNT }, () => {
    const marks = [randomInteger(20, 100), randomInteger(20, 100), randomInteger(20, 100)];
    if (new Set(marks).size !== marks.length) return marksCases()[0];
    return { stdin: `StudentA ${marks[0]}\nStudentB ${marks[1]}\nStudentC ${marks[2]}\n` };
  });
}

function parseIntegers(stdin: string) {
  return stdin.trim().split(/\s+/).map(Number);
}

function pythonList(values: Array<string | number>) {
  return `[${values.map((value) => typeof value === "string" ? `'${value}'` : String(value)).join(", ")}]`;
}

const definitions: Record<number, ChallengeDefinition> = {
  1: {
    id: 1,
    title: "The Syntax Gate",
    concept: "Input, variables, arithmetic operators",
    starterCode: "",
    inputSpecification: "Two integers arrive on separate input lines.",
    outputSpecification: "Print their sum, remainder, and floor division, one result per line.",
    generateTestCases: twoIntegerCases,
    referenceFunction: (stdin) => {
      const [a, b] = parseIntegers(stdin);
      const quotient = Math.floor(a / b);
      const remainder = a - quotient * b;
      return `${a + b}\n${remainder}\n${quotient}`;
    },
  },
  2: {
    id: 2,
    title: "Input Lab",
    concept: "input(), int(), conditionals, modulo",
    starterCode: "",
    inputSpecification: "One integer arrives on its own input line.",
    outputSpecification: "Print exactly whether the number is divisible by 3.",
    generateTestCases: oneIntegerCases,
    referenceFunction: (stdin) => {
      const [number] = parseIntegers(stdin);
      return number % 3 === 0 ? "Divisible by 3" : "Not divisible by 3";
    },
  },
  3: {
    id: 3,
    title: "Loop Trail",
    concept: "for loops and range()",
    starterCode: "",
    inputSpecification: "A start integer and a stop integer arrive on separate lines.",
    outputSpecification: "Print every integer from start through stop, one per line.",
    generateTestCases: rangeCases,
    referenceFunction: (stdin) => {
      const [start, stop] = parseIntegers(stdin);
      return Array.from({ length: stop - start + 1 }, (_, index) => String(start + index)).join("\n");
    },
  },
  4: {
    id: 4,
    title: "String Forest",
    concept: "String indexing and slicing",
    starterCode: "",
    inputSpecification: "One word arrives on its own input line.",
    outputSpecification: "Print the word without its first and last character, then its final character.",
    generateTestCases: wordCases,
    referenceFunction: (stdin) => {
      const word = stdin.trim();
      return `${word.slice(1, -1)}\n${word.at(-1)}`;
    },
  },
  5: {
    id: 5,
    title: "List Workshop",
    concept: "List indexing, append(), insert(), len()",
    starterCode: "",
    inputSpecification: "Three words arrive on one space-separated input line.",
    outputSpecification: "Add one word at the end, insert one at index 1, then print the list and its length.",
    generateTestCases: colorCases,
    referenceFunction: (stdin) => {
      const values = stdin.trim().split(/\s+/);
      values.push("added");
      values.splice(1, 0, "inserted");
      return `${pythonList(values)}\n${values.length}`;
    },
  },
  6: {
    id: 6,
    title: "Decision Arena",
    concept: "if-elif-else and comparisons",
    starterCode: "",
    inputSpecification: "Three different integers arrive on separate input lines.",
    outputSpecification: "Print the smallest integer.",
    generateTestCases: () => Array.from({ length: TEST_COUNT }, () => {
      let values = [randomInteger(-100, 100), randomInteger(-100, 100), randomInteger(-100, 100)];
      while (new Set(values).size !== values.length) values = [randomInteger(-100, 100), randomInteger(-100, 100), randomInteger(-100, 100)];
      return { stdin: `${values.join("\n")}\n` };
    }),
    referenceFunction: (stdin) => String(Math.min(...parseIntegers(stdin))),
  },
  7: {
    id: 7,
    title: "Dictionary District",
    concept: "Dictionary keys, values, and get()",
    starterCode: "",
    inputSpecification: "A student name and a mark arrive on separate input lines.",
    outputSpecification: "Store the record in a dictionary and print the mark using get().",
    generateTestCases: dictionaryCases,
    referenceFunction: (stdin) => String(parseIntegers(stdin.split("\n")[1] ?? "")[0]),
  },
  8: {
    id: 8,
    title: "Data Splitter",
    concept: "Lists, filtering, and loops",
    starterCode: "",
    inputSpecification: "A space-separated list of integers arrives on one input line.",
    outputSpecification: "Print the even list, then the odd list.",
    generateTestCases: listCases,
    referenceFunction: (stdin) => {
      const values = parseIntegers(stdin);
      return `${pythonList(values.filter((value) => value % 2 === 0))}\n${pythonList(values.filter((value) => value % 2 !== 0))}`;
    },
  },
  9: {
    id: 9,
    title: "Nested Maze",
    concept: "Nested lists and order-preserving deduplication",
    starterCode: "",
    inputSpecification: "A space-separated list of integers arrives on one input line.",
    outputSpecification: "Print the values once each, preserving their first-seen order.",
    generateTestCases: listCases,
    referenceFunction: (stdin) => {
      const seen = new Set<number>();
      const distinct: number[] = [];
      for (const value of parseIntegers(stdin)) {
        if (!seen.has(value)) {
          seen.add(value);
          distinct.push(value);
        }
      }
      return pythonList(distinct);
    },
  },
  10: {
    id: 10,
    title: "The Term-I Boss",
    concept: "Dictionary records, loops, totals, and highest mark",
    starterCode: "",
    inputSpecification: "Three student records arrive as name and mark pairs on separate lines.",
    outputSpecification: "Print the total, average, and highest student as name - mark.",
    generateTestCases: marksCases,
    referenceFunction: (stdin) => {
      const records = stdin.trim().split("\n").map((line) => {
        const [name, mark] = line.split(/\s+/);
        return { name, mark: Number(mark) };
      });
      const total = records.reduce((sum, record) => sum + record.mark, 0);
      const highest = records.reduce((best, record) => record.mark > best.mark ? record : best);
      const average = total / records.length;
      const averageOutput = Number.isInteger(average) ? `${average}.0` : String(average);
      return `${total}\n${averageOutput}\n${highest.name} - ${highest.mark}`;
    },
  },
};

export function getChallenge(id: number) {
  return definitions[id];
}

export async function validateChallenge(
  id: number,
  code: string,
  execute: (code: string, stdin: string) => Promise<CodeExecutionResult>,
): Promise<ValidationResult> {
  const challenge = getChallenge(id);
  if (!challenge) {
    return {
      success: false,
      correct: false,
      output: "",
      error: "That challenge does not exist.",
      sampleInput: "",
      passedTests: 0,
      totalTests: 0,
      message: "Unknown challenge.",
      status: "service_unavailable",
    };
  }

  const tests = challenge.generateTestCases();
  let passedTests = 0;
  let firstOutput = "";
  for (const test of tests) {
    const expected = normalizeOutput(challenge.referenceFunction(test.stdin));
    const execution = await execute(code, test.stdin);
    if (!firstOutput) firstOutput = execution.stdout;

    if (execution.serviceUnavailable) {
      return {
        success: false,
        correct: false,
        output: execution.stdout,
        error: "Code execution service is temporarily unavailable. Please try again.",
        sampleInput: challenge.inputSpecification,
        passedTests,
        totalTests: tests.length,
        message: "The execution service could not validate this submission.",
        status: "service_unavailable",
      };
    }

    if (!execution.success) {
      const status = execution.timedOut
        ? "timeout"
        : /SyntaxError|IndentationError|TabError|^  File .* line \d+/m.test(execution.stderr)
          ? "syntax_error"
          : "runtime_error";
      return {
        success: false,
        correct: false,
        output: execution.stdout,
        error: execution.timedOut ? "Your program took too long to run." : execution.stderr,
        sampleInput: challenge.inputSpecification,
        passedTests,
        totalTests: tests.length,
        message: execution.timedOut ? "Your program took too long to run." : "Fix the error and run your code again.",
        status,
        failedTest: { input: test.stdin, expected, actual: normalizeOutput(execution.stdout) },
      };
    }

    const actual = normalizeOutput(execution.stdout);
    if (actual !== expected) {
      return {
        success: true,
        correct: false,
        output: execution.stdout,
        error: "",
        sampleInput: challenge.inputSpecification,
        passedTests,
        totalTests: tests.length,
        message: "Your logic works for some inputs, but fails for other inputs.",
        status: "wrong_answer",
        failedTest: { input: test.stdin, expected, actual },
      };
    }
    passedTests += 1;
  }

  return {
    success: true,
    correct: true,
    output: firstOutput,
    error: "",
    sampleInput: challenge.inputSpecification,
    passedTests,
    totalTests: tests.length,
    message: "Mission complete! Your program passed every hidden test.",
    status: "passed",
  };
}