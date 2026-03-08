"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar, ExternalLink, Grid3X3, List, MapPin, Tag, Timer } from "lucide-react"
import type { RaceEvent } from "@/lib/types"

interface ScraperPreviewProps {
  races: RaceEvent[]
  isLoading: boolean
}

export function ScraperPreview({ races, isLoading }: ScraperPreviewProps) {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">Scraping races...</p>
              <p className="text-sm text-muted-foreground">
                Fetching data from running.life
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (races.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium">No races loaded</p>
              <p className="text-sm text-muted-foreground">
                Click "Start Scraping" to fetch race data from Austria
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (dateStr: string, dateRange?: string) => {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString("de-AT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    return dateRange ? `${formatted} (${dateRange})` : formatted
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Trailrun: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      Triathlon: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      Hindernislauf: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      Straßenrennen: "bg-slate-500/20 text-slate-400 border-slate-500/30",
      "Urban Trail": "bg-purple-500/20 text-purple-400 border-purple-500/30",
      "Backyard Ultra": "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return colors[category] || "bg-primary/20 text-primary border-primary/30"
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">
            Race Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className={viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Location</TableHead>
                  <TableHead className="text-muted-foreground">Region</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground">Distances</TableHead>
                  <TableHead className="text-muted-foreground w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {races.map((race) => (
                  <TableRow 
                    key={race.id} 
                    className="border-border hover:bg-secondary/50 transition-colors"
                  >
                    <TableCell className="text-foreground font-medium whitespace-nowrap">
                      {formatDate(race.date, race.dateRange)}
                    </TableCell>
                    <TableCell className="text-foreground font-medium max-w-[200px] truncate">
                      {race.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {race.location}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {race.region}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`${getCategoryColor(race.category)} text-xs`}
                      >
                        {race.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {race.distances.slice(0, 3).map((dist, i) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className="bg-secondary text-foreground border-border text-xs"
                          >
                            {dist}
                          </Badge>
                        ))}
                        {race.distances.length > 3 && (
                          <Badge 
                            variant="outline" 
                            className="bg-secondary text-muted-foreground border-border text-xs"
                          >
                            +{race.distances.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {race.eventUrl && (
                        <a
                          href={race.eventUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {races.map((race) => (
              <Card 
                key={race.id} 
                className="bg-secondary/50 border-border hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-foreground line-clamp-2">
                      {race.name}
                    </h3>
                    {race.eventUrl && (
                      <a
                        href={race.eventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>{formatDate(race.date, race.dateRange)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{race.location}, {race.region}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <Badge 
                        variant="outline" 
                        className={`${getCategoryColor(race.category)} text-xs`}
                      >
                        {race.category}
                      </Badge>
                    </div>
                    
                    {race.distances.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Timer className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {race.distances.map((dist, i) => (
                            <Badge 
                              key={i} 
                              variant="outline" 
                              className="bg-card text-foreground border-border text-xs"
                            >
                              {dist}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
