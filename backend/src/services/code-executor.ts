import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CodeExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  serviceUnavailable: boolean;
};

const blockedCodePattern = /\b(import|from|open|exec|eval|compile|__import__|breakpoint|help|quit|exit|os|sys|subprocess|socket|pathlib|shutil|requests|urllib)\b|__/i;

function executionEndpoint() {
  const configured = process.env.CODE_EXECUTION_URL?.trim();
  if (configured) {
    if (configured.endsWith("/execute")) return configured;
    if (configured.endsWith("/api/v2")) return `${configured}/execute`;
    return `${configured}/api/v2/execute`;
  }

  return null;
}

async function executeLocallyForDevelopment(code: string, stdin: string, timeoutMs: number): Promise<CodeExecutionResult> {
  const folder = await mkdtemp(join(tmpdir(), "python-quest-sandbox-"));
  const scriptPath = join(folder, "main.py");

  try {
    await writeFile(scriptPath, code, "utf8");
    return await new Promise((resolve) => {
      const child = execFile(
        process.env.PYTHON_EXECUTABLE ?? (process.platform === "win32" ? "python" : "python3"),
        ["-I", "-S", "-B", scriptPath],
        {
          cwd: folder,
          env: {
            PATH: process.env.PATH ?? "",
            PYTHONIOENCODING: "utf-8",
            PYTHONHASHSEED: "0",
          },
          timeout: timeoutMs,
          maxBuffer: 60000,
        },
        (error, stdout, stderr) => {
          const timedOut = Boolean(error && (error.killed || error.signal === "SIGTERM"));
          resolve({
            success: !error,
            stdout: String(stdout ?? ""),
            stderr: timedOut
              ? "Your program took too long to run."
              : String(stderr ?? error?.message ?? "").replaceAll(scriptPath, "main.py"),
            exitCode: typeof error?.code === "number" ? error.code : error ? 1 : 0,
            timedOut,
            serviceUnavailable: Boolean(error && error.code === "ENOENT"),
          });
        },
      );
      child.stdin?.end(stdin);
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function executePython(code: string, stdin: string): Promise<CodeExecutionResult> {
  if (blockedCodePattern.test(code)) {
    return {
      success: false,
      stdout: "",
      stderr: "This classroom runner blocks imports, file access, system commands, and other unsafe code.",
      exitCode: 1,
      timedOut: false,
      serviceUnavailable: false,
    };
  }

  const endpoint = executionEndpoint();
  const timeoutMs = Math.max(500, Number(process.env.CODE_EXECUTION_TIMEOUT ?? 5000));
  if (!endpoint) {
    return executeLocallyForDevelopment(code, stdin, timeoutMs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + 1000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.CODE_EXECUTION_API_KEY
          ? { authorization: `Bearer ${process.env.CODE_EXECUTION_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        language: "python",
        version: process.env.CODE_EXECUTION_PYTHON_VERSION ?? "3.10.0",
        files: [{ name: "main.py", content: code }],
        stdin,
        run_timeout: timeoutMs,
        compile_timeout: timeoutMs,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        stdout: "",
        stderr: `Execution provider returned HTTP ${response.status}.`,
        exitCode: null,
        timedOut: false,
        serviceUnavailable: true,
      };
    }

    const payload = (await response.json()) as {
      run?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null };
      compile?: { stdout?: string; stderr?: string; code?: number | null };
    };
    const run: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null } =
      payload.run ?? payload.compile ?? {};
    const stderr = [payload.compile?.stderr, payload.run?.stderr].filter(Boolean).join("\n");
    const timedOut = /timed out|timeout/i.test(`${stderr} ${run.signal ?? ""}`);

    return {
      success: run.code === 0 && !run.signal && !timedOut,
      stdout: run.stdout ?? "",
      stderr,
      exitCode: run.code ?? null,
      timedOut,
      serviceUnavailable: false,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      stdout: "",
      stderr: timedOut
        ? "Your program took too long to run."
        : "The code execution service could not be reached.",
      exitCode: null,
      timedOut,
      serviceUnavailable: !timedOut,
    };
  } finally {
    clearTimeout(timer);
  }
}
