"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { TrendingUp, Flame, Trophy, ArrowUpCircle } from "lucide-react";
import type { MemoryItemDTO, UserProgressDTO, CEFRLevel } from "@/lib/types";
import {
  getMemoryItems,
  getUserProgress,
  ensureUserProgress,
  updateTierMasteryScore,
  advanceTier,
} from "@/lib/storage";
import { checkTierAdvancement, computeTierMasteryScore } from "@/lib/mastery-gate";
import { CEFR_ORDER, estimateRecallProbability } from "@/lib/mastery-engine";

interface ProgressTabProps {
  userId: string;
}

const CEFR_COLOR: Record<CEFRLevel, string> = {
  A1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  A2: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B1: "bg-amber-100 text-amber-700 border-amber-200",
  B2: "bg-orange-100 text-orange-700 border-orange-200",
  C1: "bg-rose-100 text-rose-700 border-rose-200",
  C2: "bg-red-100 text-red-700 border-red-200",
};

export function ProgressTab({ userId }: ProgressTabProps) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgressDTO | null>(null);
  const [memoryItems, setMemoryItems] = useState<MemoryItemDTO[]>([]);
  const [advancing, setAdvancing] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [prog, items] = await Promise.all([
      ensureUserProgress(userId),
      getMemoryItems(userId),
    ]);
    setProgress(prog);
    setMemoryItems(items);

    // Recompute tier mastery score
    const score = computeTierMasteryScore(items, prog.currentTier);
    if (Math.abs(score - prog.tierMasteryScore) > 0.01) {
      await updateTierMasteryScore(userId, score);
      setProgress({ ...prog, tierMasteryScore: score });
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
     
  }, [userId]);

  const tierCheck = useMemo(() => {
    if (!progress) return null;
    return checkTierAdvancement(memoryItems, progress.currentTier);
  }, [memoryItems, progress]);

  // Per-tier stats
  const tierStats = useMemo(() => {
    return CEFR_ORDER.map((tier) => {
      const itemsInTier = memoryItems.filter((m) => m.cefrLevel === tier);
      const avgRecall =
        itemsInTier.length > 0
          ? itemsInTier.reduce(
              (sum, i) => sum + estimateRecallProbability(i),
              0
            ) / itemsInTier.length
          : 0;
      return {
        tier,
        count: itemsInTier.length,
        avgRecall,
      };
    });
  }, [memoryItems]);

  async function handleAdvance() {
    if (!tierCheck?.canAdvance) return;
    setAdvancing(true);
    try {
      const updated = await advanceTier(userId);
      if (updated) {
        setProgress(updated);
        toast.success(`Advanced to ${updated.currentTier}!`);
        await loadAll();
      }
    } finally {
      setAdvancing(false);
    }
  }

  if (loading || !progress) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const masteryPct = Math.round(progress.tierMasteryScore * 100);
  const totalItems = memoryItems.length;

  return (
    <div className="space-y-4">
      {/* Top row: current tier + mastery + streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">Current tier</div>
              <Badge className={CEFR_COLOR[progress.currentTier]} variant="outline">
                <span className="text-base font-bold">{progress.currentTier}</span>
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">
                Tier mastery
              </div>
              <div className="text-2xl font-bold">{masteryPct}%</div>
              <Progress value={masteryPct} className="h-1.5 mt-1" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-xs text-muted-foreground">Streak</div>
              <div className="text-2xl font-bold">{progress.streakDays}d</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier advancement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4" />
            Tier advancement
          </CardTitle>
          <CardDescription>
            Reach 85% average recall across at least 10 items in your current tier to unlock the next level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Items in tier</div>
              <div className="font-medium">
                {tierCheck?.sampleSize ?? 0} / 10
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Average recall
              </div>
              <div className="font-medium">
                {((tierCheck?.avgP ?? 0) * 100).toFixed(0)}% / 85%
              </div>
            </div>
          </div>
          {tierCheck?.canAdvance ? (
            <Button
              onClick={handleAdvance}
              disabled={advancing}
              className="w-full"
              size="lg"
            >
              <ArrowUpCircle className="w-4 h-4 mr-1.5" />
              {advancing
                ? "Advancing…"
                : `Advance to ${tierCheck.nextTier}`}
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              {!tierCheck?.nextTier
                ? "You're at the highest tier (C2)."
                : tierCheck.sampleSize < 10
                ? `Save and review ${
                    10 - tierCheck.sampleSize
                  } more ${progress.currentTier}-level items to qualify.`
                : `Improve your average recall by ${(
                    0.85 -
                    tierCheck.avgP
                  ).toFixed(2)} to advance.`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-tier breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mastery by tier</CardTitle>
          <CardDescription>
            Vocabulary items saved and average recall per CEFR level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tierStats.map((stat) => (
              <div key={stat.tier} className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`${CEFR_COLOR[stat.tier]} w-12 justify-center`}
                >
                  {stat.tier}
                </Badge>
                <div className="flex-1">
                  <Progress
                    value={stat.avgRecall * 100}
                    className="h-2"
                  />
                </div>
                <div className="text-xs text-muted-foreground w-24 text-right">
                  {stat.count} items · {(stat.avgRecall * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Total vocabulary items: <strong>{totalItems}</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
