import express from "express"
import pg from "pg"

/**
 * Заметки хранятся в базе из DATABASE_URL. Ни адрес базы, ни текст ошибки
 * подключения наружу и в журнал не попадают: в тексте ошибки бывает адрес.
 */
export function createApp(databaseUrl = process.env.DATABASE_URL) {
  const app = express()
  app.use(express.json())
  const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 3 }) : null
  pool?.on("error", () => console.error("db: соединение оборвалось"))

  const notesReady = pool
    ? pool.query("CREATE TABLE IF NOT EXISTS notes (id serial PRIMARY KEY, text text NOT NULL)").then(
        () => true,
        () => false,
      )
    : Promise.resolve(false)

  app.get("/api/health", (_req, res) => res.json({ ok: true }))

  app.get("/health/db", async (_req, res) => {
    if (!pool) return res.status(503).json({ ok: false, db: "none", text: "нет базы" })
    try {
      const { rows } = await pool.query("SELECT value FROM marker LIMIT 1")
      res.json({ ok: true, db: "connected", marker: rows[0]?.value ?? null })
    } catch {
      console.error("db: запрос не выполнен")
      res.status(503).json({ ok: false, db: "error", text: "база не отвечает" })
    }
  })

  const needDb = async (res) => {
    if (await notesReady) return true
    res.status(503).json({ error: "нет базы" })
    return false
  }

  app.get("/api/notes", async (_req, res) => {
    if (!(await needDb(res))) return
    const { rows } = await pool.query("SELECT id, text FROM notes ORDER BY id")
    res.json({ notes: rows })
  })

  app.post("/api/notes", async (req, res) => {
    if (!(await needDb(res))) return
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : ""
    if (text === "" || text.length > 200) return res.status(400).json({ error: "Текст от 1 до 200 символов" })
    const { rows } = await pool.query("INSERT INTO notes (text) VALUES ($1) RETURNING id, text", [text])
    res.status(201).json(rows[0])
  })

  app.get("/", (_req, res) => res.type("html").send(PAGE))
  app.close = () => pool?.end()
  return app
}

const PAGE = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Заметки</title>
<h1>Заметки</h1><p id="status" data-testid="db-status"></p>
<form id="f"><input id="t" data-testid="note-text" placeholder="Текст заметки" required>
<button data-testid="note-add">Добавить</button></form><ul id="l" data-testid="notes"></ul>
<script>
const load = async () => {
  const h = await (await fetch("/health/db")).json()
  document.getElementById("status").textContent = h.ok ? "База подключена" : "Нет базы"
  const r = await fetch("/api/notes")
  const l = document.getElementById("l")
  l.replaceChildren()
  if (r.ok) for (const n of (await r.json()).notes) { const li = document.createElement("li"); li.textContent = n.text; l.append(li) }
}
document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault()
  const t = document.getElementById("t")
  await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t.value }) })
  t.value = ""
  await load()
})
load()
</script></html>`
