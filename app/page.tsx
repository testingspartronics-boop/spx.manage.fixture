import FixtureDashboard from "@/components/fixture-dashboard";
import { getFixtures, getAuditLogs, getProjectDeviceData } from "./actions";

export default async function Home() {
  // Lấy danh sách fixture từ SQLite thông qua Prisma
  const initialFixtures = await getFixtures();
  const initialAuditLogs = await getAuditLogs();
  const projectDeviceData = await getProjectDeviceData();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      {/* Truyền data thật xuống component UI giữ nguyên 100% giao diện */}
      <FixtureDashboard
        initialFixtures={initialFixtures}
        initialAuditLogs={initialAuditLogs}
        initialProjectDeviceData={projectDeviceData}
      />
    </main>
  );
}