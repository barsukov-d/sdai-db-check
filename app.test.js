import { test } from "node:test"
import assert from "node:assert/strict"
import { createApp } from "./app.js"

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
