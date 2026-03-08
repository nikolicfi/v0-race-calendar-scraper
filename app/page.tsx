"use client"

import { useState } from "react"
import { ScraperHeader } from "@/components/scraper-header"
import { ScraperControls } from "@/components/scraper-controls"
import { ScraperStats } from "@/components/scraper-stats"
import { ScraperPreview } from "@/components/scraper-preview"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import type { RaceEvent, ScrapeStatistics } from "@/lib/types"

export default function ScraperPage() {
  const [races, setRaces] = useState<RaceEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapedAt, setScrapedAt] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [pagesScraped, setPagesScraped] = useState(0)
  const [totalPages, setTotalPages] = useState(35)
  const [statistics, setStatistics] = useState<ScrapeStatistics | undefined>()
  const [statusMessage, setStatusMessage] = useState("")

  const handleScrape = async () => {
    setIsLoading(true)
    setError(null)
    setRaces([])
    setPagesScraped(0)
    setTotalPages(35)
    setStatistics(undefined)
    setScrapedAt(null)
    setStatusMessage("Starting scrape...")

    const allRaces: RaceEvent[] = []
    let currentPage = 1
    let hasMore = true
    let expectedTotalPages = 35
    let consecutiveEmptyPages = 0

    try {
      while (hasMore && currentPage <= 50 && consecutiveEmptyPages < 3) {
        setStatusMessage(`Fetching page ${currentPage} of ~${expectedTotalPages}...`)
        setPagesScraped(currentPage)
        
        const response = await fetch(`/api/scrape?page=${currentPage}`)
        
        if (!response.ok) {
          console.log("[v0] Page fetch failed:", currentPage, response.status)
          currentPage++
          consecutiveEmptyPages++
          continue
        }

        const data = await response.json()
        console.log("[v0] Page response:", currentPage, data)

        if (!data.success) {
          console.log("[v0] Page not successful:", currentPage, data.error)
          currentPage++
          consecutiveEmptyPages++
          continue
        }

        if (data.races && data.races.length > 0) {
          allRaces.push(...data.races)
          setRaces([...allRaces])
          consecutiveEmptyPages = 0
        } else {
          consecutiveEmptyPages++
        }

        if (currentPage === 1 && data.totalPages) {
          expectedTotalPages = data.totalPages
          setTotalPages(data.totalPages)
        }

        hasMore = data.hasMore

        currentPage++

        // Small delay between requests
        await new Promise(r => setTimeout(r, 150))
      }

      // Deduplicate
      const seen = new Set<string>()
      const uniqueRaces = allRaces.filter(race => {
        const key = `${race.name.toLowerCase()}|${race.date}|${race.location.toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // Sort by date
      uniqueRaces.sort((a, b) => a.date.localeCompare(b.date))

      // Re-assign IDs
      uniqueRaces.forEach((race, i) => {
        race.id = `race-${i + 1}`
      })

      setRaces(uniqueRaces)
      setScrapedAt(new Date().toISOString())
      setStatusMessage(`Done! Found ${uniqueRaces.length} races`)
      setPagesScraped(currentPage - 1)

      // Calculate statistics
      const byRegion: Record<string, number> = {}
      const byCategory: Record<string, number> = {}
      const byMonth: Record<string, number> = {}

      for (const race of uniqueRaces) {
        byRegion[race.region] = (byRegion[race.region] || 0) + 1
        byCategory[race.category] = (byCategory[race.category] || 0) + 1
        const monthKey = `${race.year}-${race.month}`
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1
      }

      setStatistics({ byRegion, byCategory, byMonth })

    } catch (err) {
      console.log("[v0] Scrape error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      setStatusMessage("")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredRaces = races.filter(race => {
    const matchesSearch = 
      race.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      race.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRegion = regionFilter === "all" || race.region === regionFilter
    const matchesCategory = categoryFilter === "all" || race.category === categoryFilter
    return matchesSearch && matchesRegion && matchesCategory
  })

  const regions = [...new Set(races.map(r => r.region))].filter(Boolean).sort()
  const categories = [...new Set(races.map(r => r.category))].filter(Boolean).sort()

  const downloadCSV = () => {
    const headers = ["ID", "Date", "Date Formatted", "Name", "Location", "Region", "Category", "Distances", "Month", "Year", "Image URL"]
    const csvContent = [
      headers.join(","),
      ...filteredRaces.map(race => [
        race.id,
        race.date,
        `"${(race.dateFormatted || race.date).replace(/"/g, '""')}"`,
        `"${race.name.replace(/"/g, '""')}"`,
        `"${race.location.replace(/"/g, '""')}"`,
        `"${race.region.replace(/"/g, '""')}"`,
        `"${race.category.replace(/"/g, '""')}"`,
        `"${race.distances.join("; ").replace(/"/g, '""')}"`,
        race.month || "",
        race.year || "",
        race.imageUrl || ""
      ].join(","))
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `austria-races-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const progress = totalPages > 0 ? Math.round((pagesScraped / totalPages) * 100) : 0

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <ScraperHeader />
        
        <ScraperControls 
          onScrape={handleScrape}
          onDownload={downloadCSV}
          isLoading={isLoading}
          hasData={races.length > 0}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          regions={regions}
          categories={categories}
        />

        {isLoading && (
          <Card className="mb-6 bg-card border-border">
            <CardContent className="py-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{statusMessage}</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Page {pagesScraped} of ~{totalPages}</span>
                  <span>{races.length} races found</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6 bg-destructive/10 border-destructive/30">
            <CardContent className="py-4">
              <p className="text-destructive font-medium">Error</p>
              <p className="text-destructive/80 text-sm mt-1">{error}</p>
            </CardContent>
          </Card>
        )}

        <ScraperStats 
          totalRaces={races.length}
          filteredRaces={filteredRaces.length}
          regions={regions.length}
          categories={categories.length}
          scrapedAt={scrapedAt}
          pagesScraped={pagesScraped}
          totalPagesExpected={totalPages}
          statistics={statistics}
        />

        <ScraperPreview 
          races={filteredRaces}
          isLoading={isLoading && races.length === 0}
        />
      </div>
    </main>
  )
}
