import "dotenv/config";
import cors from "cors";
import express from "express";
import { MongoClient } from "mongodb";
import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPrintQuestions, validateChallenge, validatePrintQuestion } from "./services/challenge-engine.ts";
import { executePython } from "./services/code-executor.ts";

const app = express();
const port = Number(process.env.PORT || 5000);
const scrypt = promisify(scryptCallback);
function passwordEncryptionKey() {
  const key = Buffer.from(process.env.PASSWORD_ENCRYPTION_KEY || "", "hex");
  if (key.length !== 32) throw new Error("PASSWORD_ENCRYPTION_KEY must be set to exactly 64 hexadecimal characters.");
  return key;
}
function encryptPassword(password) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", passwordEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}
function decryptPassword(encrypted) {
  if (!encrypted) return null;
  const [ivHex, tagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) return null;
  const decipher = createDecipheriv("aes-256-gcm", passwordEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}
app.use(cors());
app.use(express.json());

const levels = [
  ["Print Studio", "Printing statements", "Warm-up", 100, "Complete five separate print() output checkpoints.", ["print()", "Strings", "sep", "end", "Tabs"], 5],
  ["Input Lab", "Input and decisions", "Easy", 140, "Build a number scanner that accepts values, calculates results, and spots even numbers.", ["input()", "int()", "Variables", "if-else", "Modulo"], 8],
  ["Loop Trail", "Repetition", "Easy", 160, "Guide the explorer through a pattern grid using for loops, range(), and end.", ["for loop", "range()", "end=", "Nested loops", "Patterns"], 8],
  ["String Forest", "Strings", "Steady", 180, "Decode messages with indexing, slicing, and a vowel-counting scanner.", ["Indexing", "Slicing", "Negative index", "String traversal"], 8],
  ["List Workshop", "Lists", "Steady", 200, "Organise the supply list with indexing, len(), append(), insert(), and extend().", ["List indexing", "len()", "append()", "insert()", "extend()"], 10],
  ["Decision Arena", "Conditionals and loops", "Challenge", 220, "Compare values, search collections, and choose the right branch every time.", ["if-elif-else", "for loop", "Largest of three", "Smallest element"], 8],
  ["Dictionary District", "Dictionaries", "Challenge", 240, "Run a student records desk using keys, values, items, get(), and dictionary updates.", ["Dictionary syntax", "Keys and values", "get()", "Add/change/delete"], 10],
  ["Data Splitter", "Lists with loops", "Hard", 270, "Split raw scores into even and odd lists, then find extremes without max() or min().", ["List building", "Filtering", "Accumulator logic", "for loop"], 8],
  ["Nested Maze", "Advanced list skills", "Hard", 300, "Navigate nested lists, remove duplicates in order, and find the second-largest value.", ["Nested lists", "Nested slicing", "Distinct values", "Order preservation"], 8],
  ["The Term-I Boss", "Full program practice", "Boss", 400, "Build a complete marks register by combining the Python skills from the trail.", ["Dictionary CRUD", "Aggregation", "Average", "Highest mark", "Exam programs"], 12],
].map(([title, chapter, difficulty, xp, mission, skills, questionCount], index) => ({ id: index + 1, title, chapter, difficulty, xp, mission, skills, questionCount }));

const students = new Map();
const attempts = [];
let nextId = 1;
let nextAttemptId = 1;
const gradeCodes = ["6", "7", "8", "9", "10", "11", "12"];
const gradeCollections = new Map();
const attemptCollections = new Map();
let legacyStudentsCollection;
let legacyAttemptsCollection;
const levelsFor = (student) => [...student.progress.values()];
const profileFor = (student) => ({ id: student.id, name: student.name, grade: student.grade, xp: student.xp, level: student.level, lives: student.lives, completedLevels: [...student.progress.values()].filter((p) => p.completed).map((p) => p.levelId), streak: 0, lastSeenAt: student.lastSeenAt });
const error = (res, status, message) => res.status(status).json({ error: message });
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}
async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const persistStudent = (student) => gradeCollections.get(student.grade).replaceOne(
  { _id: student.id },
  { _id: student.id, id: student.id, name: student.name, grade: student.grade, passwordHash: student.passwordHash, passwordEncrypted: student.passwordEncrypted, xp: student.xp, level: student.level, lives: student.lives, lastSeenAt: student.lastSeenAt, progress: [...student.progress.values()] },
  { upsert: true },
);
const persistAttempt = (attempt, grade) => attemptCollections.get(grade).insertOne({ _id: attempt.id, ...attempt });

