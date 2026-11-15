import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { getContext } from "@/lib/auth-context";
import { db } from "@/db";
import { organizationProfile } from "@/db/schema";
import { authOrganization, authUser } from "@/db/auth-schema";
import { getI18n } from "@/i18n/server";
import { SignOutConfirm } from "./sign-out-confirm";

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
      <dt className="text-sm text-muted sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-base font-medium" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

async function ProfileContent() {
  // The layout already redirected anyone without a session or business.
  const [ctx, { locale, t }] = await Promise.all([getContext(), getI18n()]);
  const p = t.dashboard.profile;

  // Every lookup is keyed by ids from the server-side context.
  const [[user], [org], [orgProfile]] = await Promise.all([
    db
      .select({ name: authUser.name, email: authUser.email, createdAt: authUser.createdAt })
      .from(authUser)
      .where(eq(authUser.id, ctx.userId))
      .limit(1),
    db.select({ name: authOrganization.name }).from(authOrganization).where(eq(authOrganization.id, ctx.orgId)).limit(1),
    db
      .select({ phone: organizationProfile.businessPhone })
      .from(organizationProfile)
      .where(eq(organizationProfile.organizationId, ctx.orgId))
      .limit(1),
  ]);

  const name = user?.name || p.notSet;
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const memberSince = user?.createdAt
    ? new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { dateStyle: "long" }).format(user.createdAt)
    : p.notSet;
  const roleLabel = t.dashboard.roles[ctx.role];

  return (
    <section aria-labelledby="profile-title" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 id="profile-title" className="text-3xl sm:text-4xl">
        {p.title}
      </h1>

      {/* Who is signed in */}
      <div className="flex items-center gap-4 rounded-2xl border border-accent-strong/60 bg-white/70 p-5 shadow-sm sm:p-6">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent font-serif text-3xl text-foreground"
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-medium" data-testid="user-name">
            {name}
          </p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
          <span
            className="mt-2 inline-block rounded-full border border-accent-strong bg-background px-2.5 py-0.5 text-xs font-medium"
            data-testid="user-role"
          >
            {roleLabel}
          </span>
        </div>
      </div>

      {/* All details */}
      <div className="overflow-hidden rounded-2xl border border-accent-strong/60 bg-white/70 shadow-sm">
        <h2 className="border-b border-foreground/10 px-5 py-3 font-sans text-xs font-medium uppercase tracking-[0.15em] text-muted sm:px-6">
          {p.details}
        </h2>
        <dl className="divide-y divide-foreground/10">
          <Row label={p.name} value={name} />
          <Row label={p.email} value={user?.email || p.notSet} testId="user-email" />
          <Row label={p.role} value={roleLabel} />
          <Row label={p.business} value={org?.name || p.notSet} testId="business-name" />
          <Row label={p.phone} value={orgProfile?.phone || p.notSet} testId="business-phone" />
          <Row label={p.memberSince} value={memberSince} />
        </dl>
      </div>

      <div className="flex justify-center pt-2 sm:justify-start">
        <SignOutConfirm t={p} />
      </div>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy className="mx-auto flex w-full max-w-2xl animate-pulse flex-col gap-6">
      <div className="h-9 w-40 rounded-lg bg-foreground/10" />
      <div className="h-28 rounded-2xl bg-foreground/5" />
      <div className="h-80 rounded-2xl bg-foreground/5" />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
