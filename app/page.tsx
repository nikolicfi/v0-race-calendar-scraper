"use client"

import { useState } from "react"
import { ScraperHeader } from "@/components/scraper-header"
import { ScraperControls } from "@/components/scraper-controls"
import { ScraperStats } from "@/components/scraper-stats"
import { ScraperPreview } from "@/components/scraper-preview"
import type { RaceEvent, ScrapeResponse } from "@/lib/types"

export default function ScraperPage() {
  const [races, setRaces] = useState<RaceEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapedAt, setScrapedAt] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const handleScrape = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch("/api/scrape")
      const data: ScrapeResponse = await response.json()
      
      if (data.success) {
        setRaces(data.data)
        setScrapedAt(data.scrapedAt)
      } else {
        setError(data.error || "Failed to scrape data")
      }
    } catch {
      setError("Failed to connect to scraper")
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
    const headers = ["ID", "Date", "Date Range", "Name", "Location", "Region", "Category", "Distances", "Image URL", "Event URL"]
    const csvContent = [
      headers.join(","),
      ...filteredRaces.map(race => [
        race.id,
        race.date,
        race.dateRange || "",
        `"${race.name.replace(/"/g, '""')}"`,
        `"${race.location.replace(/"/g, '""')}"`,
        `"${race.region.replace(/"/g, '""')}"`,
        `"${race.category.replace(/"/g, '""')}"`,
        `"${race.distances.join("; ").replace(/"/g, '""')}"`,
        race.imageUrl || "",
        race.eventUrl || ""
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
      <div className="container mx-auto px-4 py-8">
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
        />

        <ScraperPreview 
          races={filteredRaces}
          isLoading={isLoading}
        />
      </div>
    </main>
  )
}