async function connectDatabase() {
  // Passwords need reversible encryption so teachers can view them. Validate
  // this deployment setting before accepting requests instead of failing on signup.
  passwordEncryptionKey();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Add it to backend/.env.");
  const client = new MongoClient(uri);
  await client.connect();
  const database = client.db();
  legacyStudentsCollection = database.collection("students");
  legacyAttemptsCollection = database.collection("attempts");
  for (const grade of gradeCodes) {
    gradeCollections.set(grade, database.collection(`grade_${grade}`));
    attemptCollections.set(grade, database.collection(`attempts_grade_${grade}`));
    await Promise.all([
      gradeCollections.get(grade).createIndex({ name: 1 }),
      attemptCollections.get(grade).createIndex({ studentId: 1, createdAt: -1 }),
    ]);
  }

  // Migrate records from the initial shared collections, if present.
  const legacyStudents = await legacyStudentsCollection.find().toArray();
  for (const doc of legacyStudents) {
    const grade = doc.grade === "8A" || doc.grade === "8B" ? "8" : String(doc.grade);
    if (!gradeCodes.includes(grade)) continue;
    const collection = gradeCollections.get(grade);
    const exists = await collection.findOne({ _id: doc.id });
    if (!exists) await collection.insertOne({ ...doc, _id: doc.id, grade });
  }

  const studentDocsByGrade = await Promise.all(gradeCodes.map((grade) => gradeCollections.get(grade).find().toArray()));
  for (const docs of studentDocsByGrade) {
    for (const doc of docs) {
      const { _id, ...student } = doc;
      student.progress = new Map((student.progress ?? []).map((item) => [item.levelId, item]));
      students.set(student.id, student);
      nextId = Math.max(nextId, student.id + 1);
    }
  }

  const legacyAttempts = await legacyAttemptsCollection.find().toArray();
  const gradeByStudent = new Map([...students.values()].map((student) => [student.id, student.grade]));
  for (const doc of legacyAttempts) {
    const grade = gradeByStudent.get(doc.studentId);
    if (!grade) continue;
    const collection = attemptCollections.get(grade);
    const exists = await collection.findOne({ _id: doc.id });
    if (!exists) await collection.insertOne({ ...doc, _id: doc.id });
  }

  const attemptDocsByGrade = await Promise.all(gradeCodes.map((grade) => attemptCollections.get(grade).find().sort({ createdAt: -1 }).toArray()));
  for (const docs of attemptDocsByGrade) {
    for (const doc of docs) {
      const { _id, ...attempt } = doc;
      attempts.push(attempt);
      nextAttemptId = Math.max(nextAttemptId, attempt.id + 1);
    }
  }
  attempts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  console.log(`Connected to MongoDB database: ${database.databaseName}`);
  console.log(`Grade collections ready: ${gradeCodes.map((grade) => `grade_${grade}`).join(", ")}`);
}

