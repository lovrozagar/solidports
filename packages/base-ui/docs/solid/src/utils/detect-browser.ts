/* 10-line UA sniff in place of @base-ui/utils/detectBrowser (React-coupled). */

function ua() {
  if (typeof navigator === "undefined") return ""
  return navigator.userAgent
}

export const isSafari =
  typeof navigator !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(ua())

export const isEdge =
  typeof navigator !== "undefined" && /Edg\//.test(ua())

export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(ua())
