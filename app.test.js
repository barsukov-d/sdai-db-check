import { test } from "node:test"
import assert from "node:assert/strict"
import { createApp } from "./app.js"
import { startEmbeddedDb } from "./embedded-db.js"

const withServer = async (url, fn) => {
  const app = createApp(url)
  const server = await new Promise((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)) })
  try { await fn(`http://127.0.0.1:${server.address().port}`) } finally { server.close(); await app.close() }
}

test("без DATABASE_URL: /health/db отвечает «нет базы»", () =>
  withServer("", async (base) => {
    const r = await fetch(`${base}/health/db`)
    assert.equal(r.status, 503)
    assert.equal((await r.json()).db, "none")
  }))

test("база недоступна: ответ не содержит адреса и пароля", () =>
  withServer("postgres://app:Hunter22@127.0.0.1:1/app", async (base) => {
    const body = await (await fetch(`${base}/health/db`)).text()
    assert.ok(!body.includes("Hunter22"))
    assert.ok(!body.includes("127.0.0.1"))
    assert.match(body, /"db":"error"/)
  }))

test("адрес из DATABASE_URL: приложение видит встроенную базу и хранит заметки", async () => {
  const db = await startEmbeddedDb(55441)
  try {
    await withServer("postgres://app:test@127.0.0.1:55441/postgres", async (base) => {
      const health = await (await fetch(`${base}/health/db`)).json()
      assert.equal(health.marker, "sdai-ext-7f3a")
      const added = await fetch(`${base}/api/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "первая" }),
      })
      assert.equal(added.status, 201)
      const { notes } = await (await fetch(`${base}/api/notes`)).json()
      assert.deepEqual(notes.map((n) => n.text), ["первая"])
    })
  } finally {
    await db.stop()
  }
})
