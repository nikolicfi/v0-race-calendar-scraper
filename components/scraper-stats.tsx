"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, FileText, Filter, Folder, Layers, MapPin, Timer } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { ScrapeStatistics } from "@/lib/types"

interface ScraperStatsProps {
  totalRaces: number
  filteredRaces: number
  regions: number
  categories: number
  scrapedAt: string | null
  pagesScraped?: number
  totalPagesExpected?: number
  statistics?: ScrapeStatistics
}

export function ScraperStats({
  totalRaces,
  filteredRaces,
  regions,
  categories,
  scrapedAt,
  pagesScraped,
  totalPagesExpected,
  statistics,
}: ScraperStatsProps) {
  if (totalRaces === 0) return null

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const stats = [
    {
      label: "Total Races",
      value: totalRaces,
      icon: Calendar,
      color: "text-primary",
    },
    {
      label: "Showing",
      value: filteredRaces,
      icon: Filter,
      color: "text-chart-2",
    },
    {
      label: "Regions",
      value: regions,
      icon: MapPin,
      color: "text-chart-4",
    },
    {
      label: "Categories",
      value: categories,
      icon: Layers,
      color: "text-chart-5",
    },
  ]

  // Get top regions
  const topRegions = statistics?.byRegion 
    ? Object.entries(statistics.byRegion)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  // Get top categories
  const topCategories = statistics?.byCategory 
    ? Object.entries(statistics.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  // Get monthly distribution
  const monthlyData = statistics?.byMonth
    ? Object.entries(statistics.byMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
    : []

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split("-")
    const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value.toLocaleString("de-AT")}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed breakdowns */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Regions breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Races by Region
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {topRegions.map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between">
                    <span className="text-sm text-foreground truncate">{region}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(count / totalRaces) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Categories breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Races by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {topCategories.map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm text-foreground truncate">{category}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-chart-2 rounded-full" 
                          style={{ width: `${(count / totalRaces) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly distribution */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Monthly Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {monthlyData.slice(0, 5).map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{getMonthName(month)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-chart-4 rounded-full" 
                          style={{ width: `${(count / Math.max(...monthlyData.map(d => d[1]))) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Scrape info */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {pagesScraped && totalPagesExpected && (
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3" />
            <span>Scraped {pagesScraped} of {totalPagesExpected} pages</span>
          </div>
        )}
        {scrapedAt && (
          <div className="flex items-center gap-2">
            <Timer className="w-3 h-3" />
            <span>Last updated: {formatTime(scrapedAt)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
