"use server";

import { revalidatePath } from "next/cache";
import {
  ignoreSignal,
  snoozeSignal,
  unignoreSignal,
  unsnoozeAll,
} from "@/lib/dashboard-signals";

export async function snoozeSignalAction(signalId: string, days: number): Promise<void> {
  await snoozeSignal(signalId, days);
  revalidatePath("/admin");
}

export async function unsnoozeAllAction(): Promise<void> {
  await unsnoozeAll();
  revalidatePath("/admin");
}

export async function ignoreSignalAction(
  signalId: string,
  kind: string,
  reason: string,
): Promise<void> {
  await ignoreSignal(signalId, kind, reason);
  revalidatePath("/admin");
}

export async function unignoreSignalAction(signalId: string): Promise<void> {
  await unignoreSignal(signalId);
  revalidatePath("/admin");
}
