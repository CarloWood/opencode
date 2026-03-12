function txt(code: string) {
  const map: Record<string, string> = {
    ConnectionRefused: "Connection refused",
    ConnectionReset: "Connection reset",
    ConnectionAborted: "Connection aborted",
    TimedOut: "Timed out",
    Timeout: "Timed out",
    UnknownHost: "Unknown host",
    NetworkUnreachable: "Network unreachable",
  }

  const hit = map[code]
  if (hit) return hit

  if (code.startsWith("E")) return code

  const spaced = code.replace(/([a-z])([A-Z])/g, "$1 $2")
  return spaced[0] ? spaced[0].toUpperCase() + spaced.slice(1).toLowerCase() : code
}

function url(input: Parameters<typeof fetch>[0]) {
  if (input instanceof Request) return input.url
  if (input instanceof URL) return input.toString()
  return String(input)
}

function wrap(input: Parameters<typeof fetch>[0], err: unknown) {
  if (!(err instanceof Error)) return
  if (err.name === "AbortError") return

  const bun = err as unknown as { code?: unknown; path?: unknown; errno?: unknown }
  const href = typeof bun.path === "string" && bun.path ? bun.path : url(input)

  const code = typeof bun.code === "string" && bun.code ? bun.code : undefined
  const msg = code ? txt(code) : undefined

  if (!msg && err.message !== "Unable to connect. Is the computer able to access the url?") return

  type Err = Error & { code?: string; path?: string; errno?: number }
  const out = new Error(msg ? `Unable to connect to ${href} (${msg})` : `Unable to connect to ${href}`, { cause: err })
  if (code) (out as Err).code = code
  ;(out as Err).path = href
  if (typeof bun.errno === "number") (out as Err).errno = bun.errno
  return out
}

export namespace Fetch {
  const key = Symbol.for("opencode.fetch.patch")

  export function patch() {
    const g = globalThis as unknown as { [key: symbol]: boolean }
    if (g[key]) return
    g[key] = true

    const base = globalThis.fetch
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      try {
        return await base(input, init)
      } catch (err) {
        throw wrap(input, err) ?? err
      }
    }) as typeof fetch
  }
}
