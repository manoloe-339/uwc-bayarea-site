"use server";

import { revalidatePath } from "next/cache";
import { snoozeSignal, unsnoozeAll } from "@/lib/dashboard-signals";

export async function snoozeSignalAction(signalId: string, days: number): Promise<void> {
  await snoozeSignal(signalId, days);
  revalidatePath("/admin");
}

export async function unsnoozeAllAction(): Promise<void> {
  await unsnoozeAll();
  revalidatePath("/admin");
}