app.get("/", (_req, res) => res.json({ service: "Python Quest API", status: "ok", health: "/api/healthz" }));
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/api/game/levels", (_req, res) => res.json(levels));
app.get("/api/game/print-challenge", (_req, res) => res.json({ questions: getPrintQuestions() }));
app.get("/api/students/roster/:grade", (req, res) => res.json([...new Set([...students.values()].filter((s) => s.grade === req.params.grade).map((s) => s.name))].sort()));
app.post("/api/students", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const grade = req.body?.grade;
  const password = String(req.body?.password || "");
  if (!name || !["6", "7", "8", "9", "10", "11", "12"].includes(grade)) return error(res, 400, "Name and grade (6–12) are required.");
  if (password.length < 6 || password.length > 128) return error(res, 400, "Password must be between 6 and 128 characters.");
  let student = [...students.values()].find((entry) => entry.name.toLowerCase() === name.toLowerCase() && entry.grade === grade);
  if (!student) {
    student = { id: nextId++, name, grade, passwordHash: await hashPassword(password), passwordEncrypted: encryptPassword(password), xp: 0, level: 1, lives: 30, lastSeenAt: new Date().toISOString(), progress: new Map() };
    students.set(student.id, student);
  } else if (student.passwordHash) {
    if (!await verifyPassword(password, student.passwordHash)) return error(res, 401, "That password does not match this student name.");
    if (!student.passwordEncrypted) student.passwordEncrypted = encryptPassword(password);
  } else {
    // Existing classroom records without a password get one on their first sign-in.
    student.passwordHash = await hashPassword(password);
    student.passwordEncrypted = encryptPassword(password);
  }
  student.lastSeenAt = new Date().toISOString();
  await persistStudent(student);
  res.status(201).json(profileFor(student));
});
app.get("/api/students/:studentId", (req, res) => {
  const student = students.get(Number(req.params.studentId));
  return student ? res.json(profileFor(student)) : error(res, 404, "Student not found");
});
app.post("/api/students/:studentId/progress", async (req, res) => {
  const student = students.get(Number(req.params.studentId));
  if (!student) return error(res, 404, "Student not found");
  const { levelId, xpEarned = 0, livesRemaining = 30, completed = false, tabSwitches = 0 } = req.body ?? {};
  const level = levels.find((item) => item.id === Number(levelId));
  if (!level) return error(res, 400, "Unknown mission");
  const old = student.progress.get(level.id);
  const newlyCompleted = completed && !old?.completed;
  student.progress.set(level.id, { levelId: level.id, xpEarned: Math.max(old?.xpEarned ?? 0, Number(xpEarned)), livesRemaining: Number(livesRemaining), completed: Boolean(completed || old?.completed), tabSwitches: Math.max(old?.tabSwitches ?? 0, Number(tabSwitches)) });
  if (newlyCompleted) student.xp += Number(xpEarned);
  student.level = Math.max(student.level, completed ? level.id + 1 : level.id);
  student.lives = Number(livesRemaining);
  student.lastSeenAt = new Date().toISOString();
  await persistStudent(student);
  res.json(profileFor(student));
});
app.get("/api/students/:studentId/attempts", (req, res) => {
  const student = students.get(Number(req.params.studentId));
  if (!student) return error(res, 404, "Student not found");
  res.json(attempts.filter((attempt) => attempt.studentId === student.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/students/:studentId/attempts", async (req, res) => {
  const student = students.get(Number(req.params.studentId));
  if (!student) return error(res, 404, "Student not found");
  const attempt = { id: nextAttemptId++, studentId: student.id, levelId: Number(req.body?.levelId), questionId: String(req.body?.questionId ?? ""), correct: Boolean(req.body?.correct), answer: String(req.body?.answer ?? ""), tabSwitchDetected: Boolean(req.body?.tabSwitchDetected), createdAt: new Date().toISOString() };
  await persistAttempt(attempt, student.grade);
  attempts.unshift(attempt);
  res.status(201).json(attempt);
});
app.post("/api/students/:studentId/run", async (req, res) => {
  const studentId = Number(req.params.studentId);
  const student = students.get(studentId);
  if (!student) return error(res, 404, "Student not found");
  const levelId = Number(req.body?.levelId);
  const code = String(req.body?.code ?? "");
  if (!Number.isInteger(levelId) || !code.trim() || code.length > 12000) return error(res, 400, "A mission id and Python code (up to 12,000 characters) are required.");
  const questionId = Number(req.body?.questionId);
  res.json(levelId === 1
    ? await validatePrintQuestion(code, questionId, executePython)
    : await validateChallenge(levelId, code, executePython));
});
app.post("/api/challenges/:challengeId/submit", async (req, res) => {
  const challengeId = Number(req.params.challengeId);
  const code = String(req.body?.code ?? "");
  if (!Number.isInteger(challengeId) || !code.trim() || code.length > 12000) return error(res, 400, "A mission id and Python code (up to 12,000 characters) are required.");
  const questionId = Number(req.body?.questionId);
  res.json(challengeId === 1
    ? await validatePrintQuestion(code, questionId, executePython)
    : await validateChallenge(challengeId, code, executePython));
});
app.get("/api/leaderboard", (req, res) => {
  const grade = req.query.grade == null ? null : String(req.query.grade);
  if (grade !== null && !gradeCodes.includes(grade)) return error(res, 400, "Choose a grade from 6 to 12.");
  const rankedStudents = [...students.values()]
    .filter((student) => grade === null || student.grade === grade)
    .sort((a, b) => b.xp - a.xp);
  res.json(rankedStudents.slice(0, 20).map((student, index) => ({ rank: index + 1, name: student.name, xp: student.xp, level: student.level, completedLevels: [...student.progress.values()].filter((progress) => progress.completed).length })));
});
app.post("/api/teacher/students", async (req, res) => {
  if ((req.header("x-teacher-pin") || "") !== (process.env.TEACHER_PIN || "0626")) return error(res, 401, "Teacher PIN required");
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const grade = String(req.body?.grade || "");
  const password = String(req.body?.password || "");
  if (!name || !gradeCodes.includes(grade)) return error(res, 400, "Student name and grade (6–12) are required.");
  if (password.length < 6 || password.length > 128) return error(res, 400, "Password must be between 6 and 128 characters.");
  const duplicate = [...students.values()].some((entry) => entry.grade === grade && entry.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return error(res, 409, "A student with that name already exists in this grade.");
  const student = { id: nextId++, name, grade, passwordHash: await hashPassword(password), passwordEncrypted: encryptPassword(password), xp: 0, level: 1, lives: 30, lastSeenAt: new Date().toISOString(), progress: new Map() };
  await persistStudent(student);
  students.set(student.id, student);
  res.status(201).json({ ...profileFor(student), password, passwordSet: true, status: "online", tabSwitches: 0 });
});
app.delete("/api/teacher/students/:studentId", async (req, res) => {
  if ((req.header("x-teacher-pin") || "") !== (process.env.TEACHER_PIN || "0626")) return error(res, 401, "Teacher PIN required");
  const student = students.get(Number(req.params.studentId));
  if (!student) return error(res, 404, "Student not found");
  await Promise.all([
    gradeCollections.get(student.grade).deleteOne({ _id: student.id }),
    attemptCollections.get(student.grade).deleteMany({ studentId: student.id }),
    legacyStudentsCollection.deleteMany({ $or: [{ _id: student.id }, { id: student.id }] }),
    legacyAttemptsCollection.deleteMany({ studentId: student.id }),
  ]);
  students.delete(student.id);
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].studentId === student.id) attempts.splice(index, 1);
  }
  res.json({ success: true, deletedStudentId: student.id });
});
app.patch("/api/teacher/students/:studentId", async (req, res) => {
  if ((req.header("x-teacher-pin") || "") !== (process.env.TEACHER_PIN || "0626")) return error(res, 401, "Teacher PIN required");
  const student = students.get(Number(req.params.studentId));
  if (!student) return error(res, 404, "Student not found");
  const name = String(req.body?.name ?? student.name).trim().slice(0, 80);
  const newPassword = String(req.body?.newPassword ?? "");
  if (!name) return error(res, 400, "Student name cannot be empty.");
  const duplicate = [...students.values()].some((entry) => entry.id !== student.id && entry.grade === student.grade && entry.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return error(res, 409, "A student with that name already exists in this grade.");
  if (newPassword && (newPassword.length < 6 || newPassword.length > 128)) return error(res, 400, "New password must be between 6 and 128 characters.");
  student.name = name;
  if (newPassword) {
    student.passwordHash = await hashPassword(newPassword);
    student.passwordEncrypted = encryptPassword(newPassword);
  }
  await persistStudent(student);
  res.json({ ...profileFor(student), passwordSet: Boolean(student.passwordHash) });
});
app.get("/api/teacher/students/grade/:grade", (req, res) => {
  if ((req.header("x-teacher-pin") || "") !== (process.env.TEACHER_PIN || "0626")) return error(res, 401, "Teacher PIN required");
  const grade = String(req.params.grade);
  if (!gradeCodes.includes(grade)) return error(res, 400, "Choose a grade from 6 to 12.");
  const records = [...students.values()].filter((student) => student.grade === grade).map((student) => ({
    ...profileFor(student),
    password: decryptPassword(student.passwordEncrypted),
    passwordSet: Boolean(student.passwordHash),
    status: Date.now() - new Date(student.lastSeenAt).getTime() < 900000 ? "online" : "away",
    tabSwitches: levelsFor(student).reduce((sum, item) => sum + item.tabSwitches, 0),
  }));
  res.json(records);
});
app.get("/api/teacher/dashboard", (req, res) => {
  if ((req.header("x-teacher-pin") || "") !== (process.env.TEACHER_PIN || "0626")) return error(res, 401, "Teacher PIN required");
  const all = [...students.values()];
  const summaries = all.map((s) => ({ id: s.id, name: s.name, grade: s.grade, xp: s.xp, level: s.level, lives: s.lives, completedLevels: [...s.progress.values()].filter((p) => p.completed).length, lastSeenAt: s.lastSeenAt, status: Date.now() - new Date(s.lastSeenAt).getTime() < 900000 ? "online" : "away", tabSwitches: levelsFor(s).reduce((sum, p) => sum + p.tabSwitches, 0), passwordSet: Boolean(s.passwordHash) }));
  res.json({ totalStudents: all.length, activeToday: all.filter((s) => Date.now() - new Date(s.lastSeenAt).getTime() < 86400000).length, completedQuest: summaries.filter((s) => s.completedLevels >= levels.length).length, averageXp: all.length ? Math.round(all.reduce((sum, s) => sum + s.xp, 0) / all.length) : 0, students: summaries, recentActivity: attempts.slice(0, 12).map((a) => ({ studentName: students.get(a.studentId)?.name ?? "Student", event: a.tabSwitchDetected ? "Flagged a tab switch" : a.correct ? "Solved a coding challenge" : "Made an attempt", levelId: a.levelId, createdAt: a.createdAt })) });
});

app.use((cause, req, res, next) => {
  if (res.headersSent) return next(cause);
  console.error(`Request failed: ${req.method} ${req.path}`, cause);
  res.status(500).json({ error: "The server could not complete this request. Check the backend logs." });
});

connectDatabase().then(() => {
  app.listen(port, () => console.log(`Python Quest API listening on http://localhost:${port}`));
}).catch((cause) => {
  console.error("Could not connect to MongoDB:", cause);
  process.exitCode = 1;
});
