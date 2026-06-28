import type { Plugin } from "@opencode-ai/plugin"

export default (async () => {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      const dateLine = `Today's date: ${today}`
      if (typeof output.system === "string") {
        output.system = output.system
          ? `${output.system}\n\n${dateLine}`
          : dateLine
      } else if (Array.isArray(output.system)) {
        const existing = output.system.find(
          (m) => typeof m === "object" && m !== null && "content" in m
        )
        if (existing && typeof existing.content === "string") {
          existing.content = `${existing.content}\n\n${dateLine}`
        } else {
          output.system.push({ type: "text", text: dateLine })
        }
      } else {
        output.system = dateLine
      }
    },
  }
}) satisfies Plugin
