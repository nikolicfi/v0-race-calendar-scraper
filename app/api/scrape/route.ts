import { NextResponse } from "next/server"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const REGIONS = [
  "Wien", "Vorarlberg", "Tirol", "Steiermark", "Salzburg",
  "Oberösterreich", "Niederösterreich", "Kärnten", "Burgenland"
]

const MONTH_MAP: Record<string, string> = {
  "jan": "01", "jän": "01", "feb": "02", "mär": "03", "mar": "03",
  "apr": "04", "mai": "05", "jun": "06", "jul": "07", "aug": "08",
  "sep": "09", "okt": "10", "nov": "11", "dez": "12"
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jänner", "02": "Februar", "03": "März", "04": "April",
  "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
  "09": "September", "10": "Oktober", "11": "November", "12": "Dezember"
}

interface RaceEvent {
  id: string
  date: string
  dateFormatted: string
  name: string
  location: string
  region: string
  category: string
  distances: string[]
  month: string
  year: string
  eventUrl?: string
  imageUrl?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  try {
    const targetUrl = page === 1
      ? "https://running.life/laufkalender/osterreich"
      : `https://running.life/laufkalender/osterreich?page=${page}`

    // Try multiple fetch strategies
    let html = ""
    let fetchMethod = ""
    
    // Strategy 1: Direct fetch with browser-like headers
    try {
      const directResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      })
      
      if (directResponse.ok) {
        html = await directResponse.text()
        fetchMethod = "direct"
      }
    } catch (e) {
      console.log("[v0] Direct fetch failed:", e)
    }

    // Strategy 2: Try with different URL format
    if (!html || html.length < 10000) {
      try {
        const altUrl = page === 1
          ? "https://running.life/de/calendar?country=austria"
          : `https://running.life/de/calendar?country=austria&page=${page}`
        
        const altResponse = await fetch(altUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(15000)
        })
        
        if (altResponse.ok) {
          const altHtml = await altResponse.text()
          if (altHtml.length > html.length) {
            html = altHtml
            fetchMethod = "alt-url"
          }
        }
      } catch (e) {
        console.log("[v0] Alt URL fetch failed:", e)
      }
    }

    if (!html) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch page content",
        races: [],
        page,
        hasMore: page < 35,
        totalPages: 35
      })
    }

    // Parse races from HTML
    const races = parseRacesFromHtml(html, page)
    
    // Get total pages
    let totalPages = 33
    const countMatch = html.match(/(\d+)\s*Rennen/i)
    if (countMatch) {
      totalPages = Math.ceil(parseInt(countMatch[1]) / 20)
    }

    // Debug: find termine links
    const termineLinks = (html.match(/\/de\/termine\/[a-z0-9-]+/gi) || [])
    const uniqueTermine = [...new Set(termineLinks)]

    return NextResponse.json({
      success: true,
      races,
      page,
      hasMore: page < totalPages,
      totalPages,
      debug: {
        htmlLength: html.length,
        fetchMethod,
        termineLinksFound: uniqueTermine.length,
        termineExamples: uniqueTermine.slice(0, 5),
        racesFound: races.length,
        htmlSample: html.slice(0, 500),
        htmlMiddle: html.slice(Math.floor(html.length / 2), Math.floor(html.length / 2) + 1000)
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      races: [],
      page,
      hasMore: page < 35,
      totalPages: 35
    })
  }
}

