import "server-only";
import { schedule } from "node-cron";
import { prisma } from "@/lib/prisma";

declare global {
  // eslint-disable-next-line no-var
  var __monthlyTargetCronStarted: boolean | undefined;
}

if (!global.__monthlyTargetCronStarted) {
  global.__monthlyTargetCronStarted = true;

  schedule(
    "0 0 1 * *",
    async () => {
      try {
        await prisma.userTarget.updateMany({
          where: { isActive: true },
          data: { isActive: false, endedAt: new Date() },
        });
      } catch (error) {
        console.error("Monthly target freeze failed:", error);
      }
    },
    {
      timezone: "UTC",
    }
  );
}
