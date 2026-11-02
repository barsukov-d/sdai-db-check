import { createApp } from "./app.js"
import { startEmbeddedDb } from "./embedded-db.js"

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? "0.0.0.0"

await startEmbeddedDb()
createApp().listen(port, host, () => {
  console.log(`db-check: http://${host}:${port}`)
})