function parseRacesFromHtml(html: string, pageNum: number): RaceEvent[] {
  const races: RaceEvent[] = []

  // Real HTML structure (confirmed from debug logs):
  // <section wire:key="event:XXXXX">
  //   <a href="/de/termine/slug" class="..."> <-- FIRST LINK: image/calendar wrapper (no text content)
  //     <div class="event-calendar">
  //       <div>Mär</div>  <-- month abbreviation
  //       <div>8</div>    <-- day number
  //     </div>
  //   </a>
  //   ... then later the race name link and location/region text ...
  //   <a href="/de/termine/slug" class="label-distance">6 km</a>  <-- distance links
  // </section>

  // Use a regex to find each <section wire:key="event:..."> block
  const sectionRegex = /<section[^>]*wire:key="event:(\d+)"[^>]*>([\s\S]*?)<\/section>/gi
  const sectionMatches = [...html.matchAll(sectionRegex)]

  for (const sectionMatch of sectionMatches) {
    const eventHtml = sectionMatch[2]

    // --- DATE ---
    // event-calendar div contains two child divs: month abbrev then day number
    let date = ""
    let dateFormatted = ""
    let month = ""
    let year = "2026"

    const calendarMatch = eventHtml.match(/class="event-calendar"[\s\S]*?<div[^>]*>\s*([A-Za-z\u00e4\u00fc]{3})\s*<\/div>[\s\S]*?<div[^>]*>\s*(\d{1,2})\s*<\/div>/i)
    if (calendarMatch) {
      const monthStr = calendarMatch[1].toLowerCase().slice(0, 3)
      month = MONTH_MAP[monthStr] || "01"
      const day = calendarMatch[2].padStart(2, "0")
      year = parseInt(month) <= 2 ? "2027" : "2026"
      date = `${year}-${month}-${day}`
      dateFormatted = `${parseInt(day)}. ${MONTH_NAMES[month]} ${year}`
    }

    if (!date) continue

    // --- RACE NAME & URL ---
    // Find all /de/termine/ links in this section
    const allTermineLinks = [...eventHtml.matchAll(/<a[^>]*href="((?:https:\/\/running\.life)?\/de\/termine\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi)]

    let eventUrl = ""
    let raceName = ""

    for (const lm of allTermineLinks) {
      const href = lm[1]
      const attrs = lm[2]
      const innerHtml = lm[3]
      const text = innerHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()

      // Skip label-distance links
      if (attrs.includes("label-distance") || innerHtml.includes("label-distance")) continue

      // Skip links whose only content is the event-calendar div (image wrapper)
      if (innerHtml.includes("event-calendar")) continue

      // Skip pure number/km strings
      if (/^\d+(\.\d+)?\s*km$/i.test(text)) continue

      // This should be the race name link
      if (text.length >= 3 && text.length <= 150) {
        raceName = text
        eventUrl = href.startsWith("http") ? href : `https://running.life${href}`
        break
      }
    }

    if (!raceName) continue

    // --- LOCATION & REGION ---
    let location = ""
    let region = ""

    // Strip all tags to get plain text of the section
    const plainText = eventHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

    for (const r of REGIONS) {
      // Look for "SomeCity, Region" or "SomeCity Region"
      const locPattern = new RegExp(`([A-Za-z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df][A-Za-z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\\s\\.\\-]{1,40}),\\s*${r}(?![a-z])`, "i")
      const locMatch = plainText.match(locPattern)
      if (locMatch) {
        location = locMatch[1].trim()
        region = r
        break
      }
    }

    // Fallback: just find the region name anywhere
    if (!region) {
      for (const r of REGIONS) {
        if (plainText.includes(r)) {
          region = r
          location = r
          break
        }
      }
    }

    if (!region) {
      region = "Österreich"
      location = "Österreich"
    }

    // --- DISTANCES ---
    // label-distance links contain the distances: <a class="label-distance">6 km</a>
    const distances: string[] = []
    const distLinkMatches = [...eventHtml.matchAll(/label-distance[^>]*>([\s\S]*?)<\/a>/gi)]
    for (const dm of distLinkMatches) {
      const distText = dm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      // Should look like "6 km" or "21.1 km"
      if (/^\d+(?:[,\.]\d+)?\s*km$/i.test(distText) && !distances.includes(distText) && distances.length < 10) {
        distances.push(distText)
      }
    }

    // Also try plain text km matches if no label-distance found
    if (distances.length === 0) {
      const kmMatches = [...eventHtml.matchAll(/(\d+(?:[,\.]\d+)?)\s*km/gi)]
      for (const km of kmMatches) {
        const dist = `${km[1]} km`
        if (!distances.includes(dist) && distances.length < 10) {
          distances.push(dist)
        }
      }
    }

    // --- CATEGORY ---
    let category = "Laufrennen"
    const contextLower = (raceName + " " + plainText).toLowerCase()
    const categoryMap = [
      { keywords: ["trailrun", "trail run", "trail"], cat: "Trailrun" },
      { keywords: ["triathlon"], cat: "Triathlon" },
      { keywords: ["hindernislauf", "obstacle"], cat: "Hindernislauf" },
      { keywords: ["halbmarathon", "half marathon"], cat: "Halbmarathon" },
      { keywords: ["ultramarathon", "backyard ultra"], cat: "Ultramarathon" },
      { keywords: ["marathon"], cat: "Marathon" },
      { keywords: ["duathlon"], cat: "Duathlon" },
      { keywords: ["berglauf", "vertical km", "bergrennen"], cat: "Berglauf" },
    ]
    for (const { keywords, cat } of categoryMap) {
      if (keywords.some(k => contextLower.includes(k))) {
        category = cat
        break
      }
    }

    // Avoid duplicates
    if (races.some(r => r.name === raceName && r.date === date)) continue

    races.push({
      id: `p${pageNum}-${races.length}`,
      date,
      dateFormatted,
      name: raceName,
      location,
      region,
      category,
      distances,
      month,
      year,
      eventUrl,
      imageUrl: undefined
    })
  }

  return races
}
