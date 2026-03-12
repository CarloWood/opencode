import { createConnection } from "net"
import { setTimeout as sleep } from "node:timers/promises"
import { Flag } from "@/flag/flag"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"

function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function payload(sessionID: string, cwd: string) {
  return [
    "<config-session>",
    `  <session-id>${escape(sessionID)}</session-id>`,
    `  <cwd>${escape(cwd)}</cwd>`,
    "</config-session>",
    "",
  ].join("\n")
}

export namespace SocketTap {
  const log = Log.create({ service: "sockettap" })
  const waits = [0, 50, 150, 500]

  async function send(path: string, body: string) {
    return await new Promise<string | undefined>((resolve) => {
      const socket = createConnection(path)

      socket.once("connect", () => {
        socket.end(body)
      })
      socket.once("close", () => resolve(undefined))
      socket.once("error", (err) => {
        socket.destroy()
        resolve(err.message)
      })
    })
  }

  export async function session(sessionID: string) {
    const path = Flag.OPENCODE_EXEC_SOCKET_PATH
    if (!path) return
    const cwd = Filesystem.resolve(process.cwd())
    const body = payload(sessionID, cwd)
    let error: string | undefined

    for (const wait of waits) {
      if (wait) await sleep(wait)
      error = await send(path, body)
      if (!error) return
    }

    log.warn("sockettap session send failed", {
      error,
      path,
      sessionID,
    })
  }
}
