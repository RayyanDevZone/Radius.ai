import { getI18n } from "@/i18n/server";

// Placeholder until real settings exist. The dashboard layout already
// redirected anyone without a session or business.
export default async function SettingsPage() {
  const { t } = await getI18n();
  const s = t.dashboard.settings;

  return (
    <section aria-labelledby="settings-title" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 id="settings-title" className="text-3xl sm:text-4xl">
        {s.title}
      </h1>
      <div className="rounded-2xl border border-accent-strong/60 bg-white/70 p-5 text-muted shadow-sm sm:p-6">
        {s.intro}
      </div>
    </section>
  );
}
