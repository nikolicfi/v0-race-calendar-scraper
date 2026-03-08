"use client"

import { useState } from "react"
import { ScraperHeader } from "@/components/scraper-header"
import { ScraperControls } from "@/components/scraper-controls"
import { ScraperStats } from "@/components/scraper-stats"
import { ScraperPreview } from "@/components/scraper-preview"
import { Progress } from "@/components/ui/progress"
import type { RaceEvent, ScrapeStatistics } from "@/lib/types"

export default function ScraperPage() {
  const [races, setRaces] = useState<RaceEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapedAt, setScrapedAt] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [pagesScraped, setPagesScraped] = useState<number | undefined>()
  const [totalPagesExpected, setTotalPagesExpected] = useState<number | undefined>()
  const [statistics, setStatistics] = useState<ScrapeStatistics | undefined>()
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [racesFound, setRacesFound] = useState(0)

  const handleScrape = async () => {
    setIsLoading(true)
    setError(null)
    setRaces([])
    setPagesScraped(undefined)
    setTotalPagesExpected(undefined)
    setStatistics(undefined)
    setScrapedAt(null)
    setProgress(0)
    setStatusMessage("Starting scraper...")
    setRacesFound(0)
    
    try {
      const response = await fetch("/api/scrape")
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      
      if (!response.body) {
        throw new Error("No response body")
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete SSE messages
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === "status") {
                setStatusMessage(data.message)
                if (data.progress !== undefined) setProgress(data.progress)
                if (data.totalPages) setTotalPagesExpected(data.totalPages)
              } else if (data.type === "progress") {
                setPagesScraped(data.pagesScraped)
                setTotalPagesExpected(data.totalPages)
                setRacesFound(data.racesFound)
                setProgress(data.progress)
                setStatusMessage(`Scraped ${data.pagesScraped}/${data.totalPages} pages, found ${data.racesFound} races`)
              } else if (data.type === "complete") {
                setRaces(data.data)
                setScrapedAt(data.scrapedAt)
                setPagesScraped(data.pagesScraped)
                setTotalPagesExpected(data.totalPagesExpected)
                setStatistics(data.statistics)
                setProgress(100)
                setStatusMessage(`Complete! Found ${data.count} races`)
              } else if (data.type === "error") {
                setError(data.message)
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Failed to connect to scraper")
      } else {
        setError("Failed to connect to scraper")
      }
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
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `austria-races-${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
          <div className="mb-6 p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{statusMessage}</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {racesFound > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Found {racesFound} races so far...
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <ScraperStats 
          totalRaces={races.length}
          filteredRaces={filteredRaces.length}
          regions={regions.length}
          categories={categories.length}
          scrapedAt={scrapedAt}
          pagesScraped={pagesScraped}
          totalPagesExpected={totalPagesExpected}
          statistics={statistics}
        />

        <ScraperPreview 
          races={filteredRaces}
          isLoading={isLoading}
        />
      </div>
    </main>
  )
}
